from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str
    default_branch: str | None
    html_url: str | None
    enabled: bool


class OverviewOut(BaseModel):
    project: ProjectOut
    observed_at: datetime | None
    last_successful_sync_at: datetime | None
    last_attempt_at: datetime | None
    last_attempt_status: str | None
    stale: bool
    status: str
    coverage: dict[str, Any]
    metrics: dict[str, Any] | None
    policy: dict[str, int]
    scope: str


class FindingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    rule_id: str
    rule_version: str
    subject_type: str
    subject_id: str
    observed_at: datetime
    evidence_url: str
    observation: str
    explanation: str
    recommendation: str
    limitations: str
    severity: str


class RecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    github_id: int
    html_url: str
    last_seen_at: datetime


class IssueOut(RecordOut):
    number: int
    title: str
    state: str
    labels: list[dict]
    created_at: datetime
    updated_at: datetime
    closed_at: datetime | None


class PullOut(RecordOut):
    number: int
    title: str
    state: str
    draft: bool
    created_at: datetime
    updated_at: datetime
    requested_reviewers: list[str]


class WorkflowOut(RecordOut):
    name: str
    branch: str | None
    event: str
    status: str
    conclusion: str | None
    created_at: datetime


class MilestoneOut(RecordOut):
    title: str
    state: str
    due_on: datetime | None
    open_issues: int
    closed_issues: int


class PageOut[T](BaseModel):
    items: list[T]
    total_in_observation: int
    page: int
    page_size: int
    coverage: str
    observed_at: datetime | None


class TrendPoint(BaseModel):
    observed_at: datetime
    metrics: dict[str, Any]
    coverage: dict[str, Any]


class TrendsOut(BaseModel):
    status: str
    points: list[TrendPoint]
    limitation: str


class BriefOut(BaseModel):
    title: str
    overview: OverviewOut
    findings: list[FindingOut]
    limitations: list[str]


class HealthOut(BaseModel):
    status: str
    database: str
