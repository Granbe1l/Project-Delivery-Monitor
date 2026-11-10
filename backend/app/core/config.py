from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

REPOSITORIES = ("streamlit/streamlit", "apache/airflow", "vercel/next.js")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")
    database_url: str = "postgresql+psycopg://pdm:pdm_local_only@localhost:5432/pdm"
    github_token: str | None = None
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    sync_max_pages: int = Field(default=2, ge=1, le=50)
    sync_request_budget: int = Field(default=35, ge=1, le=1000)
    sync_stale_hours: int = Field(default=24, ge=1)
    pr_age_days: int = Field(default=14, ge=1)
    pr_idle_days: int = Field(default=14, ge=1)
    ci_failure_threshold: int = Field(default=3, ge=1)
    log_level: str = "INFO"


@lru_cache
def settings():
    return Settings()
