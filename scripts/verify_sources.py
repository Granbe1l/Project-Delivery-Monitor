"""Read-only comparison of current stored samples with public GitHub evidence.

From backend/: .venv/bin/python ../scripts/verify_sources.py --output <report.json>.
Uses the existing DB configuration; never seeds records or triggers synchronization.
"""

import argparse
import asyncio
import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

import httpx
from sqlalchemy import func, select

from app.collectors.github import API, GitHubClient
from app.db.session import Session
from app.models.entities import (
    Issue,
    Milestone,
    PullRequest,
    Repository,
    Snapshot,
    WorkflowRun,
)


async def verify():
    checks, counts = [], []
    async with (
        GitHubClient() as client,
        httpx.AsyncClient(
            headers={
                "Accept": "text/html",
                "User-Agent": "Project-Delivery-Monitor-verification/0.1",
            },
            timeout=30,
        ) as web,
    ):
        with Session() as db:
            for repo in db.scalars(select(Repository).order_by(Repository.id)):
                snap = db.scalar(
                    select(Snapshot)
                    .where(Snapshot.repo_id == repo.id)
                    .order_by(Snapshot.observed_at.desc())
                    .limit(1)
                )
                for kind, endpoint, model in [
                    ("issue", "issues", Issue),
                    ("pull_request", "pulls", PullRequest),
                    ("workflow_run", "workflows", WorkflowRun),
                    ("milestone", "milestones", Milestone),
                ]:
                    meta = snap.coverage.get(endpoint, {}) if snap else {}
                    if not meta.get("observed_at"):
                        checks.append(
                            {
                                "repo": repo.full_name,
                                "type": kind,
                                "error": "No observed source data",
                            }
                        )
                        continue
                    stmt = select(model).where(
                        model.repo_id == repo.id,
                        model.last_seen_at == datetime.fromisoformat(meta["observed_at"]),
                    )
                    if model is WorkflowRun:
                        stmt = stmt.where(model.status == "completed")
                    row = db.scalar(stmt.order_by(model.github_id.desc()).limit(1))
                    if row is None:
                        checks.append(
                            {
                                "repo": repo.full_name,
                                "type": kind,
                                "error": "No sample in collected scope",
                            }
                        )
                        continue
                    path = {
                        "issue": f"/issues/{getattr(row, 'number', 0)}",
                        "pull_request": f"/pulls/{getattr(row, 'number', 0)}",
                        "workflow_run": f"/actions/runs/{row.github_id}",
                        "milestone": f"/milestones/{urlsplit(row.html_url).path.rsplit('/', 1)[-1]}",
                    }[kind]
                    response, source = await client.get(f"{API}/repos/{repo.full_name}{path}")
                    stored = {"id": row.github_id, "html_url": row.html_url}
                    if model is WorkflowRun:
                        stored.update(name=row.name, status=row.status, conclusion=row.conclusion)
                    else:
                        stored["title"] = row.title
                    check = {
                        "repo": repo.full_name,
                        "type": kind,
                        "github_id": row.github_id,
                        "evidence_url": row.html_url,
                        "observed_at": row.last_seen_at.isoformat(),
                        "checked_at": datetime.now(UTC).isoformat(),
                        "api_status": response.status_code,
                        "matching_fields": {
                            key: value == source.get(key) for key, value in stored.items()
                        },
                    }
                    if kind == "issue":
                        page = await web.get(row.html_url)
                        check["source_page_http_status"] = page.status_code
                    checks.append(check)
                counts.append(
                    {
                        "repo": repo.full_name,
                        "records": {
                            model.__tablename__: db.scalar(
                                select(func.count())
                                .select_from(model)
                                .where(model.repo_id == repo.id)
                            )
                            for model in [Issue, PullRequest, WorkflowRun, Milestone]
                        },
                        "snapshots": db.scalar(
                            select(func.count())
                            .select_from(Snapshot)
                            .where(Snapshot.repo_id == repo.id)
                        ),
                    }
                )
            duplicates = {
                model.__tablename__: len(
                    db.execute(
                        select(model.repo_id, model.github_id)
                        .group_by(model.repo_id, model.github_id)
                        .having(func.count() > 1)
                    ).all()
                )
                for model in [Issue, PullRequest, WorkflowRun, Milestone]
            }
    passed = all(
        "error" not in c
        and all(c["matching_fields"].values())
        and c.get("source_page_http_status", 200) == 200
        for c in checks
    ) and not any(duplicates.values())
    return {
        "checked_at": datetime.now(UTC).isoformat(),
        "passed": passed,
        "source_checks": checks,
        "database_counts": counts,
        "duplicate_key_groups": duplicates,
        "limitation": "Only sampled records were compared. GitHub may change after collection; a differing mutable field requires inspecting source update time, not silently overwriting the saved observation.",
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = asyncio.run(verify())
    args.output.write_text(json.dumps(result, indent=2) + "\n")
    print(
        json.dumps(
            {
                "passed": result["passed"],
                "samples": len(result["source_checks"]),
                "duplicates": result["duplicate_key_groups"],
            }
        )
    )
    raise SystemExit(0 if result["passed"] else 1)
