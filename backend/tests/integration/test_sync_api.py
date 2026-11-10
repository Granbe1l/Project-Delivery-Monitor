import os
from datetime import UTC, datetime, timedelta

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.collectors.github import GitHubClient
from app.db.session import get_db
from app.main import app
from app.models.entities import Base, Issue, PullRequest, Snapshot, SyncRun
from app.services.sync import synchronize
from tests.fixtures.data import issue, milestone, pull, repository, workflow


@pytest.fixture
def db():
    url = os.environ.get(
        "TEST_DATABASE_URL", "postgresql+psycopg://pdm:pdm_local_only@localhost:5432/pdm_test"
    )
    engine = create_engine(url)
    assert engine.url.database.endswith("_test"), (
        "Integration tests require a dedicated *_test database"
    )
    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())
    with Session(engine, expire_on_commit=False) as session:
        yield session
    engine.dispose()


def transport(fail=None, partial=False):
    def handler(r):
        endpoint = r.url.path.split("/")[-1]
        if endpoint == fail or fail == "all":
            return httpx.Response(403, json={"message": "TEST DATA denied"})
        data = {
            "streamlit": repository(),
            "issues": [issue(), dict(pull(), pull_request={})],
            "pulls": [pull()],
            "runs": {"workflow_runs": [workflow()]},
            "milestones": [milestone()],
        }.get(endpoint)
        headers = (
            {"Link": f'<https://api.github.com{r.url.path}?page=2>; rel="next"'}
            if partial and endpoint == "issues"
            else {}
        )
        return httpx.Response(200, json=data, headers=headers)

    return httpx.MockTransport(handler)


async def sync(db, **kwargs):
    async with GitHubClient(transport=transport(**kwargs)) as client:
        return await synchronize(db, "streamlit/streamlit", client)


@pytest.fixture
def api_client(db):
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


async def test_idempotency_and_snapshot_observation(db, api_client):
    first = await sync(db)
    second = await sync(db)
    assert first["status"] == second["status"] == "success"
    assert db.scalar(select(func.count()).select_from(Issue)) == 1
    assert db.scalar(select(func.count()).select_from(PullRequest)) == 1
    assert db.scalar(select(func.count()).select_from(Snapshot)) == 2
    project_id = db.scalar(select(Issue.repo_id))
    overview = api_client.get(f"/api/projects/{project_id}/overview").json()
    assert overview["metrics"]["open_issues"] == 1
    assert overview["metrics"]["open_prs"] == 1
    assert overview["metrics"]["labeled_bug_reports"] == 1
    for endpoint in ["issues", "pull-requests", "ci", "milestones", "findings", "trends", "brief"]:
        result = api_client.get(f"/api/projects/{project_id}/{endpoint}")
        assert result.status_code == 200, result.text
    assert api_client.get(f"/api/projects/{project_id}/issues?q=missing").json()["items"] == []
    assert api_client.get(f"/api/projects/{project_id}/issues?page_size=101").status_code == 422
    assert api_client.get("/api/projects/999999/overview").status_code == 404
    assert api_client.get("/health/ready").json()["database"] == "available"


async def test_failed_sync_preserves_snapshot_and_records(db, api_client):
    await sync(db)
    snap = db.scalar(select(Snapshot))
    project_id = snap.repo_id
    before = snap.observed_at
    result = await sync(db, fail="all")
    assert result["status"] == "failure"
    assert db.scalar(select(func.count()).select_from(Snapshot)) == 1
    data = api_client.get(f"/api/projects/{project_id}/overview").json()
    assert data["last_attempt_status"] == "failure" and data["metrics"]["open_issues"] == 1
    assert datetime.fromisoformat(data["observed_at"]) == before
    assert db.scalar(select(func.count()).select_from(Issue)) == 1


async def test_endpoint_failure_and_partial_coverage(db, api_client):
    result = await sync(db, fail="pulls", partial=True)
    assert result["status"] == "partial"
    snap = db.scalar(select(Snapshot))
    assert snap.metrics["open_prs"] is None
    assert snap.metrics["open_issues"] == 1
    assert snap.coverage["issues"]["coverage"] == "partial"
    data = api_client.get(f"/api/projects/{snap.repo_id}/pull-requests").json()
    assert data["coverage"] == "unavailable" and data["items"] == []
    assert db.scalar(select(SyncRun)).total_pages >= 4


async def test_stale_and_empty_states(db, api_client):
    await sync(db, fail="all")
    run = db.scalar(select(SyncRun))
    data = api_client.get(f"/api/projects/{run.repo_id}/overview").json()
    assert data["metrics"] is None and data["status"] == "unavailable"
    await sync(db)
    snap = db.scalar(select(Snapshot))
    snap.observed_at = datetime.now(UTC) - timedelta(days=2)
    db.commit()
    data = api_client.get(f"/api/projects/{run.repo_id}/overview").json()
    assert data["stale"] is True
    assert any(
        f["rule_id"] == "freshness"
        for f in api_client.get(f"/api/projects/{run.repo_id}/findings").json()
    )


async def test_allowlist_and_read_only(db, api_client):
    with pytest.raises(ValueError):
        await synchronize(db, "private/unapproved")
    assert api_client.post("/api/projects").status_code == 405
    assert api_client.get("/api/projects/1/issues?state=invalid").status_code == 422


async def test_endpoint_failure_retains_prior_observation(db, api_client):
    await sync(db)
    first = db.scalar(select(Snapshot))
    result = await sync(db, fail="pulls")
    assert result["status"] == "partial"
    data = api_client.get(f"/api/projects/{first.repo_id}/overview").json()
    assert data["metrics"]["open_prs"] == 1
    assert data["coverage"]["pulls"]["retained"] is True
    rows = api_client.get(f"/api/projects/{first.repo_id}/pull-requests").json()
    assert rows["coverage"] == "retained" and len(rows["items"]) == 1
    assert datetime.fromisoformat(rows["observed_at"]) == first.observed_at


async def test_repository_lock_prevents_overlapping_sync(db):
    from sqlalchemy import text

    from app.models.entities import Repository
    from app.services.sync import ensure_repositories

    ensure_repositories(db)
    repo_id = db.scalar(select(Repository.id).where(Repository.full_name == "streamlit/streamlit"))
    db.commit()
    with Session(db.bind) as other:
        other.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": repo_id})
        result = await sync(db)
        assert result["status"] == "busy"
        other.rollback()
