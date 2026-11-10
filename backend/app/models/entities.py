from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    BigInteger,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Repository(Base):
    __tablename__ = "repositories"
    id: Mapped[int] = mapped_column(primary_key=True)
    github_id: Mapped[int | None] = mapped_column(BigInteger, unique=True)
    full_name: Mapped[str] = mapped_column(String(200), unique=True)
    owner: Mapped[str] = mapped_column(String(100))
    name: Mapped[str] = mapped_column(String(100))
    default_branch: Mapped[str | None] = mapped_column(String(200))
    html_url: Mapped[str | None] = mapped_column(Text)
    enabled: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class SyncRun(Base):
    __tablename__ = "sync_runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    repo_id: Mapped[int] = mapped_column(ForeignKey("repositories.id"), index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), default="running")
    coverage: Mapped[str] = mapped_column(String(20), default="unavailable")
    endpoints: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    rows_processed: Mapped[int] = mapped_column(default=0)
    total_pages: Mapped[int] = mapped_column(default=0)
    error_summary: Mapped[str | None] = mapped_column(Text)


class RecordMixin:
    id: Mapped[int] = mapped_column(primary_key=True)
    repo_id: Mapped[int] = mapped_column(ForeignKey("repositories.id"), index=True)
    github_id: Mapped[int] = mapped_column(BigInteger)
    html_url: Mapped[str] = mapped_column(Text)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Issue(RecordMixin, Base):
    __tablename__ = "issues"
    __table_args__ = (
        UniqueConstraint("repo_id", "github_id"),
        Index("ix_issue_repo_updated", "repo_id", "updated_at"),
    )
    number: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(Text)
    state: Mapped[str] = mapped_column(String(20))
    labels: Mapped[list] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    milestone_github_id: Mapped[int | None] = mapped_column(BigInteger)


class PullRequest(RecordMixin, Base):
    __tablename__ = "pull_requests"
    __table_args__ = (
        UniqueConstraint("repo_id", "github_id"),
        Index("ix_pr_repo_updated", "repo_id", "updated_at"),
    )
    number: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(Text)
    state: Mapped[str] = mapped_column(String(20))
    draft: Mapped[bool] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    merged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    requested_reviewers: Mapped[list] = mapped_column(JSON)


class WorkflowRun(RecordMixin, Base):
    __tablename__ = "workflow_runs"
    __table_args__ = (
        UniqueConstraint("repo_id", "github_id"),
        Index("ix_workflow_repo_updated", "repo_id", "updated_at"),
    )
    name: Mapped[str] = mapped_column(Text)
    event: Mapped[str] = mapped_column(String(100))
    branch: Mapped[str | None] = mapped_column(String(300))
    status: Mapped[str] = mapped_column(String(30))
    conclusion: Mapped[str | None] = mapped_column(String(30))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    run_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Milestone(RecordMixin, Base):
    __tablename__ = "milestones"
    __table_args__ = (UniqueConstraint("repo_id", "github_id"),)
    title: Mapped[str] = mapped_column(Text)
    state: Mapped[str] = mapped_column(String(20))
    due_on: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    open_issues: Mapped[int] = mapped_column()
    closed_issues: Mapped[int] = mapped_column()


class Snapshot(Base):
    __tablename__ = "sync_snapshots"
    id: Mapped[int] = mapped_column(primary_key=True)
    repo_id: Mapped[int] = mapped_column(ForeignKey("repositories.id"), index=True)
    sync_run_id: Mapped[int] = mapped_column(ForeignKey("sync_runs.id"), unique=True)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    metrics: Mapped[dict] = mapped_column(JSON)
    coverage: Mapped[dict] = mapped_column(JSON)


class Finding(Base):
    __tablename__ = "risk_findings"
    id: Mapped[int] = mapped_column(primary_key=True)
    repo_id: Mapped[int] = mapped_column(ForeignKey("repositories.id"), index=True)
    sync_run_id: Mapped[int] = mapped_column(ForeignKey("sync_runs.id"), index=True)
    rule_id: Mapped[str] = mapped_column(String(80))
    rule_version: Mapped[str] = mapped_column(String(20))
    subject_type: Mapped[str] = mapped_column(String(40))
    subject_id: Mapped[str] = mapped_column(String(100))
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    evidence_url: Mapped[str] = mapped_column(Text)
    observation: Mapped[str] = mapped_column(Text)
    explanation: Mapped[str] = mapped_column(Text)
    recommendation: Mapped[str] = mapped_column(Text)
    limitations: Mapped[str] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(String(30))
