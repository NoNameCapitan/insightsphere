#!/usr/bin/env python3
"""
app.py — Vercel entrypoint for the public demo.

This file is intentionally separate from the local-first desktop/self-test app.
Vercel loads this BaseHTTPRequestHandler as the project entrypoint. It serves:
- GET /                  -> static demo UI from index.html
- GET /api               -> API health payload
- POST /api              -> stateless demo recommendation JSON
- GET/POST /api/recommend -> same API, for compatibility

No local HTTPServer, no serve_forever, no 127.0.0.1 binding, no personal state.
"""

import json
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse

from api._engine import demo_recommend

ROOT = Path(__file__).resolve().parent
INDEX_HTML = ROOT / "index.html"


class handler(BaseHTTPRequestHandler):  # noqa: N801 - Vercel expects this name
    def _send_bytes(self, data: bytes, status: int = 200, content_type: str = "text/plain; charset=utf-8"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store" if self.path.startswith("/api") else "public, max-age=0, must-revalidate")
        self.end_headers()
        self.wfile.write(data)

    def _send_json(self, obj, status: int = 200):
        self._send_bytes(json.dumps(obj, ensure_ascii=False).encode("utf-8"), status, "application/json; charset=utf-8")

    def _send_index(self):
        try:
            data = INDEX_HTML.read_bytes()
        except OSError:
            return self._send_json({"ok": False, "error": "index.html not found in deployment bundle."}, 500)
        return self._send_bytes(data, 200, "text/html; charset=utf-8")

    def _is_api_path(self) -> bool:
        path = urlparse(self.path).path.rstrip("/")
        return path in {"/api", "/api/recommend"}

    def do_GET(self):
        path = urlparse(self.path).path
        if self._is_api_path():
            return self._send_json({
                "ok": True,
                "service": "music-dna-copilot demo API",
                "usage": "POST JSON to /api: {source: demo|owner_demo|paste, tracks_text?, mood:-2..2, task, novelty:1..5, strictness?, include?, exclude?}",
            })
        if path in {"/", "/index.html"}:
            return self._send_index()
        # Single-page static demo fallback: unknown non-API paths return the UI.
        return self._send_index()

    def do_POST(self):
        if not self._is_api_path():
            return self._send_json({"ok": False, "error": "POST is only supported on /api."}, 404)
        try:
            length = int(self.headers.get("Content-Length", 0) or 0)
            if length > 64 * 1024:
                return self._send_json({"ok": False, "error": "Request too large."}, 413)
            body = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
        except (ValueError, UnicodeDecodeError):
            return self._send_json({"ok": False, "error": "Invalid JSON body."}, 400)
        try:
            return self._send_json(demo_recommend(body))
        except ValueError as exc:
            return self._send_json({"ok": False, "error": str(exc)}, 400)
        except Exception:
            return self._send_json({
                "ok": False,
                "error": "Recommendation engine error. Try the demo source, or run the full local app for details.",
            }, 500)
