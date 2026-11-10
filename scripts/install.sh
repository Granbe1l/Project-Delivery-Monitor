#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export UV_CACHE_DIR="${UV_CACHE_DIR:-$PWD/.cache/uv}"
uv sync --project backend --frozen
npm ci --prefix frontend --cache "${npm_config_cache:-$PWD/.cache/npm}"
