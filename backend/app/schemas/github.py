from urllib.parse import urlsplit

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator


class Source(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: int
    html_url: str

    @field_validator("html_url")
    @classmethod
    def safe_link(cls, value):
        u = urlsplit(value)
        if u.scheme != "https" or u.hostname != "github.com" or u.username or u.password or u.port:
            raise ValueError("Evidence must be an HTTPS github.com URL")
        return value


class RepoSource(Source):
    full_name: str
    default_branch: str


class ItemSource(Source):
    number: int
    title: str
    state: str
    created_at: AwareDatetime
    updated_at: AwareDatetime
    closed_at: AwareDatetime | None = None


class IssueSource(ItemSource):
    labels: list[dict] = Field(default_factory=list)
    milestone: dict | None = None


class PRSource(ItemSource):
    draft: bool = False
    merged_at: AwareDatetime | None = None
    requested_reviewers: list[dict] = Field(default_factory=list)


class WorkflowSource(Source):
    name: str | None = None
    event: str
    head_branch: str | None = None
    status: str
    conclusion: str | None = None
    created_at: AwareDatetime
    updated_at: AwareDatetime
    run_started_at: AwareDatetime | None = None


class MilestoneSource(Source):
    title: str
    state: str
    due_on: AwareDatetime | None = None
    open_issues: int
    closed_issues: int
