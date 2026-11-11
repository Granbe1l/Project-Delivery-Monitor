# Key Findings checkpoint

Stage 1 adds up to three deterministic overview insights without changing backend metrics. Percentages are rounded to whole numbers; exact numerators and denominators remain visible. Issue-age bins must sum to the open issue sample; invalid/unknown/zero denominators suppress the insight. Missing eligible metrics render Insufficient data. Partial and retained flags remain attached to each insight. Source links open collected records with original GitHub evidence.

Definitions: issues aged >=30 days / collected open issues; non-draft PRs matching existing age OR inactivity rules / all collected open PRs including drafts; failure conclusion / completed default-branch workflow runs in the collected 30-day window. These are sample descriptions, not project-quality judgments. Age is measured at observation, not visit time. Data Quality preserves individual source timestamps.

Actual examples and sample sizes are recorded in KEY_FINDINGS_EXAMPLES.json. Streamlit: 84/122 old issues, 34/194 attention PRs, 0/20 failures. Airflow: 7/22, 50/200, 1/150. Next.js: 6/16, 49/200, 0/126. No new GitHub collection performed.

Validation: 11 frontend unit tests, production build and lint passed. Browser first attempt failed due to stopped preview; services restarted and regression repeated. Screenshots show real stored observations, desktop/mobile.

Outstanding: collector currently requests state=open for issues and PRs. Weekly closures, merge-duration median/distribution, merged vs closed-without-merge analysis are NOT implemented or validated; open-only records cannot support them. Requires closed issue/PR collection with closed_at/merged_at, separate sample coverage, migrations if needed, and dedicated tests. Label distribution and grouped recommendations beyond current UI also remain future work. Existing draft summary is unchanged. Scheduler from earlier request remains unimplemented. No push/deployment.

Final browser regression: 11 passed, including automated accessibility on six routes at desktop/mobile sizes.
