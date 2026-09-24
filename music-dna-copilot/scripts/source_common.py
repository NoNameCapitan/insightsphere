#!/usr/bin/env python3
"""
source_common.py
================
Shared foundation for all music-source importers/connectors (stdlib only).

Every importer normalizes into the existing listening-history schema
(`schemas/listening_history.schema.json`) and stamps per-track source
metadata so merging and coverage stay transparent:

    source        e.g. "spotify", "youtube_takeout", "lastfm", "manual"
    source_type   "oauth" | "takeout_export" | "api" | "file_export" | "manual" | "demo"
    imported_at   ISO 8601
    confidence    0..1 (how sure we are this row is real music, correctly parsed)
    raw_id        original id from the source, when available

Also provides:
    - normalize_key(): the transparent dedup key used by the merger;
    - compute_coverage(): per-source contribution + profile confidence
      (High / Medium / Low) used by the UI, merger, and portable export.
"""

import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUTS = ROOT / "outputs"

SOURCE_TYPES = {
    "demo": "demo",
    "sample": "demo",
    "manual": "manual",
    "csv": "file_export",
    "json": "file_export",
    "spotify": "oauth",
    "lastfm": "api_or_file",
    "youtube_takeout": "takeout_export",
    "apple_music": "file_export", "deezer": "file_export", "tidal": "file_export",
    "soundcloud": "file_export", "bandcamp": "file_export", "yandex_music": "file_export",
    "amazon_music": "file_export", "qobuz": "file_export", "pandora": "file_export",
    "generic": "file_export",
    "merged": "merged",
}

# Known normalized files that the merger picks up automatically.
KNOWN_NORMALIZED_FILES = {
    "spotify": "spotify_history.json",
    "youtube_takeout": "youtube_takeout_normalized.json",
    "lastfm": "lastfm_normalized.json",
    "file_import": "local_input_history.json",
    "multi_service": "multi_service_normalized.json",
}


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def stamp_track(track, source, confidence=1.0, raw_id=None, source_type=None):
    """Attach source metadata to a normalized track (in place, returns it)."""
    track["source"] = source
    track["source_type"] = source_type or SOURCE_TYPES.get(source, "file_export")
    track["imported_at"] = track.get("imported_at") or now_iso()
    track["confidence"] = round(float(confidence), 2)
    if raw_id:
        track["raw_id"] = str(raw_id)
    return track


def make_history(source, tracks, extra=None):
    history = {
        "source": source,
        "exported_at": now_iso(),
        "tracks": tracks,
    }
    if extra:
        history.update(extra)
    return history


# ---------------------------------------------------------------------------
# Transparent dedup key
# ---------------------------------------------------------------------------

_PAREN = re.compile(r"\s*[\(\[][^)\]]*[\)\]]")
_FEAT = re.compile(r"\s+(feat|ft|featuring|with)\.?\s+.*$", re.IGNORECASE)
_SUFFIX = re.compile(
    r"\s*-\s*(official\s*(music\s*)?(video|audio)|lyrics?(\s*video)?|remaster(ed)?(\s*\d{4})?|"
    r"radio\s*edit|hd|hq|mv|m/v|visualizer|audio|live)\s*$", re.IGNORECASE)
_PUNCT = re.compile(r"[^\w\s]", re.UNICODE)
_SPACES = re.compile(r"\s+")


def clean_title(text):
    """Human-readable cleanup: strip (Official Video)-style noise."""
    text = _PAREN.sub("", str(text))
    text = _SUFFIX.sub("", text)
    text = _FEAT.sub("", text)
    return _SPACES.sub(" ", text).strip()


def normalize_key(title, artist):
    """Dedup key: lowercase, no punctuation, no decorations, NFKD-folded."""
    def fold(value):
        value = clean_title(value).lower()
        value = unicodedata.normalize("NFKD", value)
        value = _PUNCT.sub("", value)
        return _SPACES.sub(" ", value).strip()
    return fold(title), fold(artist)


# ---------------------------------------------------------------------------
# Coverage + profile confidence
# ---------------------------------------------------------------------------

SOURCE_LABELS = {
    "spotify": "Spotify", "youtube_takeout": "YouTube Takeout", "lastfm": "Last.fm",
    "csv": "CSV upload", "json": "JSON upload", "manual": "Manual input",
    "demo": "Demo library", "sample": "Demo library", "merged": "Merged",
    "apple_music": "Apple Music", "deezer": "Deezer", "tidal": "TIDAL",
    "soundcloud": "SoundCloud", "bandcamp": "Bandcamp", "yandex_music": "Yandex Music",
    "amazon_music": "Amazon Music", "qobuz": "Qobuz", "pandora": "Pandora", "generic": "Other export",
}


def _track_sources(track, fallback):
    if track.get("sources"):
        return [s.get("source", fallback) if isinstance(s, dict) else str(s) for s in track["sources"]]
    return [track.get("source", fallback)]


def compute_coverage(history):
    """
    Source coverage + transparent profile confidence for any normalized
    history (single-source or merged). Confidence logic, all visible in
    the output:

        + number of distinct sources       (more sources -> better)
        + number of listening events       (play counts / rows)
        + share of rows with timestamps    (more played_at -> better)
        + repeated artists/tracks          (repetition -> stronger signal)
        - low average parse confidence     (uncertain YouTube rows lower it)
    """
    tracks = history.get("tracks", [])
    fallback = history.get("source", "unknown")
    per_source = {}
    events = 0
    timestamped = 0
    artist_counts = {}
    confidences = []

    for track in tracks:
        weight_sources = _track_sources(track, fallback)
        for s in weight_sources:
            per_source[s] = per_source.get(s, 0) + 1 / len(weight_sources)
        events += int(track.get("play_count", 1) or 1)
        if track.get("played_at"):
            timestamped += 1
        artist = str(track.get("artist_name", "")).lower()
        if artist:
            artist_counts[artist] = artist_counts.get(artist, 0) + 1
        confidences.append(float(track.get("confidence", 1.0)))

    total = len(tracks)
    unique_artists = len(artist_counts)
    unique_genres = len({str(g).lower() for t in tracks for g in t.get("genres", []) or []})
    repeated_artists = sum(1 for c in artist_counts.values() if c >= 2)
    avg_confidence = round(sum(confidences) / len(confidences), 3) if confidences else 0.0
    ts_share = round(timestamped / total, 3) if total else 0.0

    # Transparent 0-100 score -> High / Medium / Low
    score = 0
    score += min(len(per_source), 4) * 12                       # up to 48
    score += min(events / 50.0, 1.0) * 20                       # up to 20
    score += ts_share * 12                                      # up to 12
    score += min(repeated_artists / max(unique_artists, 1), 1.0) * 10  # up to 10
    score += avg_confidence * 10                                # up to 10
    level = "High" if score >= 65 else "Medium" if score >= 40 else "Low"

    contributions = {
        s: round(100 * n / total, 1) if total else 0.0
        for s, n in sorted(per_source.items(), key=lambda kv: -kv[1])
    }
    reasons = []
    if len(per_source) == 1:
        reasons.append("single source")
    if events < 30:
        reasons.append("few listening events")
    if ts_share < 0.3:
        reasons.append("few timestamps")
    if avg_confidence < 0.75:
        reasons.append("uncertain parsing (e.g. YouTube titles)")

    return {
        "generated_at": now_iso(),
        "sources_used": list(contributions.keys()),
        "source_labels": {s: SOURCE_LABELS.get(s, s) for s in contributions},
        "contribution_percent": contributions,
        "total_tracks": total,
        "total_listening_events": events,
        "unique_artists": unique_artists,
        "unique_genres": unique_genres,
        "timestamped_share": ts_share,
        "average_parse_confidence": avg_confidence,
        "confidence_score": int(round(score)),
        "confidence_level": level,
        "confidence_reasons": reasons,
    }


def write_coverage(history, path=None):
    coverage = compute_coverage(history)
    path = Path(path) if path else (OUTPUTS / "source_coverage.json")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(coverage, indent=2, ensure_ascii=False), encoding="utf-8")
    return coverage
