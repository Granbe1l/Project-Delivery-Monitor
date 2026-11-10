from datetime import UTC, datetime, timedelta

from pydantic import ValidationError
from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert

from app.collectors.github import API, GitHubClient, GitHubError
from app.core.config import REPOSITORIES, settings
from app.core.logging import event
from app.models.entities import (
    Finding,
    Issue,
    Milestone,
    PullRequest,
    Repository,
    Snapshot,
    SyncRun,
    WorkflowRun,
)
from app.risk_engine.engine import Policy, analyze
from app.schemas.github import IssueSource, MilestoneSource, PRSource, RepoSource, WorkflowSource


def ensure_repositories(db):
    for full in REPOSITORIES:
        owner, name = full.split("/")
        db.execute(
            insert(Repository)
            .values(
                full_name=full, owner=owner, name=name, enabled=True, created_at=datetime.now(UTC)
            )
            .on_conflict_do_nothing(index_elements=["full_name"])
        )
    db.commit()


def endpoints(repo, now):
    since = (now - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
    return {
        "issues": (
            f"/repos/{repo}/issues?state=open&sort=updated&direction=desc&per_page=100",
            None,
            IssueSource,
            Issue,
        ),
        "pulls": (
            f"/repos/{repo}/pulls?state=open&sort=updated&direction=desc&per_page=100",
            None,
            PRSource,
            PullRequest,
        ),
        "workflows": (
            f"/repos/{repo}/actions/runs?created=%3E%3D{since}&per_page=100",
            "workflow_runs",
            WorkflowSource,
            WorkflowRun,
        ),
        "milestones": (
            f"/repos/{repo}/milestones?state=all&per_page=100",
            None,
            MilestoneSource,
            Milestone,
        ),
    }


def normalize(item, repo_id, now):
    values = item.model_dump()
    values["github_id"] = values.pop("id")
    values.update(repo_id=repo_id, last_seen_at=now)
    if isinstance(item, IssueSource):
        milestone = values.pop("milestone")
        values["milestone_github_id"] = milestone.get("id") if milestone else None
    if isinstance(item, PRSource):
        values["requested_reviewers"] = [
            r.get("login") for r in item.requested_reviewers if r.get("login")
        ]
    if isinstance(item, WorkflowSource):
        values["branch"] = values.pop("head_branch")
        values["name"] = values["name"] or "Unnamed workflow"
    return values


async def synchronize(db, full_name, client=None):
    if full_name not in REPOSITORIES:
        raise ValueError("Repository is not in the public allowlist")
    ensure_repositories(db)
    repo = db.scalar(select(Repository).where(Repository.full_name == full_name))
    # A transaction-scoped lock prevents overlapping jobs for the same repository.
    if not db.scalar(text("SELECT pg_try_advisory_xact_lock(:key)"), {"key": repo.id}):
        db.rollback()
        return {"repository": full_name, "status": "busy"}
    previous = db.scalar(
        select(Snapshot)
        .where(Snapshot.repo_id == repo.id)
        .order_by(Snapshot.observed_at.desc())
        .limit(1)
    )
    now = datetime.now(UTC)
    run = SyncRun(repo_id=repo.id, started_at=now, status="running")
    db.add(run)
    db.flush()
    owned = client is None
    client = client or GitHubClient()
    metadata, parsed = {}, {}
    try:
        try:
            response, raw = await client.get(f"{API}/repos/{full_name}")
            source = RepoSource.model_validate(raw)
            if source.full_name.lower() != full_name.lower():
                raise GitHubError("repository_identity_mismatch")
            repo.github_id, repo.default_branch, repo.html_url = (
                source.id,
                source.default_branch,
                source.html_url,
            )
            metadata["repository"] = {"http_status": response.status_code, "coverage": "complete"}
        except (GitHubError, ValidationError) as exc:
            run.status, run.error_summary = (
                "failure",
                exc.code if isinstance(exc, GitHubError) else "invalid_repository_schema",
            )
            run.finished_at = datetime.now(UTC)
            run.endpoints = {
                "repository": {
                    "error": run.error_summary,
                    "http_status": getattr(exc, "status", None),
                    "coverage": "unavailable",
                }
            }
            db.commit()
            event("sync_finished", repository=full_name, status="failure", error=run.error_summary)
            return {"repository": full_name, "status": "failure", "endpoints": run.endpoints}
        for name, (path, key, schema, model) in endpoints(full_name, now).items():
            result = await client.collect(path, settings().sync_max_pages, key)
            meta = result.metadata()
            items = result.items
            if name == "issues":
                items = [i for i in items if "pull_request" not in i]
            try:
                validated = (
                    [schema.model_validate(i) for i in items]
                    if result.coverage != "unavailable"
                    else None
                )
            except ValidationError:
                validated = None
                meta.update(coverage="unavailable", error="invalid_record_schema")
            parsed[name] = validated
            if validated is not None:
                # Dedupe page overlaps before upsert; records outside this observation remain historical.
                validated = list({i.id: i for i in validated}.values())
                parsed[name] = validated
                for item in validated:
                    values = normalize(item, repo.id, now)
                    stmt = insert(model).values(**values)
                    db.execute(
                        stmt.on_conflict_do_update(
                            index_elements=["repo_id", "github_id"], set_=values
                        )
                    )
                meta["observed_at"] = now.isoformat()
                run.rows_processed = (run.rows_processed or 0) + len(validated)
            metadata[name] = meta
        run.total_pages = sum(m.get("pages", 0) for m in metadata.values())
        run.endpoints = metadata
        run.finished_at = datetime.now(UTC)
        complete = all(metadata[n]["coverage"] == "complete" for n in parsed)
        available = any(v is not None for v in parsed.values())
        run.status = "success" if complete else "partial" if available else "failure"
        run.coverage = "complete" if complete else "partial" if available else "unavailable"
        if not complete:
            run.error_summary = (
                "Some endpoints are unavailable or limited by the configured collection budget."
            )
        if available:
            cfg = settings()
            metrics, findings = analyze(
                issues=parsed["issues"],
                pulls=parsed["pulls"],
                workflows=parsed["workflows"],
                milestones=parsed["milestones"],
                now=now,
                default_branch=repo.default_branch,
                policy=Policy(cfg.pr_age_days, cfg.pr_idle_days, cfg.ci_failure_threshold),
            )
            snapshot_coverage = {key: dict(value) for key, value in metadata.items()}
            metric_keys = {
                "issues": ["open_issues", "labeled_bug_reports", "issue_age_bins"],
                "pulls": ["open_prs", "prs_needing_attention"],
                "workflows": ["ci_completed", "ci_failures", "ci_conclusions"],
                "milestones": [],
            }
            subject_types = {
                "issues": "issue",
                "pulls": "pull_request",
                "workflows": "workflow_run",
                "milestones": "milestone",
            }
            for endpoint, values in parsed.items():
                if values is not None or previous is None:
                    continue
                old_meta = previous.coverage.get(endpoint, {})
                if not old_meta.get("observed_at"):
                    continue
                snapshot_coverage[endpoint] = {
                    **old_meta,
                    "retained": True,
                    "last_attempt_error": metadata[endpoint].get("error"),
                    "last_attempt_coverage": "unavailable",
                }
                for metric in metric_keys[endpoint]:
                    metrics[metric] = previous.metrics.get(metric)
                old_findings = db.scalars(
                    select(Finding).where(
                        Finding.sync_run_id == previous.sync_run_id,
                        Finding.subject_type == subject_types[endpoint],
                    )
                ).all()
                for old in old_findings:
                    findings.append(
                        {
                            column.name: getattr(old, column.name)
                            for column in Finding.__table__.columns
                            if column.name not in ("id", "repo_id", "sync_run_id")
                        }
                    )
            db.add(
                Snapshot(
                    repo_id=repo.id,
                    sync_run_id=run.id,
                    observed_at=now,
                    metrics=metrics,
                    coverage=snapshot_coverage,
                )
            )
            db.add_all(Finding(repo_id=repo.id, sync_run_id=run.id, **f) for f in findings)
        db.commit()
        event("sync_finished", repository=full_name, status=run.status, rows=run.rows_processed)
        return {
            "repository": full_name,
            "status": run.status,
            "rows": run.rows_processed,
            "endpoints": metadata,
        }
    finally:
        if owned:
            await client.client.aclose()
