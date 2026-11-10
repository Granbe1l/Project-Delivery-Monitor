import httpx
import pytest

from app.collectors.github import API, GitHubClient, GitHubError


async def no_sleep(_):
    pass


@pytest.mark.parametrize("status", [401, 403, 404, 304])
async def test_no_retry_permanent_or_uncached(status):
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(status, json={})

    async with GitHubClient(transport=httpx.MockTransport(handler), sleep=no_sleep) as c:
        with pytest.raises(GitHubError):
            await c.get(API + "/repos/x/y")
    assert len(calls) == 1


async def test_transient_retry_then_success():
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(503 if len(calls) < 3 else 200, json=[])

    async with GitHubClient(transport=httpx.MockTransport(handler), sleep=no_sleep) as c:
        result = await c.collect("/repos/x/y/issues", 1)
    assert result.coverage == "complete" and len(calls) == 3


async def test_rate_limit_stops_long_reset():
    async with GitHubClient(
        transport=httpx.MockTransport(
            lambda r: httpx.Response(429, headers={"Retry-After": "60"}, json={})
        ),
        sleep=no_sleep,
    ) as c:
        r = await c.collect("/repos/x/y/issues", 2)
        assert r.coverage == "unavailable" and r.error == "rate_limited" and c.budget == 34
        assert r.retry_after == "60"


async def test_retry_after_short():
    calls = []

    def handler(r):
        calls.append(r)
        return (
            httpx.Response(429, headers={"Retry-After": "0"})
            if len(calls) == 1
            else httpx.Response(200, json=[])
        )

    async with GitHubClient(transport=httpx.MockTransport(handler), sleep=no_sleep) as c:
        assert (await c.collect("/repos/x/y/issues", 2)).coverage == "complete"
    assert len(calls) == 2


@pytest.mark.parametrize("pages,expected,count", [(1, "partial", 1), (2, "complete", 2)])
async def test_pagination(pages, expected, count):
    def handler(r):
        return (
            httpx.Response(200, json=[{"id": 2}])
            if r.url.params.get("page") == "2"
            else httpx.Response(
                200,
                json=[{"id": 1}],
                headers={"Link": '<https://api.github.com/repos/x/y/issues?page=2>; rel="next"'},
            )
        )

    async with GitHubClient(transport=httpx.MockTransport(handler)) as c:
        r = await c.collect("/repos/x/y/issues", pages)
        assert r.coverage == expected and len(r.items) == count


async def test_unsafe_next_link_and_budget():
    transport = httpx.MockTransport(
        lambda r: httpx.Response(
            200, json=[{"id": 1}], headers={"Link": '<https://evil.test/data>; rel="next"'}
        )
    )
    async with GitHubClient(transport=transport) as c:
        r = await c.collect("/repos/x/y/issues", 2)
        assert r.error == "unsafe_pagination_url" and r.coverage == "partial"
    async with GitHubClient(transport=transport, budget=0) as c:
        r = await c.collect("/repos/x/y/issues", 2)
        assert r.coverage == "unavailable" and r.error == "request_budget_exhausted"


@pytest.mark.parametrize("kind", ["invalid_json", "invalid_schema", "timeout", "network"])
async def test_failures_are_bounded_and_sanitized(kind):
    calls = []

    def handler(r):
        calls.append(r)
        if kind == "timeout":
            raise httpx.ReadTimeout("secret-text", request=r)
        if kind == "network":
            raise httpx.ConnectError("secret-text", request=r)
        return (
            httpx.Response(200, text="not json")
            if kind == "invalid_json"
            else httpx.Response(200, json={"wrong": "shape"})
        )

    async with GitHubClient(transport=httpx.MockTransport(handler), sleep=no_sleep) as c:
        r = await c.collect("/repos/x/y/issues", 2)
    assert r.coverage == "unavailable" and r.error and "secret-text" not in r.error
    assert len(calls) <= 3


async def test_proxy_denial_does_not_retry():
    calls = []

    def handler(r):
        calls.append(r)
        raise httpx.ProxyError("CONNECT denied")

    async with GitHubClient(transport=httpx.MockTransport(handler)) as c:
        result = await c.collect("/repos/x/y/issues", 2)
    assert result.error == "proxy_connection_denied" and len(calls) == 1
