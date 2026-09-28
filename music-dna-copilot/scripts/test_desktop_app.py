#!/usr/bin/env python3
"""Desktop launcher tests (stdlib only): data-folder choice, single-instance
health probe, windowed builds without stdio, and a headless start."""
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT))
import desktop_app as da  # noqa: E402

PASSED, FAILED = [], []


def check(name, cond, detail=""):
    (PASSED if cond else FAILED).append(name)
    print(f"  {'PASS' if cond else 'FAIL'}  {name}" + (f"  ({detail})" if detail and not cond else ""))


def main():
    print("1. Where data lives")
    os.environ.pop("MTR_OUTPUTS_DIR", None)
    tmp = Path(tempfile.mkdtemp())
    check("explicit --data-dir wins", da.choose_data_dir(str(tmp / "x")) == (tmp / "x").resolve())
    os.environ["MTR_OUTPUTS_DIR"] = str(tmp / "env")
    check("MTR_OUTPUTS_DIR respected", da.choose_data_dir(None) == tmp / "env")
    os.environ.pop("MTR_OUTPUTS_DIR")
    check("from source: keeps ./outputs", da.choose_data_dir(None) == ROOT / "outputs")
    da.FROZEN = True
    os.environ["XDG_DATA_HOME"] = str(tmp / "xdg")
    got = da.choose_data_dir(None)
    da.FROZEN = False
    if sys.platform.startswith("linux"):
        check("installed app: per-user data folder", got == tmp / "xdg" / "music-dna-copilot" / "outputs", got)
    else:
        check("installed app: per-user data folder", "Music DNA Copilot" in str(got), got)

    print("2. Windowed build without console streams")
    data = tempfile.mkdtemp()
    port = 8866
    code = ("import sys, runpy; sys.stdout = None; sys.stderr = None; "
            f"sys.argv = ['desktop_app.py', '--headless', '--port', '{port}', '--data-dir', {data!r}]; "
            "runpy.run_path('desktop_app.py', run_name='__main__')")
    proc = subprocess.Popen([sys.executable, "-c", code], cwd=str(ROOT))
    try:
        ok = False
        for _ in range(80):
            if da.health(port, 0.5):
                ok = True
                break
            time.sleep(0.25)
        check("server answers /health", ok)
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=5) as r:
            check("app page served with no stdio", r.status == 200 and b"/assets/app.js" in r.read())
        req = urllib.request.Request(f"http://127.0.0.1:{port}/api/v3/dna/build", data=b'{"demo": true}', method="POST",
                                     headers={"X-MusicDNA-Client": "3", "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=60) as r:
            check("demo DNA builds", b'"step": "done"' in r.read())
        check("data written to the chosen folder", (Path(data) / "v3" / "dna.json").exists())
        check("console output went to app.log", "running at" in (Path(data) / "app.log").read_text(encoding="utf-8"))
        check("single-instance probe sees the running app", bool(da.health(port)))
    finally:
        proc.terminate()
        proc.wait(timeout=10)
    check("probe reports nothing on a closed port", da.health(port, 0.3) is None)

    print("3. Browser window")
    os.environ["MTR_APP_BROWSER"] = "/definitely/not/here"
    check("missing override browser -> fallback path", da.find_app_browser() is None)
    os.environ.pop("MTR_APP_BROWSER")
    check("candidate list is a list", isinstance(da._candidates(), list))

    print(f"\n{len(PASSED)} passed, {len(FAILED)} failed")
    return 0 if not FAILED else 1


if __name__ == "__main__":
    sys.exit(main())
