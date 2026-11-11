# Analyst-style readability refinement

Continues 4bafc25. Backend, raw observations, analysis rules and collector unchanged.

- Details adds available-source, saved-observation and milestone cards plus a comparability explanation.
- Issues keeps four age-group summaries and adds a scoped quantitative insight. PR retains open/draft/attention cards with the same deterministic insight definition as Overview.
- CI cards show completed, failed, skipped and success share; success counts remain in the conclusion distribution. Its insight explains the default-branch 30-day denominator and zero-failure limits.
- Risks retains actual severity counts and adds a clear review summary. No fabricated High/Medium/Low levels. Existing actions/evidence and expandable explanations remain.
- Data Quality now has one short explanation with methodology expandable. KPI supporting label is Items analyzed. Titles longer than 90 characters have an expandable full original title; labels remain expandable. Ten-row paging, filters, exports and source evidence are preserved.
- Overview Key Findings unchanged. Details has no decorative chart because snapshot coverage is not comparable. Risks has no decorative severity chart.

Validation: build, lint and 11 unit tests passed. Browser regression covers all six routes at desktop/mobile, source records, filters, paging, export and automated accessibility. Long-title test now opens disclosure before checking exact original text. Twelve actual screenshots are in screenshots/analysis-ui; standalone gallery at /workspace/pdm-analysis-ui/gallery.html.

Limitations: source-level analysis scopes remain partial where labeled; no new GitHub fetch. Existing recommendations remain rule-authored rather than inventing personalized actions. Scheduler and closed/merged record analyses from earlier requests remain outstanding. No push/deployment.
