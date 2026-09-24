#!/usr/bin/env python3
"""
api/recommend.py — Vercel Python Serverless Function.

Vercel's Python runtime natively supports a BaseHTTPRequestHandler subclass named
`handler` (zero dependencies). This is a per-request serverless entrypoint: no
HTTPServer instance, no serve_forever loop, no 127.0.0.1 binding, no local state.

POST /api/recommend  {source, tracks_text?, mood, task, novelty, max?,
                      strictness?, include?, exclude?}  -> JSON
GET  /api/recommend  -> small health/info payload
"""

import json
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _engine import demo_recommend  # noqa: E402


class handler(BaseHTTPRequestHandler):  # noqa: N801 (Vercel requires this name)

    def _send(self, obj, status=200):
        data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        self._send({"ok": True, "service": "music-dna-copilot demo API",
                    "usage": "POST JSON: {source: demo|owner_demo|paste, tracks_text?, "
                             "mood:-2..2, task, novelty:1..5, strictness?, include?, exclude?}"})

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0) or 0)
            if length > 64 * 1024:
                return self._send({"ok": False, "error": "Request too large."}, 413)
            body = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
        except (ValueError, UnicodeDecodeError):
            return self._send({"ok": False, "error": "Invalid JSON body."}, 400)
        try:
            return self._send(demo_recommend(body))
        except ValueError as exc:
            return self._send({"ok": False, "error": str(exc)}, 400)
        except Exception:
            return self._send({"ok": False,
                               "error": "Recommendation engine error. Try the demo source, "
                                        "or run the full local app for details."}, 500)
