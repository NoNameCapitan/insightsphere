#!/usr/bin/env python3
"""
api/index.py — default Vercel Python entrypoint.

Vercel's current Python runtime auto-detects supported entrypoint filenames such
as api/index.py. The real demo implementation lives in api/recommend.py; this
file re-exports its BaseHTTPRequestHandler subclass so Vercel has a default
entrypoint and the frontend can call /api reliably.
"""

from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from recommend import handler as handler  # noqa: E402,F401
