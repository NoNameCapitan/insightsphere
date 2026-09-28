#!/usr/bin/env python3
"""
import_youtube_takeout.py
=========================
Local importer for YouTube / YouTube Music data from Google Takeout.

What this is NOT:
    - No YouTube Music login, no cookies, no unofficial APIs.
    - Nothing is uploaded anywhere. The Takeout file you exported from
      Google stays on your disk and is parsed locally.

Supported inputs (file or a Takeout folder — auto-detected):
    - watch-history.json        (YouTube and YouTube Music watch history)
    - watch-history.html        (same data in HTML form)
    - music-library-songs.csv   (YouTube Music library export)
    - playlists/*.csv           (YouTube Music playlist exports)
    - any JSON/CSV in the same Takeout shape

Honesty about parsing:
    Takeout mixes music with regular videos, and video titles are messy.
    Each imported row carries a `confidence` value:

        0.90  YouTube Music entries (header "YouTube Music")
        0.85  music-library / playlist CSV rows
        0.80  YouTube entries from an official artist "<Name> - Topic" channel
        0.60  YouTube entries whose title looks like "Artist - Track"
        0.55  YouTube entries with music keywords (official video/audio, lyrics, MV)

    Everything else is treated as a regular video and skipped — the
    summary reports how many entries were skipped, so nothing is hidden.

Usage:
    python scripts/import_youtube_takeout.py <file-or-folder> \
        [--output outputs/youtube_takeout_normalized.json] [--include-uncertain]
"""

import argparse
import csv
import io
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
ROOT = SCRIPTS.parents[0]
sys.path.insert(0, str(SCRIPTS))

from source_common import OUTPUTS, clean_title, make_history, stamp_track  # noqa: E402

MUSIC_KEYWORDS = re.compile(
    r"official\s*(music\s*)?(video|audio)|lyric|\bmv\b|m/v|visualizer|\bremix\b|\bcover\b|\bfeat\.?\b|\blive\b",
    re.IGNORECASE)
ARTIST_TRACK = re.compile(r"^(?P<artist>[^-–—]{2,60})\s*[-–—]\s*(?P<track>.{2,80})$")
VIDEO_ID = re.compile(r"[?&]v=([\w-]{6,})")


def _entry_from_title(raw_title, channel, time_str, url, header):
    """Turn one watch-history row into (track, confidence) or (None, reason)."""
    title = str(raw_title or "")
    if title.lower().startswith("watched "):
        title = title[8:]
    if not title or title.lower().startswith(("visited ", "searched ")):
        return None, "not_a_watch"

    channel = str(channel or "").strip()
    is_topic = channel.endswith(" - Topic")
    artist_from_channel = channel[:-8].strip() if is_topic else channel

    if header == "YouTube Music":
        confidence = 0.90
    elif is_topic:
        confidence = 0.80
    else:
        match = ARTIST_TRACK.match(clean_title(title))
        channel_is_artist = bool(
            match and channel
            and match.group("artist").strip().lower() == channel.lower())
        if channel_is_artist:
            # e.g. channel "The Weeknd", title "The Weeknd - Blinding Lights"
            confidence = 0.60
        elif MUSIC_KEYWORDS.search(title):
            confidence = 0.55
        else:
            # A bare "X - Y" title with an unrelated channel is most likely a
            # regular video ("How to fix a tap - DIY tutorial"), so skip it.
            return None, "looks_like_regular_video"

    # Best-effort artist/track split
    match = ARTIST_TRACK.match(clean_title(title))
    if match and not is_topic and header != "YouTube Music":
        artist, track = match.group("artist").strip(), match.group("track").strip()
    elif match and (is_topic or header == "YouTube Music"):
        # Prefer the channel as artist when it is an official one
        artist = artist_from_channel or match.group("artist").strip()
        track = match.group("track").strip() if not artist_from_channel else clean_title(title)
        if artist and match.group("artist").strip().lower() == artist.lower():
            track = match.group("track").strip()
    else:
        artist = artist_from_channel or "Unknown artist"
        track = clean_title(title)

    raw_id = None
    m = VIDEO_ID.search(url or "")
    if m:
        raw_id = m.group(1)

    record = {"track_name": track or "Unknown track", "artist_name": artist or "Unknown artist"}
    if time_str:
        record["played_at"] = time_str
    return stamp_track(record, "youtube_takeout", confidence=confidence, raw_id=raw_id), None


# ---------------------------------------------------------------------------
# Parsers per file kind
# ---------------------------------------------------------------------------

def parse_watch_history_json(data):
    tracks, skipped = [], 0
    for row in data if isinstance(data, list) else []:
        if not isinstance(row, dict):
            skipped += 1
            continue
        subtitles = row.get("subtitles") or []
        channel = subtitles[0].get("name") if subtitles and isinstance(subtitles[0], dict) else ""
        track, _reason = _entry_from_title(row.get("title"), channel, row.get("time"),
                                           row.get("titleUrl"), row.get("header", "YouTube"))
        if track:
            tracks.append(track)
        else:
            skipped += 1
    return tracks, skipped


class _WatchHistoryHTML(HTMLParser):
    """Minimal parser for Takeout's watch-history.html outer-cell structure."""

    def __init__(self):
        super().__init__()
        self.entries = []
        self._in_content = False
        self._links = []
        self._texts = []
        self._depth = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "div" and "content-cell" in attrs.get("class", "") and "mdl-typography--body-1" in attrs.get("class", ""):
            self._in_content = True
            self._links, self._texts, self._depth = [], [], 1
        elif self._in_content:
            if tag == "div":
                self._depth += 1
            if tag == "a":
                self._links.append(attrs.get("href", ""))

    def handle_endtag(self, tag):
        if self._in_content and tag == "div":
            self._depth -= 1
            if self._depth <= 0:
                self._in_content = False
                self.entries.append((list(self._links), list(self._texts)))

    def handle_data(self, data):
        if self._in_content:
            text = data.strip()
            if text:
                self._texts.append(text)


def parse_watch_history_html(text):
    parser = _WatchHistoryHTML()
    parser.feed(text)
    tracks, skipped = [], 0
    for links, texts in parser.entries:
        if not texts:
            skipped += 1
            continue
        title = texts[0]
        if title.lower().startswith("watched "):
            title = title[8:]
        elif texts[0].lower() == "watched" and len(texts) > 1:
            title = texts[1]
        channel = ""
        time_str = ""
        for chunk in texts[1:]:
            if re.search(r"\d{1,2}:\d{2}", chunk) and re.search(r"\d{4}", chunk):
                time_str = chunk
            elif chunk != title and not channel and "http" not in chunk:
                channel = chunk
        url = links[0] if links else ""
        track, _ = _entry_from_title(title, channel, time_str or None, url, "YouTube")
        if track:
            tracks.append(track)
        else:
            skipped += 1
    return tracks, skipped


def parse_music_csv(text):
    """music-library-songs.csv / playlist CSVs: columns vary, match loosely."""
    tracks, skipped = [], 0
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        return tracks, skipped
    cols = {c.lower().strip(): c for c in reader.fieldnames}

    def col(*names):
        for n in names:
            if n in cols:
                return cols[n]
        return None

    c_title = col("song title", "title", "track name", "song")
    c_artist = col("artist names", "artist name", "artist", "artists")
    c_album = col("album title", "album")
    if not c_title:
        return tracks, -1  # not a music CSV
    for row in reader:
        title = (row.get(c_title) or "").strip()
        if not title:
            skipped += 1
            continue
        record = {
            "track_name": clean_title(title),
            "artist_name": (row.get(c_artist) or "Unknown artist").strip() if c_artist else "Unknown artist",
        }
        if c_album and row.get(c_album):
            record["album_name"] = row[c_album].strip()
        tracks.append(stamp_track(record, "youtube_takeout", confidence=0.85))
    return tracks, skipped


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def collect_files(path):
    path = Path(path)
    if path.is_file():
        return [path]
    if path.is_dir():
        found = []
        for pattern in ("**/watch-history.json", "**/watch-history.html",
                        "**/music-library-songs.csv", "**/playlists/*.csv",
                        "**/*.json", "**/*.csv"):
            found.extend(path.glob(pattern))
        # de-dup, keep order, cap to something sane
        seen, files = set(), []
        for f in found:
            if f not in seen:
                seen.add(f)
                files.append(f)
        return files[:50]
    return []


def import_takeout(path, min_confidence=0.55):
    files = collect_files(path)
    if not files:
        raise FileNotFoundError(f"No importable files found at: {path}")

    all_tracks, total_skipped, parsed_files = [], 0, []
    for file in files:
        try:
            text = file.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        tracks, skipped = [], 0
        if file.suffix.lower() == ".json":
            try:
                data = json.loads(text)
            except json.JSONDecodeError:
                continue
            tracks, skipped = parse_watch_history_json(data)
        elif file.suffix.lower() in {".html", ".htm"}:
            tracks, skipped = parse_watch_history_html(text)
        elif file.suffix.lower() == ".csv":
            tracks, skipped = parse_music_csv(text)
            if skipped == -1:
                continue
        if tracks:
            parsed_files.append(file.name)
            all_tracks.extend(t for t in tracks if t["confidence"] >= min_confidence)
            total_skipped += skipped

    if not all_tracks:
        raise ValueError(
            "No music-related entries found. Takeout watch history mixes music with "
            "regular videos; entries without music signals are skipped on purpose.")

    # Collapse exact repeats into play_count
    merged = {}
    for track in all_tracks:
        key = (track["track_name"].lower(), track["artist_name"].lower())
        if key in merged:
            merged[key]["play_count"] = merged[key].get("play_count", 1) + 1
            if track.get("played_at") and not merged[key].get("played_at"):
                merged[key]["played_at"] = track["played_at"]
        else:
            track.setdefault("play_count", 1)
            merged[key] = track

    tracks = list(merged.values())
    uncertain = sum(1 for t in tracks if t["confidence"] < 0.8)
    history = make_history("youtube_takeout", tracks, extra={
        "import_summary": {
            "files_parsed": parsed_files,
            "music_entries": len(tracks),
            "skipped_non_music": total_skipped,
            "uncertain_entries": uncertain,
            "note": ("Title-based parsing of plain YouTube entries is heuristic; "
                     "uncertain rows carry confidence 0.55-0.60 and weigh less in the profile."),
        },
    })
    return history


def main():
    parser = argparse.ArgumentParser(description="Import YouTube / YouTube Music history from a local Google Takeout export.")
    parser.add_argument("path", help="Takeout file (json/html/csv) or extracted Takeout folder")
    parser.add_argument("--output", default=str(OUTPUTS / "youtube_takeout_normalized.json"))
    parser.add_argument("--include-uncertain", action="store_true",
                        help="Keep low-confidence rows (<0.55) too")
    args = parser.parse_args()
    try:
        history = import_takeout(args.path, min_confidence=0.0 if args.include_uncertain else 0.55)
    except (FileNotFoundError, ValueError) as exc:
        print(f"Error: {exc}")
        sys.exit(1)
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(history, indent=2, ensure_ascii=False), encoding="utf-8")
    summary = history["import_summary"]
    print(f"Imported {summary['music_entries']} music entries "
          f"({summary['uncertain_entries']} uncertain, {summary['skipped_non_music']} non-music skipped) -> {out}")


if __name__ == "__main__":
    main()
