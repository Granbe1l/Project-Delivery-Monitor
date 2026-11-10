#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose up -d --wait db
(cd backend && .venv/bin/alembic upgrade head && .venv/bin/python -m app.jobs.init_db)
# Both child processes end when this foreground supervisor exits.
(cd backend && exec .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000) &
backend_pid=$!
(cd frontend && exec node node_modules/vite/bin/vite.js --host 0.0.0.0 --port 5173 --strictPort) &
frontend_pid=$!
trap 'kill "$backend_pid" "$frontend_pid" 2>/dev/null || true' EXIT INT TERM
wait -n "$backend_pid" "$frontend_pid"
