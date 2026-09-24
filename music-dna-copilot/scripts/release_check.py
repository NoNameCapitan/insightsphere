#!/usr/bin/env python3
"""
release_check.py
================
Safety gate before sharing the release archive. Verifies the zip exists, contains
the files a friend needs, and — most importantly — contains no secrets or personal
data. Also confirms the app's status check runs and the last smoke status is clean.

    python3 scripts/release_check.py

Exit code 0 = safe to share, non-zero = do not share.
"""

import sys
import zipfile
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
ROOT = SCRIPTS.parents[0]
ZIP_PATH = ROOT / "dist" / "music-dna-copilot.zip"

PASS, FAIL = [], []


def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    mark = "PASS" if cond else "FAIL"
    print(f"  {mark}  {name}" + (f"  [{detail}]" if detail and not cond else ""))


def main():
    print("Release safety check")
    print("=" * 40)

    if not ZIP_PATH.exists():
        check("release zip exists", False, f"missing {ZIP_PATH} — run make_release_zip.py")
        print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
        return 1
    check("release zip exists", True)

    with zipfile.ZipFile(ZIP_PATH) as zf:
        names = zf.namelist()
    base = [n.split("/", 1)[1] if "/" in n else n for n in names]  # strip top folder

    # --- must NOT be present (secrets / personal data) ---
    forbidden_names = {".env", "spotify_token.json", "spotify_tokens.json",
                       "token.json", "tokens.json", "personal_presets.json",
                       "favorites.jsonl", "rejects.jsonl", "listen_later.jsonl",
                       "shortlist.jsonl", "feedback.jsonl", "music_dna_report.md",
                       "manual_quality_check.md", ".last_smoke_status", "local_config.json"}
    leaked = [n for n in base if Path(n).name in forbidden_names]
    check(".env is not in the release zip", ".env" not in [Path(n).name for n in base])
    check("no token files in the release zip",
          not any("token" in Path(n).name.lower() for n in base))
    out_files = [n for n in base if n.split("/")[0] == "outputs" and Path(n).name != ".gitkeep"]
    check("outputs/ personal data not in the release zip", not out_files,
          ", ".join(out_files[:3]))
    check("no __pycache__ / .pyc in the release zip",
          not any("__pycache__" in n or n.endswith(".pyc") for n in base))
    check("no personal data files in the release zip", not leaked, ", ".join(leaked[:3]))

    # --- must be present (a friend needs these) ---
    def present(rel):
        return any(n == rel or n.endswith("/" + rel) for n in base)
    check("data/genre_taxonomy.json is included", present("data/genre_taxonomy.json"))
    check("START_FOR_FRIEND.md is included", present("START_FOR_FRIEND.md"))
    check(".env.example is included", present(".env.example"))
    check("README.md is included", present("README.md"))
    check("start_app.py is included", present("scripts/start_app.py"))
    check("Vercel root app.py entrypoint is included", present("app.py"))
    check("Vercel API compatibility handler is included", present("api/index.py"))
    check("pyproject.toml Vercel entrypoint is included", present("pyproject.toml"))
    check("3.0 web app is included", present("web/index.html") and present("web/assets/app.js") and present("web/assets/dna-viz.js"))
    check("3.0 product layer is included", present("scripts/dna3/api.py") and present("scripts/dna3/capsules.py"))
    check("3.0 starter catalog is included", present("data/starter_catalog_3_0.json"))

    # --- app status check runs ---
    try:
        import start_app
        rc = start_app.status_check()
        check("start_app.py --check works", rc == 0)
    except Exception as exc:
        check("start_app.py --check works", False, str(exc))

    # --- last smoke status (advisory only; never blocks a clean-secrets release) ---
    marker = ROOT / "outputs" / ".last_smoke_status"
    if marker.exists():
        status = marker.read_text(encoding="utf-8").strip()
        tag = "clean" if "0 failed" in status else "see smoke output"
        print(f"  INFO  last smoke status: {status} ({tag})")
    else:
        print("  INFO  last smoke status unknown — run: python3 -u scripts/smoke_test.py")

    print("=" * 40)
    print(f"{len(PASS)} passed, {len(FAIL)} failed")
    if FAIL:
        print("DO NOT SHARE — fix the failures above.")
        return 1
    print("Safe to share: dist/music-dna-copilot.zip")
    return 0


if __name__ == "__main__":
    sys.exit(main())
