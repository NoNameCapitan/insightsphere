#!/usr/bin/env python3
"""Start the freshly built desktop binary headless and prove it works.

Used by .github/workflows/desktop-app.yml on Windows, macOS and Linux:
health check, the app page, a demo DNA build and a capsule, with the data
folder pointed at a temporary directory.
"""
import json
import platform
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "build" / "desktop" / "dist"
PORT = 8877


def binary():
    system = platform.system()
    if system == "Windows":
        return DIST / "Music DNA Copilot" / "Music DNA Copilot.exe"
    if system == "Darwin":
        return DIST / "Music DNA Copilot.app" / "Contents" / "MacOS" / "Music DNA Copilot"
    return DIST / "music-dna-copilot" / "music-dna-copilot"


def call(path, body=None):
    req = urllib.request.Request(f"http://127.0.0.1:{PORT}{path}", method="POST" if body is not None else "GET",
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"X-MusicDNA-Client": "3", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.status, resp.read().decode("utf-8")


def main():
    exe = binary()
    if not exe.exists():
        sys.exit(f"binary not found: {exe}")
    data = tempfile.mkdtemp(prefix="mdna-ci-")
    proc = subprocess.Popen([str(exe), "--headless", "--port", str(PORT), "--data-dir", data])
    failures = []
    try:
        for _ in range(120):
            try:
                if call("/health")[0] == 200:
                    break
            except Exception:
                time.sleep(0.5)
        else:
            sys.exit("the app did not answer /health within 60 s")
        checks = {
            "app page": lambda: "/assets/app.js" in call("/")[1],
            "classic workspace": lambda: call("/classic")[0] == 200,
            "state API": lambda: json.loads(call("/api/v3/state")[1])["version"].startswith("3."),
            "demo DNA build": lambda: '"step": "done"' in call("/api/v3/dna/build", {"demo": True})[1],
            "capsule": lambda: len(json.loads(call("/api/v3/capsules", {"tier": "common", "intent": "focus"})[1])["capsule"]["tracks"]) > 0,
            "sources with live connectors": lambda: any(c["id"] == "listenbrainz" for c in json.loads(call("/api/v3/sources")[1])["cards"]),
            "data written to the chosen folder": lambda: (Path(data) / "v3" / "dna.json").exists(),
        }
        for name, fn in checks.items():
            try:
                ok = bool(fn())
            except Exception as exc:  # report every failure, not just the first
                ok = False
                name += f" ({exc})"
            print(("PASS " if ok else "FAIL ") + name)
            if not ok:
                failures.append(name)
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
    if failures:
        sys.exit(f"{len(failures)} check(s) failed")
    print("packaged app OK")


if __name__ == "__main__":
    main()
