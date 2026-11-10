from collections import Counter
from dataclasses import dataclass
from datetime import datetime

from app.schemas.github import IssueSource, MilestoneSource, PRSource, WorkflowSource

VERSION = "1.0"
LIMITATION = (
    "An attention indicator is not evidence of delay, code quality, or production availability."
)


@dataclass
class Policy:
    pr_age_days: int = 14
    pr_idle_days: int = 14
    ci_failure_threshold: int = 3


def analyze(
    *,
    issues: list[IssueSource] | None,
    pulls: list[PRSource] | None,
    workflows: list[WorkflowSource] | None,
    milestones: list[MilestoneSource] | None,
    now: datetime,
    default_branch: str,
    policy: Policy,
):
    findings = []

    def finding(
        rule, item, subject, observation, explanation, recommendation, severity="attention"
    ):
        findings.append(
            dict(
                rule_id=rule,
                rule_version=VERSION,
                subject_type=subject,
                subject_id=str(item.id),
                observed_at=now,
                evidence_url=item.html_url,
                observation=observation,
                explanation=explanation,
                recommendation=recommendation,
                limitations=LIMITATION,
                severity=severity,
            )
        )

    open_issues = [i for i in issues if i.state == "open"] if issues is not None else None
    open_pulls = [p for p in pulls if p.state == "open"] if pulls is not None else None
    attention = 0
    for p in open_pulls or []:
        age = max(0, (now - p.created_at).days)
        idle = max(0, (now - p.updated_at).days)
        if not p.draft and (age >= policy.pr_age_days or idle >= policy.pr_idle_days):
            attention += 1
            finding(
                "pr_age",
                p,
                "pull_request",
                f"PR #{p.number} has been open for {age} days; last updated {idle} days ago.",
                f"Exceeds the configured age ({policy.pr_age_days} days) or inactivity ({policy.pr_idle_days} days) threshold. Updated time is not review time.",
                "Open the pull request and check review requests, discussion, and current priority.",
            )
    completed = (
        [w for w in workflows if w.status == "completed" and w.head_branch == default_branch]
        if workflows is not None
        else None
    )
    conclusions = (
        dict(Counter(w.conclusion or "unknown" for w in completed))
        if completed is not None
        else None
    )
    failures = [w for w in completed or [] if w.conclusion == "failure"]
    if len(failures) >= policy.ci_failure_threshold:
        finding(
            "ci_repeated_failure",
            failures[0],
            "workflow_run",
            f"{len(failures)} completed workflow runs concluded failure in the collected default-branch window.",
            f"The configured threshold is {policy.ci_failure_threshold}; all event types are included. This does not measure production uptime.",
            "Inspect the linked run and recurring failed jobs before drawing conclusions.",
        )
    for m in milestones or []:
        if m.state == "open" and m.due_on is not None and m.due_on < now and m.open_issues > 0:
            finding(
                "milestone_due",
                m,
                "milestone",
                f"Milestone “{m.title}” passed its due date with {m.open_issues} tracked items open.",
                "A GitHub milestone due date is not necessarily a client delivery deadline.",
                "Review the remaining tracked items and confirm whether the milestone date is current.",
            )
    bins = (
        {"0–6 days": 0, "7–13 days": 0, "14–29 days": 0, "30+ days": 0}
        if open_issues is not None
        else None
    )
    for i in open_issues or []:
        age = max(0, (now - i.created_at).days)
        label = (
            "0–6 days"
            if age < 7
            else "7–13 days"
            if age < 14
            else "14–29 days"
            if age < 30
            else "30+ days"
        )
        bins[label] += 1
    metrics = dict(
        open_issues=len(open_issues) if open_issues is not None else None,
        open_prs=len(open_pulls) if open_pulls is not None else None,
        prs_needing_attention=attention if pulls is not None else None,
        labeled_bug_reports=sum(
            any(label.get("name", "").lower() == "bug" for label in i.labels) for i in open_issues
        )
        if open_issues is not None
        else None,
        issue_age_bins=bins,
        ci_completed=len(completed) if completed is not None else None,
        ci_failures=len(failures) if completed is not None else None,
        ci_conclusions=conclusions,
    )
    return metrics, findings
