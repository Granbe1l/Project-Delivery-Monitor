# Deterministic rules, version 1.0

No model, prediction, or universal quality score is used. Each persisted finding contains an observation, explanation, suggested action, HTTPS GitHub evidence URL, original observation time, subject identity, severity and rule/version.

| Rule | Trigger | What it means |
| --- | --- | --- |
| `pr_age` | Open non-draft PR age >= `PR_AGE_DAYS` OR time since update >= `PR_IDLE_DAYS`; both default 14 | Inspect priority and review context; does not establish a late reviewer or blocked work |
| `ci_repeated_failure` | At least `CI_FAILURE_THRESHOLD` (default 3) completed runs concluded failure on default branch in collected 30-day window | Inspect repeated failing checks; not production uptime or deployment success |
| `milestone_due` | Open milestone, non-null due date before observation, and remaining tracked items | Confirm remaining scope and whether the milestone date is current; not proof of a client delay |
| `freshness` | Latest stored observation older than `SYNC_STALE_HOURS` (default 24) | Ask operator to inspect collection; does not assess the upstream project |

Freshness is evaluated at API read time so a dormant collector can become stale without another job. Failed endpoint refreshes additionally show retained coverage and original endpoint timestamps. Unknown data is never interpreted as normal. No findings means no policy matched the collected scope, not that the project is healthy. Backlog counts and age bins are descriptive, not a rule assigning failure.

The thresholds are configurable operator policies, not industry standards. Restart the process after environment changes and run a new sync to recompute stored findings under changed policies; old observations keep their stored explanation and version.
