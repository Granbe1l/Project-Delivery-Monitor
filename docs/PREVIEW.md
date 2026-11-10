# Viewing the running application

## Immediately available visual preview

- [Actual desktop dashboard](screenshots/overview-live-desktop.png)
- [Actual mobile dashboard](screenshots/overview-live-mobile.png)
- [Actual workflow view](screenshots/ci-live-desktop.png)

These were captured in Chromium from the running React application using the actual FastAPI/PostgreSQL observations. No response mocks or test data were used for these images. Data is time-stamped and scoped, not real-time.

## Interactive view in the cloud Desktop

In the Codex right side panel, choose **New tab (+) → Desktop** if available. Opening the viewer starts the on-demand desktop. Open Chrome there and type `http://localhost:5173` into its address bar. This address belongs to the cloud machine; opening it in a browser on your own computer targets your own computer instead.

The API is on port 8000. The frontend and API were started with `scripts/start.sh` and left running in this session. If a later task restores the environment, run this script from `/workspace/Project-Delivery-Monitor` again, then check `/health/ready` and the dashboard. Processes do not persist through environment snapshots.

The agent could verify the UI with automated Chromium but could not open or control the shared Desktop: neither `cua_repl.js` nor `open_in_codex` was offered. Runtime status reported `remote_desktop.enabled=true`, `state=unknown`; DISPLAY was unset and no Chrome CDP endpoint was listening. The Desktop viewer interaction above has therefore **not been verified by the agent** in this session.

Diagnostic environment ID: `ccarenv_b64_Y2NhcmVudl9mODAwNzhhY2E3NDg4MTkxYmVlYWU3ODNkMGZkMzQxMA`. No public preview URL or tunnel has been created, and cloud-environment publication does not itself publish this app to the Internet.

## Reproduce the UI checks

With the app running and real data synced, from `frontend/`:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e:live
```

The suite compares rendered values to the running API, exercises actual records/filters/milestone pagination/downloads, checks automated accessibility at desktop/mobile widths, and refreshes the screenshots above. It expects all three projects to have collected data and Streamlit to have at least two observations. It never invokes GitHub sync itself or seeds fixture data.

## Run on your own machine when cloud Desktop is unavailable

Use the source ZIP supplied with the final report, extract it, and enter `Project-Delivery-Monitor/`. This archive contains source/lockfiles/docs, not the cloud database, installed dependencies or credentials. Requirements: Python 3.12+, uv, Node 22+, npm and a running Docker engine with Compose. The scripts use an ignored cache inside the checkout, so they do not require a `/workspace` directory on your computer.

```bash
./scripts/install.sh
./scripts/start.sh
```

Leave that terminal running. In a second terminal, fetch actual GitHub data:

```bash
cd Project-Delivery-Monitor/backend
.venv/bin/python -m app.jobs.sync --all
# Optional: collect a second real Streamlit observation for the history view.
.venv/bin/python -m app.jobs.sync --repo streamlit/streamlit
```

Now open `http://localhost:5173` in your own browser and reload after collection. Keep data partial/unavailable if GitHub limits access; an optional read-only server-side token can be set in `.env` locally. Never put a token in chat or a `VITE_` variable.

To start the services individually instead of using the supervisor:

```bash
# Repository root: database only
docker compose up -d --wait db

# Terminal 1: backend
cd backend
.venv/bin/alembic upgrade head
.venv/bin/python -m app.jobs.init_db
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000

# Terminal 2: frontend, from repository root
cd frontend
npm run dev -- --port 5173 --strictPort
```

The Vite development server forwards `/api` requests to port 8000. PostgreSQL is bound to loopback port 5432 and retains its named Docker volume. Do not remove that volume to run tests. The isolated backend test database is created once with `docker compose exec db createdb -U pdm pdm_test`.
