# Deployment and operations

Templates are prepared, not deployed. Review current provider capabilities, terms and pricing before creating any service. No free-tier or always-on promise is made.

## Local / Codex cloud

Use the existing checkout in each isolated cloud task. Do not create a Git worktree unless explicitly requested. Run `scripts/install.sh`, then `scripts/start.sh`; the latter is a foreground supervisor. Installed files and the PostgreSQL volume can persist in a snapshot, but processes must restart. Readiness checks: GET `/health/ready`, GET `/api/projects` (three configured identities), then open the dashboard. A healthy database with no GitHub data correctly yields unavailable metrics.

The current published environment allows `api.github.com` and `docs.github.com`; both were verified with fresh HTTP 200 requests. Preserve those domain permissions for future environments. Git clone access does not prove GitHub REST API access. The existing package-manager policy already supports npm/PyPI/Docker dependencies. No new token is required merely because anonymous calls are blocked by policy. After any future network changes, rerun the CLI preflight and compare source evidence. The initial live checks are in LIVE_VALIDATION.md; the latest verification and fixes are in AUDIT_REPORT.md. See PREVIEW.md for viewing the running local UI.

Docker builds under a TLS-inspecting proxy must retain verification:

```bash
docker build --secret id=proxy_ca,src=/etc/ssl/certs/ca-certificates.crt -t pdm-backend:local backend
```

The Dockerfile optionally mounts that CA for pip installation; it is never copied into image layers. Inner collector containers may also need a read-only mounted combined CA bundle and `SSL_CERT_FILE` pointing at it. Keep inherited proxy configuration. Regular deployments with public trust chains do not need this cloud-specific CA.

## Managed database

Create PostgreSQL separately after approval of any costs. Supply a `postgresql+psycopg://...` `DATABASE_URL` with the provider's required SSL settings (typically `?sslmode=require`). Store it in the provider's secret UI, never in version control. Use a role limited to this application database; back up and define retention before high-frequency collection. Run `alembic upgrade head` once as a release step; the provided single-instance template runs it before startup. Multi-instance deployments should serialize schema changes through a release job.

## Backend on Render

`render.yaml` describes a Docker web service with automatic deployment disabled. Review before importing it. Supply `DATABASE_URL`, exact comma-separated `CORS_ORIGINS`, and optionally a read-only server-side `GITHUB_TOKEN`. The web service exposes only read APIs; no sync secret or public sync endpoint is needed. The startup command applies migrations and initializes public identities, then starts Uvicorn on port 8000. Health check: `/health/ready`.

If a chosen service sleeps, the first request may cold-start; the frontend offers a visible failure/retry state. Stored observations live in managed PostgreSQL, not the ephemeral web-service filesystem. Do not use abusive keepalive requests. Provider deployment has not been tested here.

## Frontend on Vercel

Use project root `frontend`, install `npm ci`, build `npm run build`, output `dist`. Set `VITE_PUBLIC_API_BASE_URL` to the backend HTTPS origin **before build**. No token or database URL belongs in a `VITE_` variable. `vercel.json` enables SPA deep links and basic browser security headers. Set backend CORS to the exact deployed frontend origin; include preview origins only intentionally. Review CSP `connect-src` and restrict it to the final API origin after its URL is known.

## Operator scheduling (not activated)

Use a supported external scheduler capable of running the backend image with network access and the database/token bindings. Job command:

```bash
python -m app.jobs.sync --all
```

Example schedule: every 12 hours (`0 */12 * * *`, UTC), after verifying quota and provider support. This is an operator deployment choice, not an activated job. Collect structured JSON output, alert on nonzero exits, and inspect partial coverage even on exit 0. Use the shared request budget; tokenless API IP quotas can also be consumed by other tenants. Advisory locks prevent duplicate concurrent writes per repository. No GitHub comment, issue, PR, or commit automation is part of this product.

## Acceptance after access is restored

1. Run preflight for the three repositories; retain HTTP statuses, schema results and available rate headers.
2. Sync one repository, inspect per-endpoint coverage, then sync all within quota.
3. Compare several stored issue/PR/workflow IDs, timestamps and evidence URLs against the original GitHub pages. Counts are scoped samples when partial.
4. Sync again; verify unique records stay unique and a second real snapshot appears.
5. Verify report export, populated tables, filters, stale/failure recovery and deployed frontend/backend connectivity.
6. Enable a scheduler only after those checks; confirm a later scheduled run actually completed before claiming periodic refresh.

## Updated Vercel setup (root import)

Import GitHub branch `work`, leave Root Directory as repository root (`.`). Root `vercel.json` installs/builds `frontend` and publishes `frontend/dist`. Alternatively retain the existing `frontend` Root Directory setup; its own `vercel.json` remains valid. Do not mix root commands with the frontend Root Directory.

Before clicking Deploy set `VITE_PUBLIC_API_BASE_URL=https://<your-public-fastapi-host>` (no trailing slash and no `/api`). Vercel builds now validate this value. Deploying only the static frontend does not deploy FastAPI or PostgreSQL. `api.example.com` is a validation-test placeholder, never a working production backend.

Backend remains the existing Docker service in `render.yaml`; it now uses the provider PORT with 8000 fallback. Create persistent PostgreSQL, configure its TLS URL as DATABASE_URL, and set CORS_ORIGINS to your exact Vercel production origin. The template is single-instance: migrations/init run before startup. For multiple replicas serialize migrations in a release job instead.

## Implemented opt-in scheduler worker

`python -m app.jobs.scheduler` runs the existing three-repository CLI service immediately, then waits `SYNC_INTERVAL_SECONDS` (default 21600 = six hours) after each completed cycle. This is fixed delay, not wall-clock cron. It runs cycles serially, survives errors without printing exception secrets, and stops waiting on SIGTERM. In-flight cycles finish gracefully; platform termination can still interrupt them, and the database transaction rolls back on connection closure. Existing per-repository advisory locks protect concurrent processes, and upserts preserve item identity.

Provision a separate worker using the same backend Dockerfile only after approving hosting costs. Supply the same DATABASE_URL, optional server-only GITHUB_TOKEN, SYNC_INTERVAL_SECONDS and collector budgets. Initialize schema and repository identities before starting the worker. Local opt-in example (not activated automatically):

```bash
docker compose -f compose.yaml -f compose.scheduler.yaml --profile sync up -d scheduler
```

Do not configure both this continuous worker and an external cron for the same schedule. No public sync HTTP endpoint, GitHub Actions schedule or paid worker is activated by this commit. Local timer tests use a stub cycle to verify real short waits, serial execution, error recovery and shutdown; they are not proof of successful scheduled GitHub collection or public deployment. Verify at least two real job runs and source timestamps after deployment. Partial results can exit zero: inspect per-source coverage, not exit code alone.

Current provider pricing, free-tier sleep/expiry and Vercel Services eligibility still require checking before provisioning. This configuration deliberately keeps long-running collection outside Vercel requests.
