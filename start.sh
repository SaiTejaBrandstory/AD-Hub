#!/usr/bin/env bash
# Render runs from repo root when Root Directory is empty.
set -euo pipefail
cd "$(dirname "$0")/backend"
exec uvicorn server:app --host 0.0.0.0 --port "${PORT:-8000}"
