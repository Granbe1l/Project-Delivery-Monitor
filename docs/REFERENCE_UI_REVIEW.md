# Reference-directed UI review — 11 November 2026

Continues 5eb1c9d, preserves backend, database, collector and deterministic rules.

## Visual changes
- Slim Midnight Navy sticky sidebar, Ice Blue active state, page-specific headings, smaller KPI surfaces, tighter spacing and white panels follow the supplied reference composition.
- Overview places a vertical issue-age chart beside three compact findings. Heights are proportional to the actual counts; labels retain exact values. Scope and per-source observation timestamps remain visible.
- Findings use compact rows with actions and evidence visible, and expandable rule/version, timestamp, explanation and limits. Summary counts use only severities actually present in the returned findings; no invented Monitor/Informational categories or copied reference values.
- CI adds completed/failed/successful counts and success share from the existing default-branch completed-run metric. With no completed runs, share is unavailable. A conclusion distribution is used instead of inventing a historical trend from inconsistent snapshot coverage. All-branch table and default-branch KPI scopes remain distinct and labeled.
- Numbered pagination with current-page indication and ellipses on activity records, milestones, history and complete findings. Activity tables retain 10 records per page. History remains 5 observations per page.
- Mobile Issues/PR/CI tables reflow into stacked records so evidence/status can be read without horizontal scrolling. Full record titles, search, filters and exports are preserved. Drawer keyboard behavior is retained.

## Validation
Production build/TypeScript, ESLint and format checks passed. Frontend unit suite: 7 passed. Browser suite: 11 passed, including actual observations from all three projects, numeric page navigation, exports, empty/partial/stale/retained/error states, keyboard drawer, and automated WCAG checks on all six pages at 1440 and 390 pixels. No backend code changed; backend tests were not rerun for this frontend-only revision.

Screenshot files: screenshots/reference, twelve full-page captures from Chromium after loading completed. External self-contained before/after gallery: /workspace/pdm-reference/gallery.html. Previous screenshots are preserved under screenshots/refinement. Test fixtures are confined to intercepted browser tests, never the screenshot capture.

## Limits
Visual layout follows the reference; data and categories do not copy it. Stored observations are from the existing GitHub sync, not a new live collection. No time-series CI chart or inferred deadlines. Mobile stacked records require more vertical scrolling while keeping all evidence visible. Automated accessibility checks are not a full manual audit. No push, merge or deployment.
