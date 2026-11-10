# Interview guide / Panduan wawancara

**What problem does this solve?** GitHub activity is spread over issues, PRs, Actions and milestones. This dashboard puts the collected facts, interpretation limits and next action in one place for a nontechnical stakeholder. It reduces navigation; it does not replace technical investigation.

**How is it different from GitHub?** It combines multiple repositories in one read-only experience, stores time-stamped observations and applies explicit policies across resource types. GitHub remains the authoritative evidence and has richer native details. The product makes no claim to infer delivery dates, budgets or total code quality.

**Why these public projects?** They allow reproducible, read-only demonstrations without private-company data or requiring HR to authenticate. Their activity scales differ, so raw counts are never used to rank project quality.

**How is data correctness protected?** Typed source validation, issue/PR separation, HTTPS source-link validation, upsert keys, a transaction-scoped lock, coverage metadata and timestamps. Tests run against PostgreSQL, with fixture data confined to a dedicated test database. Failed refreshes preserve prior evidence with its original timestamp.

**How are rate limits handled?** Link pagination, per-endpoint page limits, a shared request budget, bounded retry/backoff, Retry-After/reset handling, and unavailable/partial states. Tokenless quotas are shared by IP. No infinite retries or fake data are used to conceal failure.

**What are the analytics?** Deterministic rules for non-draft PR age/inactivity, repeated default-branch CI failure, dated milestones with open items and stale monitor data. They identify what to investigate, not why it happened. Rules have tests and explicit versions. No AI service is involved.

**Cloud engineering scope?** A non-root Docker image, Compose database, migrations, health/readiness, lockfiles, structured logs, CI checks and deployment templates. Public deployment and external scheduling are still pending. Live-source validation now passed for bounded samples from all three projects. Do not describe these as completed in an interview.

**Known tradeoffs?** Bounded recent-open-item sampling can miss old inactive work. Snapshot histories are not full event sourcing. The export is plain text rather than PDF. Live comparisons verify sampled source records; they do not establish complete repository coverage.

**Future integrations?** Jira and Azure DevOps connectors, full closed-event/review history, retention/rollups and ETag optimization are possible future work. None is represented as an existing feature.

**Demo flow once live data is verified:** overview → check coverage/time → inspect a PR attention item → open GitHub evidence → read the brief → export. Use the current live screenshots and coverage labels; explain that collection is manual until an external scheduler is configured.
