#!/usr/bin/env python3
"""
test_data_management.py
=======================
Offline tests for the local data-management helper. No network, no shared
state — everything runs against a throwaway temp base dir.
"""

import sys
import json
import tempfile
import zipfile
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS))

from mtr_app import data_management as dm

PASS, FAIL = [], []


def check(name, cond):
    (PASS if cond else FAIL).append(name)
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")


def seed(base):
    base.mkdir(parents=True, exist_ok=True)
    (base / "favorites.jsonl").write_text(
        '{"artist":"A","track_title":"x"}\n{"artist":"B","track_title":"y"}\n', encoding="utf-8")
    (base / "shortlist.jsonl").write_text('{"artist":"C","track_title":"z"}\n', encoding="utf-8")
    (base / "rejects.jsonl").write_text('{"artist":"D","track_title":"w"}\n', encoding="utf-8")
    (base / "listen_later.jsonl").write_text("", encoding="utf-8")
    (base / "feedback.jsonl").write_text('{"action":"like"}\n', encoding="utf-8")
    (base / "personal_presets.json").write_text('[{"id":"custom:1","name":"P"}]', encoding="utf-8")
    (base / "music_dna_report.md").write_text("# Music DNA\n", encoding="utf-8")
    (base / "spotify_token.json").write_text('{"access_token":"keepme"}', encoding="utf-8")
    cache = base / "cache"
    cache.mkdir(exist_ok=True)
    (cache / "lastfm_tags_cache.json").write_text('{"k":{"tags":["x"]}}', encoding="utf-8")


def main():
    print("Data management: file status")
    with tempfile.TemporaryDirectory() as d:
        base = Path(d)
        seed(base)
        status = dm.file_status(base)
        by_key = {s["key"]: s for s in status}
        check("status lists all known files", set(by_key) >= {
            "favorites", "shortlist", "rejects", "listen_later", "feedback",
            "personal_presets", "music_dna_report", "lastfm_tag_cache", "spotify_token"})
        check("favorites counted (2 items)", by_key["favorites"]["count"] == 2)
        check("favorites marked exists with size", by_key["favorites"]["exists"]
              and by_key["favorites"]["size"] > 0)
        check("existing file has modified timestamp", bool(by_key["favorites"]["modified"]))
        # a file that was not seeded should be reported absent
        os_status = dm.file_status(base / "does-not-exist")
        check("absent files reported not-exists", all(not s["exists"] for s in os_status))

    print("Data management: backup bundle")
    with tempfile.TemporaryDirectory() as d:
        base = Path(d)
        seed(base)
        dest = dm.export_backup(base)
        check("backup zip created", dest.exists() and dest.suffix == ".zip")
        with zipfile.ZipFile(dest) as zf:
            names = zf.namelist()
        check("backup contains favorites + manifest",
              "favorites.jsonl" in names and "backup_manifest.json" in names)
        check("backup excludes spotify token", "spotify_token.json" not in names)
        fname, blob = dm.export_backup_bytes(base)
        check("in-memory backup returns bytes", fname.endswith(".zip") and len(blob) > 0)

    print("Data management: clear actions")
    with tempfile.TemporaryDirectory() as d:
        base = Path(d)
        seed(base)
        removed = dm.clear(base, "shortlist")
        check("clear shortlist removes file",
              "shortlist.jsonl" in removed and not (base / "shortlist.jsonl").exists())
        check("clear shortlist keeps favorites", (base / "favorites.jsonl").exists())
        dm.clear(base, "tag_cache")
        check("clear cache removes tag cache",
              not (base / "cache" / "lastfm_tags_cache.json").exists())
        try:
            dm.clear(base, "nonsense")
            check("unknown clear action rejected", False)
        except ValueError:
            check("unknown clear action rejected", True)

    print("Data management: full reset requires confirmation")
    with tempfile.TemporaryDirectory() as d:
        base = Path(d)
        seed(base)
        try:
            dm.full_reset(base, confirm=False)
            check("full reset without confirm blocked", False)
        except PermissionError:
            check("full reset without confirm blocked", True)
        check("favorites still present after blocked reset", (base / "favorites.jsonl").exists())
        dm.full_reset(base, confirm=True)
        check("favorites removed after confirmed reset", not (base / "favorites.jsonl").exists())
        check("presets removed after confirmed reset", not (base / "personal_presets.json").exists())
        check("spotify token preserved by full reset", (base / "spotify_token.json").exists())

    print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
