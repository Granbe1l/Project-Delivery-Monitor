import argparse
import asyncio
import json
import logging

from app.collectors.github import GitHubClient
from app.core.config import REPOSITORIES
from app.db.session import Session
from app.services.sync import synchronize


async def main():
    parser = argparse.ArgumentParser(
        description="Operator-only GitHub collection; no visitor trigger."
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--repo", choices=REPOSITORIES)
    group.add_argument("--all", action="store_true")
    parser.add_argument(
        "--dry-run", action="store_true", help="Run connectivity preflight without database writes."
    )
    args = parser.parse_args()
    if args.dry_run:
        from app.jobs.preflight import check

        return await check([args.repo] if args.repo else REPOSITORIES)
    return await run_repositories([args.repo] if args.repo else REPOSITORIES)


async def run_repositories(repositories=REPOSITORIES):
    results = []
    async with GitHubClient() as client:
        for repo in repositories:
            try:
                with Session() as db:
                    results.append(await synchronize(db, repo, client))
            except Exception as exc:
                # Exception text can contain connection strings. Report only the class.
                results.append(
                    {"repository": repo, "status": "failure", "error": type(exc).__name__}
                )
    print(json.dumps(results, indent=2))
    return 1 if any(r["status"] in ("failure", "busy") for r in results) else 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    raise SystemExit(asyncio.run(main()))
