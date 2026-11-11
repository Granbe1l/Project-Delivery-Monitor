# UI refinement — 11 November 2026

Continues local commit 6521cc1 on work. No backend, collector, metrics or rule changes. No push, merge or deployment.

## Changes
- Overview preserves four KPIs and observed scope, adds issue age distribution from issue_age_bins. Three findings expose actions and source links; explanation and limits expand on demand.
- Risks defaults to three findings, with search, rule filter, rule/type/time ordering, and a complete 10-per-page browser. Export still includes the entire brief. Rule order is explicitly not a risk ranking; no new priority score is inferred.
- Issues, PRs and workflow activity request 10 records per page. PR summary includes observed open/draft/attention counts. Draft count is calculated only after all collected PR pages load, not from the visible page.
- CI shows a second distribution of actual completed default-branch conclusions. No historical trend chart or aggregation of unlike conclusions.
- Details shows five historical snapshots per page. Milestones retain ten-per-page pagination and gain title search and state filtering across all collected milestones.
- Larger text, ice-blue KPI accents, compact rows, sticky viewport-height desktop sidebar, and mobile drawer with backdrop, Escape, focus containment/return and background scroll lock.

## Validation
- Production build, TypeScript, ESLint, frontend tests: passed (7 tests).
- Backend regression: 39 passed. Existing Starlette/httpx deprecation warning remains.
- Browser: 11 passed across the final live/refinement run (7) and final smoke run (4). Includes three actual projects, navigation, search, filters, pagination, export, evidence, unavailable/empty/stale/retained states and error retry.
- Automated WCAG A/AA checks: no violations on all six views at 1440 and 390 pixels; no document horizontal overflow. This is automated validation, not a full human accessibility certification.
- Test expectations updated for deliberate 10-row activity and 5-row history pagination. Synthetic fixtures exist only in intercepted regression tests; screenshots and live checks use PostgreSQL GitHub observations.
- Twelve screenshots in screenshots/refinement were captured after loading indicators disappeared. Desktop 1440x1000, mobile 390x844, full-page captures. Original desktop screenshots remain in the external comparison gallery.

## Data and trade-offs
Stored GitHub observations are preserved from the prior sync (10 November UTC). This revision did not resync GitHub or imply live data. Per-source partial/retained coverage, observation timestamps and stale warnings remain visible.

The three initial findings follow server rule order, not a newly inferred severity ranking. Repeated rule explanations move behind disclosure; original recommendation text is preserved. Tables can scroll horizontally inside their container on narrow screens to retain technical columns and evidence. Milestone filtering and draft summary fetch all pages of the collected observation through existing APIs; very large observations could benefit from server-side aggregation later. Cross-page timestamp/total changes surface an error instead of silently mixing snapshots.

## Review
Open the running app inside the cloud browser at http://localhost:5173. Laptop localhost does not reach the cloud. The standalone screenshot gallery at /workspace/pdm-refinement/gallery.html can be downloaded and opened without deployment. It contains six before/after desktop comparisons and all six revised mobile views. No built-in external preview URL has been verified.

## Before / after at 1440px (full page height)

| View | Before | After |
| --- | ---: | ---: |
| Overview | 1894px | 1605px |
| Details | 2332px | 2383px |
| Issues | 2875px | 1446px |
| Pull requests | 2749px | 1530px |
| CI | 3110px | 1660px |
| Risks | 6057px | 1411px |

Details is slightly taller with larger typography and filter controls; its history and milestones are bounded. Mobile favors readable text and stacked controls over minimizing total scroll length.
