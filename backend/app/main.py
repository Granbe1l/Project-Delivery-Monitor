import logging
from datetime import UTC, datetime, timedelta
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import func, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session as DBSession

from app.core.config import settings
from app.db.session import get_db
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
from app.schemas.api import (
    BriefOut,
    FindingOut,
    HealthOut,
    IssueOut,
    MilestoneOut,
    OverviewOut,
    PageOut,
    ProjectOut,
    PullOut,
    TrendsOut,
    WorkflowOut,
)

logging.basicConfig(level=settings().log_level)
app = FastAPI(title="Project Delivery Monitor", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[x.strip() for x in settings().cors_origins.split(",")],
    allow_methods=["GET"],
    allow_headers=["Accept", "Content-Type"],
)


@app.middleware("http")
async def headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


@app.exception_handler(SQLAlchemyError)
async def database_error(request, exc):
    logging.getLogger("pdm").error("database_unavailable: %s", type(exc).__name__)
    return JSONResponse(
        {"detail": "Database unavailable. Please try again later."}, status_code=503
    )


@app.get("/health", response_model=HealthOut)
def health():
    return {"status": "alive", "database": "not_checked"}


@app.get("/health/ready", response_model=HealthOut)
def ready(db: DBSession = Depends(get_db)):
    db.execute(text("SELECT 1"))
    db.scalar(select(Repository.id).limit(1))
    return {"status": "ready", "database": "available"}


@app.get("/api/projects", response_model=list[ProjectOut])
def projects(db: DBSession = Depends(get_db)):
    return db.scalars(
        select(Repository).where(Repository.enabled.is_(True)).order_by(Repository.id)
    ).all()


def project(db, project_id):
    p = db.get(Repository, project_id)
    if p is None:
        raise HTTPException(404, "Project not found")
    return p


def snapshot(db, project_id):
    return db.scalar(
        select(Snapshot)
        .where(Snapshot.repo_id == project_id)
        .order_by(Snapshot.observed_at.desc())
        .limit(1)
    )


def overview(db, project_id):
    p = project(db, project_id)
    snap = snapshot(db, project_id)
    last = db.scalar(
        select(SyncRun)
        .where(SyncRun.repo_id == project_id)
        .order_by(SyncRun.started_at.desc())
        .limit(1)
    )
    success = db.scalar(
        select(SyncRun.finished_at)
        .where(SyncRun.repo_id == project_id, SyncRun.status == "success")
        .order_by(SyncRun.finished_at.desc())
        .limit(1)
    )
    observed_times = (
        [snap.observed_at]
        + [
            datetime.fromisoformat(meta["observed_at"])
            for meta in snap.coverage.values()
            if meta.get("observed_at")
        ]
        if snap
        else []
    )
    stale = any(
        (datetime.now(UTC) - at).total_seconds() > settings().sync_stale_hours * 3600
        for at in observed_times
    )
    return dict(
        project=p,
        observed_at=snap.observed_at if snap else None,
        last_successful_sync_at=success,
        last_attempt_at=last.started_at if last else None,
        last_attempt_status=last.status if last else None,
        stale=stale,
        status="unavailable" if snap is None else "stale" if stale else "available",
        coverage=snap.coverage if snap else (last.endpoints if last else {}),
        metrics=snap.metrics if snap else None,
        policy=dict(
            pr_age_days=settings().pr_age_days,
            pr_idle_days=settings().pr_idle_days,
            ci_failure_threshold=settings().ci_failure_threshold,
            stale_hours=settings().sync_stale_hours,
        ),
        scope="Observed open issues and PRs; workflow runs from the 30 days preceding sync, default branch for overview, all event types. Counts describe collected records, not necessarily repository totals.",
    )


@app.get("/api/projects/{project_id}/overview", response_model=OverviewOut)
def get_overview(project_id: int, db: DBSession = Depends(get_db)):
    return overview(db, project_id)


def records(
    db, project_id, model, endpoint, page, page_size, q="", state="all", period=None, branch=None
):
    project(db, project_id)
    snap = snapshot(db, project_id)
    meta = snap.coverage.get(endpoint, {}) if snap else {}
    if not snap or meta.get("coverage") == "unavailable":
        return dict(
            items=[],
            total_in_observation=0,
            page=page,
            page_size=page_size,
            coverage="unavailable",
            observed_at=None,
        )
    stmt = select(model).where(
        model.repo_id == project_id,
        model.last_seen_at == datetime.fromisoformat(meta["observed_at"]),
    )
    title = model.name if model is WorkflowRun else model.title
    if q:
        stmt = stmt.where(title.icontains(q, autoescape=True))
    if state != "all" and hasattr(model, "state"):
        stmt = stmt.where(model.state == state)
    if period and hasattr(model, "created_at"):
        stmt = stmt.where(
            model.created_at >= datetime.fromisoformat(meta["observed_at"]) - timedelta(days=period)
        )
    if branch and model is WorkflowRun:
        stmt = stmt.where(model.branch == branch)
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    sort = model.created_at.desc() if hasattr(model, "created_at") else model.id.desc()
    items = db.scalars(
        stmt.order_by(sort, model.id).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return dict(
        items=items,
        total_in_observation=total,
        page=page,
        page_size=page_size,
        coverage="retained" if meta.get("retained") else meta.get("coverage", "unavailable"),
        observed_at=meta.get("observed_at"),
    )


@app.get("/api/projects/{project_id}/issues", response_model=PageOut[IssueOut])
def issues(
    project_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    q: str = Query("", max_length=200),
    state: Literal["all", "open", "closed"] = "all",
    period: int | None = Query(None, ge=1, le=365),
    db: DBSession = Depends(get_db),
):
    return records(db, project_id, Issue, "issues", page, page_size, q, state, period)


@app.get("/api/projects/{project_id}/pull-requests", response_model=PageOut[PullOut])
def pulls(
    project_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    q: str = Query("", max_length=200),
    state: Literal["all", "open", "closed"] = "all",
    period: int | None = Query(None, ge=1, le=365),
    db: DBSession = Depends(get_db),
):
    return records(db, project_id, PullRequest, "pulls", page, page_size, q, state, period)


@app.get("/api/projects/{project_id}/ci", response_model=PageOut[WorkflowOut])
def ci(
    project_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    q: str = Query("", max_length=200),
    period: int = Query(30, ge=1, le=30),
    branch: str | None = Query(None, max_length=300),
    db: DBSession = Depends(get_db),
):
    return records(
        db, project_id, WorkflowRun, "workflows", page, page_size, q=q, period=period, branch=branch
    )


@app.get("/api/projects/{project_id}/milestones", response_model=PageOut[MilestoneOut])
def milestones(
    project_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: DBSession = Depends(get_db),
):
    return records(db, project_id, Milestone, "milestones", page, page_size)


def findings(db, project_id):
    info = overview(db, project_id)
    snap = snapshot(db, project_id)
    values = (
        list(
            db.scalars(
                select(Finding).where(Finding.sync_run_id == snap.sync_run_id).order_by(Finding.id)
            )
        )
        if snap
        else []
    )
    if info["stale"] and info["project"].html_url:
        values.append(
            dict(
                rule_id="freshness",
                rule_version="1.0",
                subject_type="repository",
                subject_id=str(project_id),
                observed_at=snap.observed_at,
                evidence_url=info["project"].html_url,
                observation="Stored observations are older than the configured freshness threshold.",
                explanation="The current repository state may differ from this saved observation.",
                recommendation="Ask the operator to check the scheduled collector and run a new sync.",
                limitations="Freshness describes this monitor, not repository health.",
                severity="attention",
            )
        )
    return values


@app.get("/api/projects/{project_id}/findings", response_model=list[FindingOut])
def get_findings(project_id: int, db: DBSession = Depends(get_db)):
    return findings(db, project_id)


@app.get("/api/projects/{project_id}/trends", response_model=TrendsOut)
def trends(project_id: int, period: int = Query(30, ge=1, le=365), db: DBSession = Depends(get_db)):
    project(db, project_id)
    rows = db.scalars(
        select(Snapshot)
        .where(
            Snapshot.repo_id == project_id,
            Snapshot.observed_at >= datetime.now(UTC) - timedelta(days=period),
        )
        .order_by(Snapshot.observed_at)
    ).all()
    return dict(
        status="available" if len(rows) >= 2 else "insufficient_data",
        points=[
            dict(observed_at=r.observed_at, metrics=r.metrics, coverage=r.coverage) for r in rows
        ],
        limitation="These are observations at sync time. Partial or changing coverage is not a comparable repository-wide trend; no past observations are fabricated.",
    )


@app.get("/api/projects/{project_id}/brief", response_model=BriefOut)
def brief(project_id: int, db: DBSession = Depends(get_db)):
    return dict(
        title="Project Intelligence Brief",
        overview=overview(db, project_id),
        findings=findings(db, project_id),
        limitations=[
            "Public GitHub activity does not establish code quality, client deadlines, costs, or production availability.",
            "Open issues and PRs are collected with a bounded page budget. Closed-event trends and review timelines are not collected.",
            "Workflow counts use completed default-branch runs from the collected 30-day window; other conclusions stay separate.",
            "Thresholds are demonstration policies, not industry standards.",
        ],
    )
