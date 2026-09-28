#!/usr/bin/env python3
"""
test_release.py
===============
Verifies the release packaging is safe: the dry-run excludes secrets/personal data
and includes friend-facing files, the built zip is clean, and release_check passes.
Offline. No network.
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
    print(f"  {'PASS' if cond else 'FAIL'}  {name}" + (f"  [{detail}]" if detail and not cond else ""))


class Result:
    def __init__(self, returncode, stdout="", stderr=""):
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr


def run(args, timeout=120):
    import contextlib
    import io
    import make_release_zip
    import release_check

    buf_out, buf_err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(buf_out), contextlib.redirect_stderr(buf_err):
        try:
            if args[0].endswith("make_release_zip.py"):
                rc = make_release_zip.main(args[1:])
            elif args[0].endswith("release_check.py"):
                rc = release_check.main()
            else:
                rc = 1
                print(f"Unsupported in-process test command: {args}")
        except SystemExit as exc:
            rc = int(exc.code or 0)
        except Exception as exc:
            rc = 1
            print(str(exc), file=sys.stderr)
    return Result(rc, buf_out.getvalue(), buf_err.getvalue())


def main():
    # Seed sensitive files so we prove they are excluded.
    (ROOT / "outputs").mkdir(exist_ok=True)
    (ROOT / "outputs" / "favorites.jsonl").write_text('{"x":1}\n', encoding="utf-8")
    (ROOT / "outputs" / "spotify_token.json").write_text('{"access_token":"SECRET"}', encoding="utf-8")
    (ROOT / "outputs" / "local_config.json").write_text('{"lastfm":{"api_key":"SECRET"}}', encoding="utf-8")
    env_created = False
    if not (ROOT / ".env").exists():
        (ROOT / ".env").write_text("LASTFM_API_KEY=secret\n", encoding="utf-8")
        env_created = True

    print("Release: dry-run")
    r = run(["scripts/make_release_zip.py", "--dry-run"])
    out = r.stdout
    check("dry-run runs", r.returncode == 0)
    check("dry-run excludes .env", ".env  [" in out or "/.env  [" in out)
    check("dry-run excludes outputs/ data", "outputs/favorites.jsonl" in out)
    check("dry-run excludes token file", "spotify_token.json" in out)
    check("dry-run reports no secrets included", "in INCLUDED set: none" in out)
    check("dry-run includes friend doc", "START_FOR_FRIEND.md" in out)

    print("Release: build zip")
    r = run(["scripts/make_release_zip.py"])
    check("build runs", r.returncode == 0 and ZIP_PATH.exists())
    with zipfile.ZipFile(ZIP_PATH) as zf:
        names = [Path(n).name for n in zf.namelist()]
        full = zf.namelist()
    check("zip has no .env", ".env" not in names)
    check("zip has no token files", not any("token" in n.lower() for n in names))
    check("zip has no local_config.json", "local_config.json" not in names)
    check("zip has no personal jsonl",
          not any(n in names for n in ("favorites.jsonl", "feedback.jsonl", "shortlist.jsonl")))
    check("zip has no outputs data",
          not any(p.split("/")[1:2] == ["outputs"] and not p.endswith(".gitkeep") for p in full))
    check("zip includes genre taxonomy", any(n == "genre_taxonomy.json" for n in names))
    check("zip includes START_FOR_FRIEND.md", "START_FOR_FRIEND.md" in names)
    check("zip includes .env.example", ".env.example" in names)

    print("Release: safety check")
    r = run(["scripts/release_check.py"])
    check("release_check passes", r.returncode == 0,
          (r.stdout + r.stderr).strip().splitlines()[-1] if (r.stdout or r.stderr) else "")

    # cleanup seeded files
    for f in ("outputs/favorites.jsonl", "outputs/spotify_token.json", "outputs/local_config.json"):
        try:
            (ROOT / f).unlink()
        except OSError:
            pass
    if env_created:
        try:
            (ROOT / ".env").unlink()
        except OSError:
            pass

    print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
