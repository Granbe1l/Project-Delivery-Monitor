# Data sources and metrics

Only `streamlit/streamlit`, `apache/airflow`, and `vercel/next.js` are allowed. Repository metadata is validated before endpoint collection. GitHub `html_url` and `id` establish record provenance; timestamps are stored with timezone in PostgreSQL and displayed in UTC.

| Source | Scope | Interpretation |
| --- | --- | --- |
| `/repos/{owner}/{repo}` | Exact allowlisted identity | Default branch and verified repository URL |
| `/issues?state=open&sort=updated` | Open, up to configured pages; PR objects excluded | Observed open issues and age bins, not all-time events |
| `/pulls?state=open&sort=updated` | Open, up to configured pages | Open PRs, drafts, created/updated times, requested reviewers |
| `/actions/runs?created=>=...` | Previous 30 days, bounded pages, all branches/events collected | Overview uses completed default-branch runs; detail filters branch/period |
| `/milestones?state=all` | Bounded pages | Due date nullable; closed / all tracked milestone items |

Default `SYNC_MAX_PAGES=2`, 100 items per page; shared CLI `SYNC_REQUEST_BUDGET=35`, including retries and repository lookups. GitHub issues pages may contain PRs, so fewer than 200 actual issues may be collected. A next-page Link at the budget boundary means partial, including GitHub's own capped windows. Failure after a valid page is partial; failure before data is unavailable. A rate-limited request stops when retry delay exceeds 10 seconds; the operator should retry after reset, not loop.

A complete label means all pages returned by that endpoint within the requested scope, not a complete business assessment. Pagination is not a transactionally frozen GitHub snapshot, so concurrent upstream changes can still shift pages.

## Metric dictionary

- `open_issues`, `open_prs`: deduplicated records in the observation with open state.
- `labeled_bug_reports`: observed open issues with case-insensitive exact `bug` label. It does not imply a verified defect and does not infer synonym labels.
- `issue_age_bins`: 0–6, 7–13, 14–29, 30+ elapsed days since creation, evaluated at observation time.
- `prs_needing_attention`: open non-drafts crossing age or inactivity policy; updated time is not review time.
- `ci_completed`: completed runs on the repository default branch from the collected 30-day scope, across all event types.
- `ci_failures`: only conclusion `failure`; denominator is all `ci_completed` records. Success, cancelled, skipped, timed_out, neutral, action_required, stale and unknown conclusions remain separate. Queued/in_progress runs are not included.
- Milestone completion: `closed_issues / (closed_issues + open_issues)` tracked items, including PRs if GitHub counts them. A zero-item milestone has no completion percentage.
- Historical snapshots: actual collection-time observations. Partial/changing scopes are explicitly not comparable repository-wide trends. No synthetic past timeline.

No reviews endpoint is fetched yet; requested reviewer names are metadata, not an inferred review state. Closed events, merge throughput, repository-wide backlog growth and causal bottlenecks are not computed from the bounded open-item sample.

## Official references

- https://docs.github.com/en/rest/issues/issues
- https://docs.github.com/en/rest/pulls/pulls
- https://docs.github.com/en/rest/pulls/reviews
- https://docs.github.com/en/rest/actions/workflow-runs
- https://docs.github.com/en/rest/issues/milestones
- https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
- https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api

This environment blocked the documentation host as well as the API during implementation. Current remote behavior and individual source records still require verification after access is restored. The client sends GitHub API version `2022-11-28`, the GitHub JSON Accept header, and an identifying User-Agent.
