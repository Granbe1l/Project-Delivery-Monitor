from datetime import timedelta

import pytest

from app.risk_engine.engine import Policy, analyze
from app.schemas.github import IssueSource, MilestoneSource, PRSource, WorkflowSource
from tests.fixtures.data import NOW, issue, milestone, pull, workflow


def run(**kwargs):
    values = dict(
        issues=[],
        pulls=[],
        workflows=[],
        milestones=[],
        now=NOW,
        default_branch="main",
        policy=Policy(),
    )
    values.update(kwargs)
    return analyze(**values)


def test_unknown_not_zero():
    metrics, findings = run(issues=None, pulls=None, workflows=None, milestones=None)
    assert metrics["open_issues"] is None and metrics["ci_completed"] is None
    assert metrics["prs_needing_attention"] is None and not findings


def test_draft_excluded_and_age_distinct_from_idle():
    m, f = run(pulls=[PRSource.model_validate(pull(draft=True))])
    assert m["prs_needing_attention"] == 0 and f == []
    m, f = run(pulls=[PRSource.model_validate(pull(updated_at=NOW.isoformat()))])
    assert m["prs_needing_attention"] == 1
    assert "20 days" in f[0]["observation"] and "0 days ago" in f[0]["observation"]
    assert all(
        f[0].get(k)
        for k in [
            "evidence_url",
            "observed_at",
            "rule_id",
            "rule_version",
            "recommendation",
            "limitations",
        ]
    )


@pytest.mark.parametrize("days,expected", [(13, 0), (14, 1), (15, 1)])
def test_threshold_boundary(days, expected):
    m, _ = run(
        pulls=[
            PRSource.model_validate(
                pull(
                    created_at=(NOW - timedelta(days=days)).isoformat(), updated_at=NOW.isoformat()
                )
            )
        ]
    )
    assert m["prs_needing_attention"] == expected


def test_completed_default_branch_denominator_and_categories():
    runs = [
        workflow(id=i + 1, conclusion=c)
        for i, c in enumerate(
            ["failure", "success", "cancelled", "skipped", "timed_out", "neutral", None]
        )
    ]
    runs += [
        workflow(id=90, status="in_progress", conclusion=None),
        workflow(id=91, head_branch="feature"),
    ]
    m, f = run(workflows=[WorkflowSource.model_validate(w) for w in runs])
    assert m["ci_completed"] == 7 and m["ci_failures"] == 1
    assert m["ci_conclusions"]["cancelled"] == 1 and m["ci_conclusions"]["unknown"] == 1
    assert not f


def test_repeated_ci_failure():
    _, f = run(workflows=[WorkflowSource.model_validate(workflow(id=i)) for i in range(3)])
    assert len(f) == 1 and f[0]["rule_id"] == "ci_repeated_failure"


def test_milestone_null_and_past_due():
    _, f = run(milestones=[MilestoneSource.model_validate(milestone())])
    assert not f
    _, f = run(
        milestones=[
            MilestoneSource.model_validate(milestone(due_on=(NOW - timedelta(days=1)).isoformat()))
        ]
    )
    assert f[0]["rule_id"] == "milestone_due"


def test_issue_age_and_labeled_report():
    m, _ = run(issues=[IssueSource.model_validate(issue())])
    assert m["open_issues"] == 1 and m["labeled_bug_reports"] == 1
    assert m["issue_age_bins"]["14–29 days"] == 1


@pytest.mark.parametrize(
    "url",
    [
        "http://github.com/a",
        "https://evil.test/a",
        "https://github.com.evil.test/a",
        "https://user@github.com/a",
    ],
)
def test_unsafe_evidence_rejected(url):
    with pytest.raises(ValueError):
        PRSource.model_validate(pull(html_url=url))


def test_timezone_required_and_utc_parsing():
    with pytest.raises(ValueError):
        PRSource.model_validate(pull(created_at="2026-01-01T00:00:00"))
    p = PRSource.model_validate(pull(created_at="2026-01-01T00:00:00Z"))
    assert p.created_at.utcoffset().total_seconds() == 0
