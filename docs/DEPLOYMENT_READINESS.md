# Deployment readiness — 11 November 2026

**Historical inspection below. Follow-up implementation:** root Vercel import configuration and API-origin build validation are now supplied. An opt-in `app.jobs.scheduler` worker and compose override have been added and locally tested with short real timers/stub cycles; not deployed or verified against scheduled live GitHub runs. See VERCEL_QUICKSTART.md and the updated DEPLOYMENT.md. Earlier statements about a missing scheduler describe the inspected bb31466 baseline, not this follow-up commit.

## Verified source state
Local HEAD and GitHub refs/heads/work both bb314663724482c1bb25627ad28d7cdeb94af1ca at inspection. UI/insight work is present. No scheduler module, cron service or scheduled workflow exists. app.jobs.sync is an operator CLI, not a scheduler. This report is a local addition; it has not been pushed.

## Recommended architecture
Vercel static React/Vite frontend; separate Docker FastAPI web service (existing Render template); persistent managed PostgreSQL; separate scheduled container job using the same backend image and database. Keep sync out of web request handlers and frontend builds. Do not activate any paid resource automatically.

All-Vercel is not deployment-ready from current source: only frontend/vercel.json exists; no Python function/service routing, protected sync trigger, duration budgeting or cron configuration exists. Current sync keeps a database transaction and advisory lock open during network calls. A serverless adaptation would need explicit runtime/duration/connection-pool and scheduled invocation validation. Managed PostgreSQL is still external to the function filesystem. New Vercel Services availability and plan eligibility must be verified against current official documentation before choosing it; not assumed here.

No current numeric free-tier limits/prices were verified. Check Vercel Hobby eligibility, cron frequency and function-duration limits; Render web-service sleep, scheduled-job billing and database expiration/retention; database connection/storage/backup quotas. A free sleeping API can cause first-load timeouts (frontend currently times out after 15 seconds). A database trial is not a persistent production guarantee. Six-hour jobs must run independently of web-service uptime.

## Exact configuration to prepare
Frontend: Git branch work, Root Directory frontend, npm ci, npm run build, output dist. VITE_PUBLIC_API_BASE_URL=https://<api-host> (origin only, no /api, no trailing slash); build-time variable, rebuild after change. No GITHUB_TOKEN or DATABASE_URL in VITE_* variables. SPA rewrites already in frontend/vercel.json. Tighten its CSP connect-src from all https: to self plus the final API origin after host assignment. Disable automatic production deployment until approval; do not import work into a live auto-deploying project during readiness review.

API: backend Dockerfile via root render.yaml; health /health/ready. DATABASE_URL=postgresql+psycopg://<user>:<encoded-password>@<host>:5432/<database>?sslmode=require (or stronger provider-required TLS). CORS_ORIGINS=https://<production-frontend-host>; add only intentionally authorized preview origins. Current GET-only CORS is suitable for read APIs but is not authentication. Never use wildcard origins as a preview workaround.

Existing Render command applies migrations at every web startup and hardcodes port 8000. Before multi-instance deployment, move migrations to one release task; use uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} with shell expansion for API startup. Existing app DB pool allows 5 base + 5 overflow connections per process: size replica/job counts against the chosen DB connection limit. Do not use the local default database password in cloud.

Release commands (backend working directory):
1. alembic upgrade head
2. python -m app.jobs.init_db
3. python -m app.jobs.sync --all --dry-run
4. python -m app.jobs.sync --all

Scheduler proposal (not implemented/activated/tested): external container cron 0 */6 * * * UTC, command python -m app.jobs.sync --all. Equivalent WIB times: 01:00, 07:00, 13:00, 19:00. Bind DATABASE_URL and optional read-only GITHUB_TOKEN only on trusted server/job services; API does not need the token to serve reads. Bind SYNC_MAX_PAGES=2, SYNC_REQUEST_BUDGET=35, SYNC_STALE_HOURS=24, PR_AGE_DAYS=14, PR_IDLE_DAYS=14, CI_FAILURE_THRESHOLD=3. Schedule expression is configured by the scheduler provider; no SYNC_INTERVAL variable exists today. Select the provider before adding a provider-specific scheduler manifest.

CLI budget of 35 requests is shared over all three repositories, not 35 each. Collector has 20-second request timeout, up to three attempts, safe pagination-host validation, bounded retry and explicit partial/unavailable status. Existing PostgreSQL transaction advisory locks serialize each repository; unique constraints and upserts protect record identity. These mechanisms do not prove scheduling works. A partial run may exit zero: monitoring must inspect returned statuses and endpoint coverage, not only process exit.

## Security check
Tracked-file pattern scan found no recognizable GitHub token, AWS access-key ID or private-key header. Only .env.example and frontend/.env.example are tracked; the example database password is explicitly local-only. This bounded scan is not a guarantee against every secret format or historical leak. Check full Git history with a dedicated secret scanner before release, and rotate any discovered real secret. Do not print environment bindings or credential-bearing URLs in logs. Public backend data is intentionally read-only; restrict DB access and keep sync operator-only. Do not expose an unauthenticated HTTP sync endpoint.

## Public acceptance sequence (after approval)
1. Confirm provider terms, budget, persistent DB retention/backups and connection cap.
2. Provision database, store secrets in provider settings; serialize migrations and initialize identities.
3. Deploy API image and verify /health/ready, /api/projects and empty-state behavior from public network.
4. Run preflight/manual sync; inspect three repo results, source coverage, original GitHub IDs and source timestamps. A healthy API alone proves no freshness.
5. Set final API origin in Vercel build settings and final frontend origin in CORS; deploy frontend only after approval. Verify direct deep links /issues?project=1, API requests, CSP/CORS, filters, exports and mobile layout in a laptop browser.
6. Configure scheduled job and temporarily test a short supported interval. Require at least two real scheduled invocations, job logs, distinct sync_runs, appropriate snapshots, advancing successful source timestamps, and unchanged timestamps for failed sources. Restore six-hour schedule.
7. Exercise concurrent jobs, API timeout/rate-limit/partial failures, database outage and retained-data behavior in an isolated test database; confirm no duplicate (repo_id, github_id), no unavailable-to-zero substitution and no credential disclosure. Verify next six-hour invocation independently.
8. Alert on job failures, missing executions, retained/partial sources and stale data. Document backup/restore, rollback and log retention.

## Readiness verdict
Frontend configuration: substantially prepared. API/container/database migration path: prepared but provider values and release sequencing required. Scheduler: missing, untested and undeployed. Advanced closed/merged analyses remain absent from collector (open-only data); do not advertise them. No public deployment success claimed. No paid service or deployment performed.
