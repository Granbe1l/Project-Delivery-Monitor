# Deploy frontend to Vercel

1. Deploy the existing FastAPI Docker backend to a container host and attach persistent PostgreSQL. Set DATABASE_URL (TLS) and exact CORS_ORIGINS. The supplied single-instance Render template initializes migrations/identities at startup; verify GET /health/ready.
2. Run `python -m app.jobs.sync --all` on that backend host and inspect coverage for all three projects. Never add a browser-accessible sync endpoint.
3. Import Granbe1l/Project-Delivery-Monitor, branch work, into Vercel. Root Directory: `.`. The root vercel.json supplies installation/build/output settings.
4. Set VITE_PUBLIC_API_BASE_URL to the public HTTPS backend origin, without `/api` or trailing slash. No database URL/token belongs in Vercel frontend environment values.
5. Deploy only after approving provider terms/costs. Confirm CORS_ORIGINS contains the final Vercel origin. Verify direct deep links, API requests, source dates, search and export from your laptop.
6. Optionally provision an approved backend worker with command `python -m app.jobs.scheduler`, same DB/token settings, SYNC_INTERVAL_SECONDS=21600. This worker is implemented but not deployed. Validate two actual scheduled runs, logs, source timestamps and retained-data behavior before calling auto-refresh operational.

No paid service is required or activated by importing source alone; do not assume every hosting component has a sustainable free tier. See DEPLOYMENT.md for constraints. Snapshot/closed-PR analyses not present in source are not added by deployment.

Local validation for this update: 45 backend tests (including six scheduler cases), 11 frontend tests, eight deployment-origin tests, production Vercel-mode build, frontend lint and backend changed-file lint passed. No public deployment or real scheduled GitHub run claimed. Existing Starlette/httpx deprecation warning remains. Root and frontend Vercel config JSON parsed successfully; provider-side build/routing still require acceptance testing.
