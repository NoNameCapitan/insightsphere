#!/bin/bash
# Music DNA Copilot — macOS launcher (double-click me)
cd "$(dirname "$0")"
if command -v python3 >/dev/null 2>&1; then PY=python3; else PY=python; fi
exec "$PY" run_app.py
