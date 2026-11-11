# Final refinement checkpoint — 11 November 2026

Frontend stage only, based on 6b2465b. Backend and synchronization unchanged.

Implemented: Data last checked label; correct Asia/Jakarta/WIB conversion from stored timestamp (including next-day test); failed/completed checks label; draft/open/attention definitions; partial scope explanation; snapshot comparability explanation; zero-failure and success-share caveats; Attention interpretation; expandable GitHub labels retaining all text.

Validation: production build, lint, 8 frontend tests, 11 browser tests including six views desktop/mobile, actual stored observations, filters/paging/export, empty/stale/retained/failure regression and automated accessibility. Screenshots in screenshots/final-ui. Standalone gallery /workspace/pdm-final-ui/gallery.html.

API observation counts (not repository-wide totals):
| Repository | Issues | PRs | Workflow runs, all collected branches | Milestones |
| --- | ---: | ---: | ---: | ---: |
| streamlit/streamlit | 122 | 194 | 200 | 9 |
| apache/airflow | 22 | 200 | 200 | 144 |
| vercel/next.js | 16 | 200 | 200 | 59 |

## Outstanding — do not report complete
Automatic six-hour scheduler has NOT been implemented or tested in this checkpoint. Existing operator CLI backend/app/jobs/sync.py remains unchanged. Next stage: inspect app/services/sync.py locking/idempotency, collector retry behavior and existing deployment files; implement configurable scheduler using the same service; test short intervals, concurrent processes, failed/partial fetches, timestamp retention and duplicate prevention with PostgreSQL. Do not claim periodic sync success from existing CLI tests.

Deployment remains unapproved. Required components: React hosting, FastAPI runtime, persistent PostgreSQL, plus a scheduler worker or platform cron to be selected/validated against deployment configuration. No paid resource, push, merge or deployment was performed. Cloud preview remains http://localhost:5173 inside the cloud browser, not laptop localhost.
