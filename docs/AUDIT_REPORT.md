# Recovery, implementation audit and final local verification

Audit performed **11 November 2026, approximately 05:58–06:16 WIB (Asia/Jakarta)**. Collector/evidence files retain UTC timestamps. This report supersedes earlier counts and describes the latest local application; it does not claim public deployment.

## Workspace and Git recovery

The same `/workspace/Project-Delivery-Monitor` checkout, branch `work`, and commit `4a0621e2743eb04ee5d439793b423c8550ddef6c` were present. Uncommitted live-validation work was also present and preserved. No reset, destructive checkout, worktree replacement or recovery fabrication was required. After rechecking the baseline, checkpoint commit `c1fb64a` saved that progress. Further fixes are recorded in the subsequent local audit commit (see `git log`). No push, merge, deployment or environment republish occurred.

## Verified functionality

- All six React views, public project selection, actual issue/PR records, workflow categories, milestones, observation history and evidence links.
- Search, creation-period filters, CI branch filtering, issue/PR pagination, milestone pagination, finding filters and text brief downloads.
- FastAPI typed read API, PostgreSQL storage, Alembic migration consistency, idempotent collection, duplicate protection, per-repository sync isolation and lock behavior.
- Honest unknown/empty/partial/stale/failed/retained states, with no fixture rows in the application DB.
- Desktop/mobile rendering and keyboard navigation. No additional chart, animation, chatbot or AI feature was introduced.

## Findings fixed without redesign

1. **Retained-source freshness:** a freshness finding used the newest snapshot timestamp even when the stale source was an older retained endpoint. A new PostgreSQL regression test failed before the fix and passes afterward; the finding now uses the oldest contributing observation time. History explicitly marks retained data with mixed times.
2. **Inaccessible milestone records:** the details view previously stopped at the first 100 collected milestones. It now offers 10-item pages and resets to page 1 when selecting another project; live Airflow pagination was exercised.
3. **Brief readability:** raw metric/coverage JSON and the full potentially long findings list made the export difficult to scan. It now contains readable scoped facts, freshness/attempt status, source times and three evidence-backed findings, explicitly directing readers to the complete dashboard list. This is a concise text export, not a PDF layout guarantee.
4. **Accessibility/readability:** automated checks found low-contrast secondary text, invalid labeling on metric help icons, and a non-keyboard-scrollable mobile history table. Secondary colors, roles and scroll-region focus were corrected. Closed mobile navigation is hidden from keyboard focus.
5. **Repeatable verification:** empty-state browser tests previously assumed a fresh app DB. They now use isolated TEST DATA routes and no longer require clearing real data or overwrite actual screenshots with mocked images. A separate live suite uses no mocks. Synthetic integration timestamps move together with each test observation, preserving relative ages so period-filter tests do not expire on a future calendar date.
6. **Portable setup:** the installer no longer assumes a writable `/workspace` on a user's own computer; default caches are inside the ignored checkout `.cache/` directory. The exact installer was run successfully.

## Final checks

| Command/check | Result |
| --- | --- |
| Backend `pytest -q` | **39 passed**, exit 0; one upstream Starlette/httpx deprecation warning |
| Ruff lint and format, including source-verification script | Passed; 31 Python files formatted |
| `alembic check` | Passed; no missing model migrations |
| Frontend lint and Prettier check | Passed |
| Frontend `npm test` | **7 passed** |
| Frontend production build | Passed, TypeScript and Vite |
| Browser `npm run test:e2e` | **4 passed**: empty state, API recovery, TEST DATA controls/export, stale/retained states |
| Browser `npm run test:e2e:live` | **6 passed**: live metrics, actual search/paging/export/history, screenshots/responsiveness, all views/filters/milestones, desktop accessibility, mobile accessibility |
| Automated accessibility | Zero selected axe WCAG A/AA violations across six real-data views at 1440px and 390px; keyboard skip/mobile navigation and viewport overflow also checked |
| `scripts/install.sh` | Passed with frozen Python lock and `npm ci` |
| Backend Docker build | Passed, hashes/TLS retained and optional proxy CA supplied |
| Audited Docker image with real PostgreSQL | HTTP 200 for readiness, project list, overview and brief; temporary smoke container stopped afterward |
| Native app readiness | API/database and frontend running for preview |
| Git whitespace check | Passed |

There are **56 passing automated test cases** (39 backend, 7 component/brief, 4 browser regression, 6 live browser), with no skipped cases in these suites. Accessibility automation does not replace a full manual audit, assistive-device testing, load testing or a security assessment. Initial failures were corrected and affected checks rerun; no assertions were disabled.

## Real GitHub data

Fresh requests still reached GitHub successfully. A new sync of all three repositories returned HTTP 200 for every collected endpoint and recorded **1,566 rows in the current scopes** (525 + 566 + 475). Each run reports partial coverage because page budgets are bounded. The earlier **1,570** count remains valid for the first collection; it is not a permanent total.

| Latest observed project | Open issues in scope | Open PRs in scope | PR attention | CI failure / completed default-branch runs | Observation time (WIB) |
| --- | ---: | ---: | ---: | ---: | --- |
| streamlit/streamlit | 122 | 194 | 34 | 0 / 20 | 11 Nov 05:59:56 |
| apache/airflow | 22 | 200 | 50 | 1 / 150 | 11 Nov 06:00:07 |
| vercel/next.js | 16 | 200 | 49 | 0 / 126 | 11 Nov 06:00:18 |

These are observed samples, not project-wide quality or delivery scores. The retained database contains **2,220 unique normalized records** across past/current observed sets and seven actual snapshots (3 Streamlit, 2 Airflow, 2 Next.js). Snapshot creation did not fabricate past observations. Older records outside the current scope are not counted as current open work.

A new read-only source check compared **12 current sampled records** (issue, PR, completed workflow, milestone per project) against GitHub: selected fields matched; the three source issue pages returned HTTP 200; duplicate `(repo_id, github_id)` groups were zero. The reproducible verifier is `scripts/verify_sources.py`. Evidence files:

- `evidence/audit-sync.json`: actual collection results, HTTP status, timestamps and scope.
- `evidence/audit-overviews.json`: exact dashboard data from the local API.
- `evidence/audit-source-checks.json`: source comparisons, counts, timestamps and duplicate checks.

## Preview and remaining steps

[Preview instructions](PREVIEW.md) include actual screenshot links, the cloud Desktop option, and local database/backend/frontend commands. Shared Desktop is declared enabled, but this session offers neither browser-control nor panel-opening tools; interactive viewer operation is therefore not claimed as verified. Automated Chromium verified the real application. No public URL or tunnel was created.

Before public deployment: select/authorize providers, supply managed PostgreSQL/TLS and exact CORS/API origins, deploy the prepared Docker/Vite configuration, verify external connectivity, then configure and verify an external sync schedule. No scheduler is currently active. PDF, detailed review/closed-event history and ETag optimization remain deferred features described in LIMITATIONS.md. GitHub-hosted CI has not run because no code was pushed.

The local implementation is ready for review. Push to GitHub and public deployment require the user's explicit approval; this audit does not authorize either.
