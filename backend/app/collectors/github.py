import asyncio
import random
import time
from dataclasses import dataclass, field
from urllib.parse import urlsplit

import httpx

from app.core.config import settings

API = "https://api.github.com"


class GitHubError(Exception):
    def __init__(self, code: str, status: int | None = None, headers=None):
        self.code, self.status = code, status
        headers = headers or {}
        self.rate_remaining = headers.get("x-ratelimit-remaining")
        self.rate_reset = headers.get("x-ratelimit-reset")
        self.retry_after = headers.get("retry-after")
        super().__init__(code)


@dataclass
class Collection:
    items: list = field(default_factory=list)
    pages: int = 0
    coverage: str = "complete"
    http_status: int | None = None
    error: str | None = None
    rate_remaining: str | None = None
    rate_reset: str | None = None
    retry_after: str | None = None

    def metadata(self):
        return {k: v for k, v in self.__dict__.items() if k != "items"}


class GitHubClient:
    def __init__(self, transport=None, budget=None, sleep=asyncio.sleep):
        cfg = settings()
        self.budget = budget if budget is not None else cfg.sync_request_budget
        self.sleep = sleep
        headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "Project-Delivery-Monitor/0.1",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if cfg.github_token:
            headers["Authorization"] = f"Bearer {cfg.github_token}"
        self.client = httpx.AsyncClient(
            headers=headers, timeout=20, transport=transport, follow_redirects=False
        )

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        await self.client.aclose()

    async def get(self, url):
        u = urlsplit(url)
        if u.scheme != "https" or u.netloc != "api.github.com":
            raise GitHubError("unsafe_pagination_url")
        for attempt in range(3):
            if self.budget <= 0:
                raise GitHubError("request_budget_exhausted")
            self.budget -= 1
            try:
                r = await self.client.get(url)
            except httpx.ProxyError:
                raise GitHubError("proxy_connection_denied") from None
            except (httpx.TimeoutException, httpx.NetworkError):
                if attempt == 2:
                    raise GitHubError("network_or_proxy_unavailable") from None
                await self.sleep(2**attempt + random.random())
                continue
            if r.status_code == 304:
                raise GitHubError("unexpected_304_without_cache", 304)
            if r.status_code == 200:
                try:
                    return r, r.json()
                except ValueError:
                    raise GitHubError("invalid_json", 200) from None
            limited = r.status_code == 429 or (
                r.status_code == 403
                and (r.headers.get("x-ratelimit-remaining") == "0" or "retry-after" in r.headers)
            )
            if limited or r.status_code in (500, 502, 503, 504):
                try:
                    delay = float(r.headers.get("retry-after", 2**attempt))
                    if r.headers.get("x-ratelimit-remaining") == "0":
                        delay = max(
                            delay, float(r.headers.get("x-ratelimit-reset", "0")) - time.time()
                        )
                except ValueError:
                    delay = 60
                if delay > 10 or attempt == 2:
                    raise GitHubError(
                        "rate_limited" if limited else "upstream_unavailable",
                        r.status_code,
                        r.headers,
                    )
                await self.sleep(max(0, delay) + random.random())
                continue
            raise GitHubError(
                "access_denied" if r.status_code in (401, 403) else "upstream_http_error",
                r.status_code,
            )
        raise GitHubError("upstream_unavailable")

    async def collect(self, path: str, max_pages: int, key=None):
        result = Collection()
        url = API + path
        for page in range(max_pages):
            try:
                response, data = await self.get(url)
                items = data.get(key) if key and isinstance(data, dict) else data
                if not isinstance(items, list) or not all(isinstance(x, dict) for x in items):
                    raise GitHubError("invalid_response_schema", response.status_code)
                result.items.extend(items)
                result.pages += 1
                result.http_status = response.status_code
                result.rate_remaining = response.headers.get("x-ratelimit-remaining")
                result.rate_reset = response.headers.get("x-ratelimit-reset")
                url = response.links.get("next", {}).get("url")
                if not url:
                    return result
            except GitHubError as exc:
                result.coverage = "partial" if result.pages else "unavailable"
                result.error, result.http_status = exc.code, exc.status
                result.rate_remaining = exc.rate_remaining or result.rate_remaining
                result.rate_reset = exc.rate_reset or result.rate_reset
                result.retry_after = exc.retry_after
                return result
        result.coverage = "partial"
        return result
