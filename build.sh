#!/usr/bin/env bash
# Used when Render Root Directory is empty (repo root).
set -euo pipefail
pip install --upgrade pip
pip install -r requirements.txt
