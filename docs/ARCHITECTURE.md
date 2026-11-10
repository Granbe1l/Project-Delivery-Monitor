# Architecture

The public dashboard only reads our API. The browser never receives a GitHub token and cannot trigger synchronization. A CLI collects only the three configured public repository identities. There is no arbitrary URL-fetching API.

## Repository layout

- `backend/app/collectors`: HTTPX client, safe pagination, bounded retries, schema checks.
- `backend/app/services/sync.py`: orchestration, normalization, transactional upserts, observation persistence.
- `backend/app/risk_engine`: typed, deterministic domain rules independent of HTTP and SQL.
- `backend/app/models`, `schemas`, `db`: PostgreSQL storage, validated GitHub inputs and typed API outputs.
- `backend/app/main.py`: read API, liveness/readiness, filters, CORS, sanitized database failures.
- `backend/app/jobs`: operator preflight, initialization and synchronization commands.
- `frontend/src`: React routes, TanStack Query cache, accessible controls, original evidence links.

## Consistency and failure handling

A PostgreSQL transaction-scoped advisory lock prevents concurrent syncs for the same repository. Upserts have `(repo_id, github_id)` uniqueness; overlapping pages are deduplicated before metrics are computed. Every issue carrying `pull_request` is excluded from issue storage. Separate repository transactions isolate failures.

An observation includes only records returned within that endpoint's fetch scope. `last_seen_at` identifies the current observed set; objects not fetched this time are retained historically but are not silently counted as currently open. Full record revisions are not archived; aggregate snapshots and findings are historical, normalized records retain their latest observed values.

Each run records endpoint coverage, page counts, available rate metadata, status, timestamps and sanitized error codes. A failed total refresh creates no new snapshot and preserves the preceding observation. If one endpoint fails while others succeed, the previous endpoint metrics, original timestamp and findings are retained with `retained=true`; the API labels those rows `retained`, and the UI shows a refresh warning. An endpoint with no prior observation remains unavailable. A successful empty endpoint is legitimately zero and replaces an older population.

Rows and findings for successful observations commit atomically with their snapshot. Database exceptions roll back; the CLI isolates the repository and reports only an exception class (not DSNs). A crash before commit leaves no fabricated successful run. Operational job logs should therefore also be retained by the scheduler.

## Read API

`/health` checks process liveness only; `/health/ready` checks database connectivity and migrated repository schema. `/api/projects` lists initialized identities. Project resources include overview, issues, pull-requests, CI, milestones, trends, findings, and brief. Lists are bounded to 100 rows per request with stable ordering, validation, parameterized SQL and literal search escaping. Trends return at most the requested time window; production operators should define a retention policy before high-frequency collection.

CORS permits configured frontend origins and GET only. TLS/edge traffic limits belong to the deployment provider. Evidence links accept HTTPS `github.com` only and open with `noopener noreferrer`. React renders titles as text, never raw HTML. Logs omit credentials and raw upstream error bodies.
