#!/usr/bin/env python3
"""
make_release_zip.py
===================
Build a clean, shareable release archive
containing only the code, docs, and examples a friend needs to run the app —
never personal data, secrets, tokens, caches, or generated outputs.

    python3 scripts/make_release_zip.py            # build the zip
    python3 scripts/make_release_zip.py --dry-run   # list what would be in/out

Stdlib only. Local only.
"""

import sys
import zipfile
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
ROOT = SCRIPTS.parents[0]
RELEASE_NAME = "music-dna-copilot"
DIST = ROOT / "dist"
ZIP_PATH = DIST / f"{RELEASE_NAME}.zip"

# Top-level entries that may be included (whitelist — anything not listed here
# is ignored entirely, so stray files never leak into a release).
INCLUDE_TOP = [
    "scripts", "examples", "schemas", "data", "ux", "docs", "api",
    "index.html", "app.py", "vercel.json", "pyproject.toml", "VERCEL_DEPLOY.md",
    ".env.example", "requirements.txt", ".gitignore",
    "start_linux.sh", "start_mac.command", "start_windows.bat",
    "run_app.py", "RUN_APP_WINDOWS.bat", "RUN_APP_MAC.command", "RUN_APP_LINUX.sh", ".claude",
    # docs
    "README.md", "README_FOR_NORMAL_USER.md", "START_HERE.md", "START_FOR_FRIEND.md", "SELF_TEST_PLAN.md",
    "DAILY_USE.md", "RC_CHECKLIST.md", "CONNECTORS.md", "KNOWN_LIMITATIONS.md",
    "LASTFM_SETUP.md", "SPOTIFY_SETUP.md", "LOCAL_APP.md", "MONETIZATION.md",
    "roadmap.md", "CHANGELOG.md", "MERGE_NOTES.md", "VERSION", "DEMO.md", "AI_SKILL_USAGE.md", "SKILL.md",
]

# Directory names that are excluded wherever they appear.
EXCLUDE_DIRS = {"__pycache__", ".pytest_cache", ".git", "dist", "outputs", "cache",
                "backups", ".ipynb_checkpoints", "node_modules", ".venv", "venv"}

# Exact filenames that must never ship (secrets / personal data / generated).
EXCLUDE_NAMES = {
    ".env", ".DS_Store", ".last_smoke_status",
    "spotify_token.json", "spotify_tokens.json", "token.json", "tokens.json",
    "personal_presets.json", "favorites.jsonl", "rejects.jsonl",
    "listen_later.jsonl", "shortlist.jsonl", "feedback.jsonl",
    "music_dna_report.md", "manual_quality_check.md", "local_config.json",
    # multi-source personal imports/exports (normally in outputs/, belt and braces)
    "spotify_history.json", "youtube_takeout_normalized.json", "lastfm_normalized.json",
    "merged_listening_history.json", "source_coverage.json", "portable_music_dna.json",
    "portable_music_dna.md", "portable_music_dna_prompt.md", "music_dna_card.html",
    "local_enriched_history.json", "watch-history.json", "watch-history.html",
}

# Filename suffixes that must never ship.
EXCLUDE_SUFFIXES = {".pyc", ".pyo", ".log", ".bak", ".tmp", ".swp", ".orig", ".zip"}

# Filename substrings that flag generated/personal artifacts.
EXCLUDE_SUBSTRINGS = ("_token", "secret", "credential")


def _excluded(path: Path):
    """Return a reason string if this file should be excluded, else None."""
    parts = set(path.parts)
    hit = parts & EXCLUDE_DIRS
    if hit:
        return f"in excluded dir: {sorted(hit)[0]}"
    name = path.name
    if name in EXCLUDE_NAMES:
        return "excluded filename"
    if path.suffix in EXCLUDE_SUFFIXES:
        return f"excluded suffix {path.suffix}"
    low = name.lower()
    for sub in EXCLUDE_SUBSTRINGS:
        if sub in low and name != ".env.example":
            return f"matches '{sub}'"
    return None


def collect():
    """Return (included, excluded) lists of (relative_path, reason).

    `included` follows the top-level whitelist + per-file exclusion rules.
    `excluded` is every other file under the project root (so the dry-run
    visibly proves .env, outputs/, tokens, caches, etc. are left out)."""
    included, excluded = [], []
    include_set = set()
    for top in INCLUDE_TOP:
        src = ROOT / top
        if not src.exists():
            continue
        files = [src] if src.is_file() else [p for p in src.rglob("*") if p.is_file()]
        for p in files:
            rel = p.relative_to(ROOT)
            reason = _excluded(rel)
            if reason:
                excluded.append((rel, reason))
            else:
                included.append((rel, ""))
                include_set.add(rel)
    # Sweep the rest of the tree so excluded reporting is honest/complete.
    for p in sorted(ROOT.rglob("*")):
        if not p.is_file():
            continue
        rel = p.relative_to(ROOT)
        if rel in include_set or any(r == rel for r, _ in excluded):
            continue
        if ".git" in rel.parts:
            continue
        reason = _excluded(rel) or "not in release whitelist"
        excluded.append((rel, reason))
    included.sort()
    excluded.sort()
    return included, excluded


def build_zip():
    DIST.mkdir(exist_ok=True)
    # Ensure exactly one release artifact: remove any pre-existing archives in dist/.
    for old in DIST.glob("*.zip"):
        try:
            old.unlink()
        except OSError:
            pass
    included, _ = collect()
    with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED) as zf:
        for rel, _ in included:
            zf.write(ROOT / rel, arcname=f"{RELEASE_NAME}/{rel.as_posix()}")
        # Empty outputs/ with a .gitkeep so first run has a writable folder.
        zf.writestr(f"{RELEASE_NAME}/outputs/.gitkeep", "")
    return included


def main(argv):
    dry = "--dry-run" in argv or "-n" in argv
    included, excluded = collect()
    if dry:
        print(f"Release: {RELEASE_NAME}  ->  {ZIP_PATH.relative_to(ROOT)}")
        print(f"\nINCLUDED ({len(included)} files):")
        for rel, _ in included:
            print(f"  + {rel.as_posix()}")
        print(f"\nEXCLUDED ({len(excluded)} files):")
        for rel, reason in excluded:
            print(f"  - {rel.as_posix()}  [{reason}]")
        # Loud confirmation of the security-critical exclusions.
        leaked = [rel.as_posix() for rel, _ in included
                  if rel.name in EXCLUDE_NAMES or "outputs" in rel.parts]
        print(f"\nSecrets/personal data in INCLUDED set: {leaked or 'none'} (must be none)")
        print("\nDry run only — no archive written.")
        return 0
    included = build_zip()
    size = ZIP_PATH.stat().st_size
    print(f"Wrote {ZIP_PATH.relative_to(ROOT)} ({len(included)} files, {size:,} bytes).")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
