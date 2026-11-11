# Compact reference-directed UI

The latest request supersedes the always-expanded executive insight layout. That insight, page guidance, source scope and Data Quality remain accessible via native disclosure controls rather than large text blocks. Overview shows four compact KPI cards, issue-age chart and three source-backed PR previews, matching the supplied composition. Other pages retain search/paging/evidence with reduced spacing and disclosure-led explanation. Repository information uses a compact four-column strip. No reference values or unsupported time-series charts copied. No measured claim of <=10% visual difference: screenshot review is required.

Unknown KPI values retain a visible Data unavailable label; a browser regression found this was hidden by compact styling and it was corrected. Production metrics/collector/backend unchanged. Twelve actual desktop/mobile screenshots in screenshots/compact; standalone gallery /workspace/pdm-compact/gallery.html.

Validation: build/lint, 11 frontend unit tests. Browser initial run failed because preview had stopped; services restarted. Live/refinement/accessibility scenarios passed; empty-state label fixed and smoke suite rerun. No push/deployment. Earlier scheduler and closed/merged analysis remain outstanding.

Final empty-state smoke rerun: all 4 passed after preserving the unknown-value label. Combined relevant browser coverage: 12 scenarios passed across live/refinement and final smoke runs. Production rebuild passed after the fix.
