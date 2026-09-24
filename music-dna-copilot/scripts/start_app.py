#!/usr/bin/env python3
"""
start_app.py
============
One-click launcher for the Music DNA Copilot local app.

What it does:
    1. Starts the local server (default port 8765; if busy, picks the
       next free port automatically).
    2. Opens your browser at the right address.
    3. Prints a clear status message, including a note when the chosen
       port differs from the one your Spotify redirect URI is
       registered for (Spotify requires the exact registered callback
       URL, so connecting Spotify only works on that port).

Used by the double-click launchers:
    start_mac.command / start_windows.bat / start_linux.sh

Developers can equally run:
    python scripts/local_interface.py [--port N] [--open]
"""

import os
import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
ROOT = SCRIPTS.parents[0]
sys.path.insert(0, str(SCRIPTS))

import local_interface  # noqa: E402


def _load_env():
    try:
        import env_loader
        env_loader.load()
    except Exception:
        pass


def _data_counts():
    try:
        from mtr_app import data_management as dm
        out = []
        for info in dm.file_status(local_interface.OUTPUTS):
            if info["exists"]:
                c = "" if info["count"] is None else f"{info['count']} items"
                out.append(f"      - {info['path']}: {c or 'present'}")
        return out or ["      - (no personal data saved yet)"]
    except Exception:
        return ["      - (data status unavailable)"]


def status_check():
    _load_env()
    host = getattr(local_interface, "HOST", "127.0.0.1")
    port = getattr(local_interface, "DEFAULT_PORT", 8765)
    env_path = ROOT / ".env"
    spotify_id = bool(os.environ.get("SPOTIFY_CLIENT_ID", "").strip())
    spotify_token = (local_interface.OUTPUTS / "spotify_token.json").exists()
    lastfm = bool(os.environ.get("LASTFM_API_KEY", "").strip()
                  and os.environ.get("LASTFM_USERNAME", "").strip())
    smoke_marker = ROOT / "outputs" / ".last_smoke_status"
    smoke_status = smoke_marker.read_text(encoding="utf-8").strip() if smoke_marker.exists() else "unknown (run: python3 -u scripts/smoke_test.py)"

    print("Music DNA Copilot — status check")
    print("=" * 44)
    print(f"  Python:           {sys.version.split()[0]}")
    print(f"  Project root:     {ROOT}")
    print(f"  Output directory: {local_interface.OUTPUTS}")
    print(f"  .env present:     {'yes' if env_path.exists() else 'no'}")
    print(f"  Spotify config:   {'client id set' if spotify_id else 'not configured'}"
          f"{', token saved' if spotify_token else ''}")
    print(f"  Last.fm config:   {'configured' if lastfm else 'not configured (optional)'}")
    print(f"  Last smoke test:  {smoke_status}")
    print("  Local data:")
    for line in _data_counts():
        print(line)
    print(f"  Open in browser:  http://{host}:{port}/")
    print("=" * 44)
    print("  Start the app with:  python3 scripts/start_app.py")
    return 0


def main():
    if "--check" in sys.argv or "-check" in sys.argv:
        return status_check()
    try:
        local_interface.serve(open_browser=True)
    except KeyboardInterrupt:
        print("\nStopped. Your data is still in the local outputs/ folder.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
