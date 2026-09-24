#!/usr/bin/env python3
"""
data_management.py
==================
Local-only inspection, cleanup, and backup of the personal data the app
stores under outputs/. Stdlib only. No cloud, no accounts, no database.

Never touches: .env, source code, examples/, or built-in presets (those live
in code, not on disk — only *custom* presets are stored in personal_presets.json).
"""

import io
import json
import time
import zipfile
from datetime import datetime, timezone
from pathlib import Path

# Files we know about, in display order: (key, relative path, kind)
#   kind "jsonl"  -> line count is the item count
#   kind "json"   -> single document (count = top-level list/dict length if list)
#   kind "file"   -> just exists/size/mtime
DATA_FILES = [
    ("personal_presets", "personal_presets.json", "json_list"),
    ("favorites", "favorites.jsonl", "jsonl"),
    ("listen_later", "listen_later.jsonl", "jsonl"),
    ("shortlist", "shortlist.jsonl", "jsonl"),
    ("rejects", "rejects.jsonl", "jsonl"),
    ("feedback", "feedback.jsonl", "jsonl"),
    ("music_dna_report", "music_dna_report.md", "file"),
    ("lastfm_tag_cache", "cache/lastfm_tags_cache.json", "json_dict"),
    ("spotify_token", "spotify_token.json", "file"),
    # Multi-source imports (normalized copies of what you imported)
    ("spotify_history", "spotify_history.json", "file"),
    ("youtube_takeout", "youtube_takeout_normalized.json", "file"),
    ("lastfm_import", "lastfm_normalized.json", "file"),
    ("merged_history", "merged_listening_history.json", "file"),
    ("portable_dna", "portable_music_dna.json", "file"),
]

# Cleanup actions -> the on-disk relative paths they remove.
CLEAR_TARGETS = {
    "shortlist": ["shortlist.jsonl"],
    "listen_later": ["listen_later.jsonl"],
    "favorites": ["favorites.jsonl"],
    "rejects": ["rejects.jsonl"],
    "tag_cache": ["cache/lastfm_tags_cache.json"],
    "generated": ["local_recommendations.json", "local_taste_profile.json",
                  "local_recommendation_prompt.md", "local_candidate_pool.json",
                  "local_personal_memory.json", "recommendations_export.json",
                  "recommendations_export.md", "source_coverage.json",
                  "portable_music_dna.json", "portable_music_dna.md",
                  "portable_music_dna_prompt.md", "music_dna_card.html",
                  "local_enriched_history.json"],
    # Imported listening histories from every source (re-import to restore).
    "imports": ["local_input_history.json", "spotify_history.json",
                "youtube_takeout_normalized.json", "lastfm_normalized.json",
                "merged_listening_history.json"],
}

# Full reset removes all personal data files (NOT .env, code, examples, or
# spotify token — disconnecting Spotify is a separate, explicit action).
FULL_RESET_FILES = [
    "personal_presets.json", "favorites.jsonl", "listen_later.jsonl",
    "shortlist.jsonl", "rejects.jsonl", "feedback.jsonl", "music_dna_report.md",
    "cache/lastfm_tags_cache.json",
] + CLEAR_TARGETS["generated"] + CLEAR_TARGETS["imports"]

# Files included in a personal-data backup bundle.
BACKUP_FILES = [
    "personal_presets.json", "favorites.jsonl", "listen_later.jsonl",
    "shortlist.jsonl", "rejects.jsonl", "feedback.jsonl", "music_dna_report.md",
]


def _count_lines(path):
    n = 0
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            if line.strip():
                n += 1
    return n


def _item_count(path, kind):
    try:
        if kind == "jsonl":
            return _count_lines(path)
        if kind == "json_list":
            data = json.loads(path.read_text(encoding="utf-8"))
            return len(data) if isinstance(data, list) else (len(data) if isinstance(data, dict) else None)
        if kind == "json_dict":
            data = json.loads(path.read_text(encoding="utf-8"))
            return len(data) if isinstance(data, (list, dict)) else None
    except Exception:
        return None
    return None


def file_status(base):
    """Return a list of dicts describing each known data file."""
    base = Path(base)
    out = []
    for key, rel, kind in DATA_FILES:
        path = base / rel
        info = {"key": key, "path": rel, "exists": path.exists(),
                "count": None, "size": 0, "modified": None}
        if path.exists() and path.is_file():
            try:
                stat = path.stat()
                info["size"] = stat.st_size
                info["modified"] = datetime.fromtimestamp(
                    stat.st_mtime, tz=timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
            except OSError:
                pass
            if kind != "file":
                info["count"] = _item_count(path, kind)
        out.append(info)
    return out


def _safe_unlink(path):
    try:
        if path.exists():
            path.unlink()
            return True
    except OSError:
        return False
    return False


def clear(base, action):
    """Run a named cleanup action. Returns list of removed relative paths."""
    base = Path(base)
    targets = CLEAR_TARGETS.get(action)
    if targets is None:
        raise ValueError(f"unknown clear action: {action}")
    removed = []
    for rel in targets:
        if _safe_unlink(base / rel):
            removed.append(rel)
    return removed


def full_reset(base, confirm=False):
    """Remove all personal data files. Requires confirm=True (the UI asks first).

    Preserves .env, source code, examples, built-in presets, and the Spotify
    token (disconnecting Spotify is a separate explicit action)."""
    if not confirm:
        raise PermissionError("full_reset requires explicit confirmation")
    base = Path(base)
    removed = []
    for rel in FULL_RESET_FILES:
        if _safe_unlink(base / rel):
            removed.append(rel)
    return removed


def export_backup(base, dest=None):
    """Write a zip bundle of personal data. Returns the destination Path.

    If dest is None, writes to base/backups/mtr_backup_<timestamp>.zip.
    Only includes personal data — never .env, code, or examples."""
    base = Path(base)
    if dest is None:
        backups = base / "backups"
        backups.mkdir(parents=True, exist_ok=True)
        stamp = time.strftime("%Y%m%d_%H%M%S")
        dest = backups / f"mtr_backup_{stamp}.zip"
    dest = Path(dest)
    manifest = {"created": datetime.now(timezone.utc).isoformat(), "files": []}
    with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED) as zf:
        for rel in BACKUP_FILES:
            path = base / rel
            if path.exists() and path.is_file():
                zf.write(path, arcname=rel)
                manifest["files"].append(rel)
        zf.writestr("backup_manifest.json", json.dumps(manifest, indent=2))
    return dest


def export_backup_bytes(base):
    """Return (filename, bytes) of a personal-data backup zip held in memory."""
    base = Path(base)
    manifest = {"created": datetime.now(timezone.utc).isoformat(), "files": []}
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for rel in BACKUP_FILES:
            path = base / rel
            if path.exists() and path.is_file():
                zf.write(path, arcname=rel)
                manifest["files"].append(rel)
        zf.writestr("backup_manifest.json", json.dumps(manifest, indent=2))
    stamp = time.strftime("%Y%m%d_%H%M%S")
    return f"mtr_backup_{stamp}.zip", buf.getvalue()
