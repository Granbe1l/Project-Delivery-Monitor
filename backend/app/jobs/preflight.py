import argparse
import asyncio
import json
from datetime import UTC, datetime

from pydantic import ValidationError

from app.collectors.github import API, GitHubClient, GitHubError
from app.core.config import REPOSITORIES
from app.schemas.github import RepoSource
from app.services.sync import endpoints


async def check(repos):
    results = []
    async with GitHubClient() as client:
        for repo in repos:
            for label, path, key, schema in [("repository", f"/repos/{repo}", None, RepoSource)] + [
                (n, p, k, s) for n, (p, k, s, _) in endpoints(repo, datetime.now(UTC)).items()
            ]:
                record = {
                    "repository": repo,
                    "endpoint": label,
                    "checked_at": datetime.now(UTC).isoformat(),
                }
                try:
                    response, data = await client.get(API + path)
                    items = [data] if label == "repository" else data.get(key) if key else data
                    if not isinstance(items, list):
                        raise GitHubError("invalid_response_schema")
                    for item in items:
                        if label != "issues" or "pull_request" not in item:
                            schema.model_validate(item)
                    record.update(
                        status=response.status_code,
                        schema="valid",
                        returned_items=len(items),
                        rate_remaining=response.headers.get("x-ratelimit-remaining"),
                        rate_reset=response.headers.get("x-ratelimit-reset"),
                        coverage="partial" if response.links.get("next") else "complete",
                    )
                except (GitHubError, ValidationError) as exc:
                    record.update(
                        status=getattr(exc, "status", None),
                        error=exc.code
                        if isinstance(exc, GitHubError)
                        else "invalid_response_schema",
                    )
                results.append(record)
    print(json.dumps(results, indent=2))
    return int(any("error" in r for r in results))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", choices=REPOSITORIES)
    args = parser.parse_args()
    raise SystemExit(asyncio.run(check([args.repo] if args.repo else REPOSITORIES)))
