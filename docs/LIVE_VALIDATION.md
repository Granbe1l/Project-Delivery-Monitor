# Initial live GitHub and application validation

This records the first live collection. See [AUDIT_REPORT.md](AUDIT_REPORT.md) for the later recovery/refresh, fixes, final test counts and current screenshots.

Verified **11 November 2026, approximately 01:39–01:43 WIB (Asia/Jakarta)**. Evidence files retain the source/collector UTC timestamps. The user published a new cloud environment with `api.github.com` and `docs.github.com` allowed; this report uses that new instance, not the earlier blocked machine.

## Access and real synchronization

- Current runtime observations matched the selected environment and reported network policy enforced, with both requested domains present.
- A fresh GitHub repository request and the pagination documentation request returned HTTP 200. The other six official REST documentation pages referenced in DATA_SOURCES_AND_METRICS.md also returned 200.
- `python -m app.jobs.preflight` completed with **exit 0: 15/15 endpoint checks returned HTTP 200 and valid schemas** across Streamlit, Airflow and Next.js.
- `python -m app.jobs.sync --all` completed with **exit 0**, storing real observations for all three projects. Each run reports `partial`, because configured endpoint page limits cap coverage; no endpoint error was recorded. The first pass processed **1,570 source records** (524 + 571 + 475).
- A second `python -m app.jobs.sync --repo streamlit/streamlit` completed with **exit 0**, again partial with no endpoint error, and created a second actual observation. The normalized database held **1,573 unique records** afterward because additional workflow runs appeared between requests. Duplicate `(repo_id, github_id)` groups: **zero** in all four normalized record tables.
- No fixture was seeded into the application database and no GitHub token was added. Existing platform access worked; the observed request rate headers were used rather than assuming the anonymous quota.

## Latest dashboard observations

All numbers below describe collected records, not complete repository populations. Workflow denominators include completed default-branch runs in the bounded 30-day collection window. Issue pages also contain PRs, which were removed before counting issues.

| Project | Observed open issues | Observed open PRs | PRs crossing policy | CI failure / completed | Observed at (WIB) |
| --- | ---: | ---: | ---: | ---: | --- |
| streamlit/streamlit | 124 | 191 | 34 | 1 / 59 | 11 Nov, 01:40:56 |
| apache/airflow | 27 | 200 | 58 | 0 / 144 | 11 Nov, 01:40:12 |
| vercel/next.js | 16 | 200 | 51 | 1 / 143 | 11 Nov, 01:40:24 |

Issue and workflow coverage is partial for every project. Streamlit PR coverage is complete for the requested open-PR scope; Airflow and Next.js PR coverage is partial. Milestone coverage is complete for all three in this run (9, 144, and 59 collected milestones). These labels describe endpoint scope only, not overall project health.

## Source comparisons

Twelve stored records—one issue, PR, workflow and milestone per project—were fetched again from the real GitHub REST API. IDs, source URLs and titles matched; sampled workflow names/statuses/conclusions also matched. Three original issue pages returned HTTP 200 and contained the expected issue identifiers. Evidence URLs and timestamps are in `evidence/live-source-checks.json`.

The first HTML-page comparison mistakenly reused the API-only Accept header and received HTTP 406. The verification helper was corrected to request `text/html`; all three HTML pages then returned 200. This was a verification-helper error, not a collector or application defect. The earlier proxy CONNECT 403 no longer occurs with the published policy.

## Tests and runtime checks

| Check | Result |
| --- | --- |
| Backend `pytest -q` | **36 passed**, exit 0; one upstream Starlette/httpx deprecation warning |
| Backend Ruff lint/format | Passed, exit 0 |
| Alembic migration consistency | Passed, no new upgrade operations |
| Frontend lint | Passed |
| Frontend component tests | **4 passed** |
| TypeScript + Vite production build | Passed |
| Original browser regression suite, run before live sync | **3 passed**: empty navigation/mobile, outage recovery, isolated TEST DATA controls/export |
| New real-data browser suite | **3 passed**, with no mocked network routes or fixture records |
| FastAPI readiness | HTTP 200, database available |
| App startup in restored instance | PostgreSQL volume, dependencies and local commit restored; migrations/identity initialization repeated successfully |

The new browser suite verifies rendered metric values against the API for **all three projects**, actual issue and PR titles/evidence links, search, pagination, Streamlit history with two real observations, downloaded stakeholder brief contents, desktop/mobile layout and absence of uncaught browser errors. Actual screenshots are linked in PREVIEW.md. Source samples corroborate provenance independently of browser-to-API agreement.

## Changes and boundaries

No collector, rules, schema or endpoint behavior was changed for this verification. A separate live-data Playwright suite and npm command were added so the original empty-data suite need not be run against or overwrite a populated database. Documentation and evidence were updated. One UI footer label changed from “Periodic sync” to “Stored observations” because the scheduler has not been activated; the old text could imply automated refresh was running.

The environment draft was not edited or republished. No GitHub push, public application deployment, external scheduler activation or paid resource creation occurred. GitHub-hosted CI and provider deployment checks remain unrun.

## Still needed for public deployment

1. Choose and authorize hosting; configure managed PostgreSQL credentials/TLS, backups and retention.
2. Deploy the existing backend Docker template to the chosen provider; apply migrations and readiness checks.
3. Deploy the Vite frontend with `VITE_PUBLIC_API_BASE_URL` pointing at that HTTPS API and configure exact backend CORS origins.
4. Verify public frontend/backend connectivity, cold starts, read-only behavior and source evidence again.
5. Configure an external collector schedule with credentials, quota budget and failure monitoring, then verify a later scheduled execution before claiming periodic refresh.

PDF export, detailed review/closed-event history, ETag caching and broad production/security/load validation remain outside the implemented/verified scope. The text brief, manual real sync and local end-to-end dashboard are working.
