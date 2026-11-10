# Verification evidence

Verified on **11 November 2026, Asia/Jakarta** (execution timestamps were recorded in UTC on 10 November). This report distinguishes implementation tests from live-source verification. No checks were skipped in the executed test suites.

## Final results

| Check | Observed result |
| --- | --- |
| `scripts/install.sh` | Exit 0; frozen uv dependencies and `npm ci` installed, including a repeat installation |
| `alembic upgrade head` | Initial PostgreSQL migration applied successfully; repeat startup succeeded |
| `alembic check` | Exit 0; no new upgrade operations detected |
| `pytest -q` | Exit 0; **36 passed**, one Starlette/httpx test-client deprecation warning |
| `ruff check .` and `ruff format --check .` | Exit 0; all checks pass, 30 Python files formatted |
| `npm run lint` | Exit 0 |
| `npm test` | Exit 0; **4 passed** |
| `npm run build` | Exit 0; TypeScript and Vite production build passed; approximately 334 kB main JS before gzip |
| Chromium `npm run test:e2e` | Exit 0; **3 passed** |
| `docker build ... -t pdm-backend:local backend` | Exit 0; current source built with optional trusted CA secret and hash-verified Python packages |
| Container smoke run | Non-root image connected to actual Compose PostgreSQL; readiness and project list both returned HTTP 200 |
| `scripts/start.sh` restart | Database readiness, repeat migration/initialization, API and frontend startup succeeded |
| Live local HTTP | `/health/ready` returned ready/database available; `/api/projects` returned three configured identities |
| `python -m app.jobs.preflight --repo streamlit/streamlit` | Exit 1; all five endpoint checks failed at proxy connection, no GitHub HTTP response |
| `python -m app.jobs.sync --all` | JSON reports failure for all three repositories; error `proxy_connection_denied`, coverage unavailable. Its shell also ran a subsequent migration check, so a separate live-sync shell exit code was not retained |

## What the tests prove

- Issue/PR separation; duplicate page records and repeated sync do not duplicate normalized rows.
- PostgreSQL transaction locks reject an overlapping job for the same repository.
- Each actual successful test sync creates a new timestamped snapshot, not invented historical observations.
- Complete/partial/unavailable scopes and unknown-vs-zero metrics are distinct.
- Total failed sync retains the previous snapshot; endpoint failure retains prior records, original timestamps and findings while labeling retention.
- Draft PRs are excluded from age attention; threshold boundaries and age-vs-idle distinction work.
- CI denominator uses completed default-branch runs; cancellation, skip, timeout, neutral and unknown stay separate.
- Null milestone due dates do not trigger lateness. Evidence URLs and timezone-aware timestamps are validated.
- HTTP 200/304/401/403/404/429, transient errors, timeout, network failure, invalid JSON/schema, unsafe next-page links, request budgets and long Retry-After are handled without unbounded retries.
- API queries validate page sizes/state, escape search literals, and return typed results. Visitor POST is rejected.
- Frontend renders unknown as unavailable, not zero, and rejects unsafe evidence links.
- Real local browser flow checks all six routes, project selection, desktop/mobile layout, no horizontal mobile overflow, unavailable-data state and API outage/retry recovery.
- A separately mocked **TEST DATA** browser flow verifies populated search, pagination, source links, finding filters and downloaded brief contents. It does not seed the application database.

Synthetic inputs are confined to `backend/tests/fixtures` and `frontend/tests/fixtures`. PostgreSQL integration tests enforce a database name ending `_test` and use `pdm_test`; production UI and app database never import these fixtures.

The application DB inspection after actual failed syncs showed: **3 configured repository identities, 0 issues, 0 PRs, 0 snapshots, 3 failed attempts**. Those zeros describe internal storage verification, not claimed GitHub repository counts. The user interface displays unknown metrics.

## Screenshots

`docs/screenshots/overview-desktop.png` and `issues-mobile.png` were captured from the actual local app connected to its unseeded database. They show unavailable data and the real failed-sync banner, not a synthetic successful dashboard. No fixture screenshot is presented as live evidence.

## Failures investigated

- The cloud egress proxy rejects CONNECT requests to `api.github.com` and `docs.github.com` with HTTP 403. That is not a GitHub API permission response. The application reports a sanitized proxy error without retrying the denial. Domain access must be changed through environment settings.
- Node 24 required a JSON import attribute in the browser fixture test. The test loader was corrected; the populated flow subsequently passed.
- npm's default cache path was unwritable in this environment. Installation uses `/workspace/.cache/npm`; runtime source and lockfiles remain the authoritative dependencies.
- The environment draft service returned `INVALID_ARGUMENT` on reads and could not confirm saving `install_script`/`start_skill`. Reusable scripts and instructions are in the repository, but cloud draft persistence and publication are unconfirmed.

## Phase outcomes

0. Workspace inspected: initially empty repository. Public API preflight implemented and attempted; live access blocked.
1. Data pipeline, normalized SQL, migrations, upserts, budget handling, sync CLI and history implemented; isolated PostgreSQL tests passed.
2. Deterministic rules, read API, coverage/freshness, retained-data behavior implemented and tested.
3. Six-view React dashboard, functional controls, responsive layout and honest empty/error states implemented; browser tests passed.
4. Docker/Compose, read-only CI workflow, deployment templates, text brief and operating docs prepared. Actual public deployment and scheduled refresh are **not executed**.
5. Local lint, tests, build, migration consistency, actual app startup, container readiness and screenshot review passed. Live source comparisons and provider deployment checks remain blocked/unrun.

No GitHub-hosted CI run, real external data comparison, production deployment, or scheduled refresh is claimed by this report.
