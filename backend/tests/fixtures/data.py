"""Synthetic TEST DATA. Never imported by application or inserted into the app database."""

from datetime import UTC, datetime, timedelta

NOW = datetime(2026, 11, 10, tzinfo=UTC)


def issue(**overrides):
    return dict(
        id=101,
        number=1,
        title="TEST DATA: tracked issue",
        state="open",
        html_url="https://github.com/streamlit/streamlit/issues/1",
        created_at=(NOW - timedelta(days=20)).isoformat(),
        updated_at=(NOW - timedelta(days=15)).isoformat(),
        closed_at=None,
        labels=[{"name": "bug"}],
        milestone=None,
        **overrides,
    )


def pull(**overrides):
    values = issue()
    values.update(
        id=201,
        number=2,
        title="TEST DATA: proposed change",
        html_url="https://github.com/streamlit/streamlit/pull/2",
        draft=False,
        merged_at=None,
        requested_reviewers=[{"login": "test-reviewer"}],
    )
    values.update(overrides)
    return values


def workflow(**overrides):
    values = dict(
        id=301,
        html_url="https://github.com/streamlit/streamlit/actions/runs/301",
        name="TEST DATA: checks",
        event="push",
        head_branch="main",
        status="completed",
        conclusion="failure",
        created_at=NOW.isoformat(),
        updated_at=NOW.isoformat(),
        run_started_at=None,
    )
    values.update(overrides)
    return values


def milestone(**overrides):
    values = dict(
        id=401,
        title="TEST DATA: milestone",
        html_url="https://github.com/streamlit/streamlit/milestone/1",
        state="open",
        due_on=None,
        open_issues=3,
        closed_issues=1,
    )
    values.update(overrides)
    return values


def repository():
    return dict(
        id=5001,
        full_name="streamlit/streamlit",
        default_branch="main",
        html_url="https://github.com/streamlit/streamlit",
    )


def at_observation_time(data, reference):
    """Move synthetic integration input dates together, preserving their relative ages."""
    if isinstance(data, list):
        return [at_observation_time(value, reference) for value in data]
    if isinstance(data, dict):
        timestamps = {
            "created_at",
            "updated_at",
            "closed_at",
            "merged_at",
            "run_started_at",
            "due_on",
        }
        return {
            key: (datetime.fromisoformat(value) + (reference - NOW)).isoformat()
            if key in timestamps and value is not None
            else at_observation_time(value, reference)
            for key, value in data.items()
        }
    return data
