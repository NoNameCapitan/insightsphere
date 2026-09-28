#!/usr/bin/env python3
"""
import_lastfm.py
================
Last.fm importer with two honest modes (stdlib only):

Mode A — username + API key:
    Fetches PUBLIC recent tracks and top tracks via the official
    Last.fm API. Requires a free API key in .env (LASTFM_API_KEY) —
    get one at https://www.last.fm/api/account/create. No password,
    no OAuth, read-only public data.

Mode B — file export:
    Normalizes a Last.fm CSV/JSON export (e.g. from lastfm.ghan.nl /
    "scrobbles" exporters). Works fully offline.

Usage:
    python scripts/import_lastfm.py --username someuser
    python scripts/import_lastfm.py --file my_scrobbles.csv
    [--output outputs/lastfm_normalized.json] [--limit 200]
"""

import argparse
import csv
import io
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib import error, parse, request

SCRIPTS = Path(__file__).resolve().parent
ROOT = SCRIPTS.parents[0]
sys.path.insert(0, str(SCRIPTS))

from env_loader import load_env  # noqa: E402
from source_common import OUTPUTS, make_history, stamp_track  # noqa: E402

API_BASE = "https://ws.audioscrobbler.com/2.0/"


class LastfmError(RuntimeError):
    pass


# ---------------------------------------------------------------------------
# Mode A: public API by username
# ---------------------------------------------------------------------------

def _api_get(method, api_key, **params):
    query = {"method": method, "api_key": api_key, "format": "json", **params}
    url = API_BASE + "?" + parse.urlencode(query)
    try:
        with request.urlopen(url, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except error.HTTPError as exc:
        raise LastfmError(f"Last.fm API returned {exc.code}: {exc.read().decode('utf-8', 'replace')[:200]}") from exc
    except error.URLError as exc:
        raise LastfmError(f"Could not reach Last.fm: {exc.reason}") from exc
    if isinstance(data, dict) and data.get("error"):
        raise LastfmError(f"Last.fm API error {data['error']}: {data.get('message', '')}")
    return data


def fetch_by_username(username, api_key, limit=200):
    tracks = []

    recent = _api_get("user.getrecenttracks", api_key, user=username, limit=min(limit, 200))
    for item in (recent.get("recenttracks", {}) or {}).get("track", []) or []:
        if item.get("@attr", {}).get("nowplaying"):
            continue
        record = {
            "track_name": item.get("name", "Unknown track"),
            "artist_name": (item.get("artist") or {}).get("#text") or (item.get("artist") or {}).get("name") or "Unknown artist",
        }
        album = (item.get("album") or {}).get("#text")
        if album:
            record["album_name"] = album
        uts = (item.get("date") or {}).get("uts")
        if uts:
            record["played_at"] = datetime.fromtimestamp(int(uts), tz=timezone.utc).isoformat()
        tracks.append(stamp_track(record, "lastfm", confidence=0.95,
                                  raw_id=item.get("mbid") or None, source_type="api"))

    top = _api_get("user.gettoptracks", api_key, user=username, limit=min(limit, 100))
    for item in (top.get("toptracks", {}) or {}).get("track", []) or []:
        record = {
            "track_name": item.get("name", "Unknown track"),
            "artist_name": (item.get("artist") or {}).get("name", "Unknown artist"),
            "play_count": max(1, int(item.get("playcount", 1) or 1)),
        }
        tracks.append(stamp_track(record, "lastfm", confidence=0.95,
                                  raw_id=item.get("mbid") or None, source_type="api"))

    if not tracks:
        raise LastfmError(f"Last.fm returned no public tracks for user '{username}'.")
    return make_history("lastfm", tracks, extra={"user_id": username})


# ---------------------------------------------------------------------------
# Mode B: file export (CSV or JSON)
# ---------------------------------------------------------------------------

def parse_export_file(path):
    path = Path(path)
    text = path.read_text(encoding="utf-8", errors="replace")
    tracks = []

    if path.suffix.lower() == ".json":
        data = json.loads(text)
        rows = data if isinstance(data, list) else data.get("tracks") or data.get("scrobbles") or []
        for row in rows:
            if not isinstance(row, dict):
                continue
            title = row.get("track") or row.get("track_name") or row.get("name")
            artist = row.get("artist") or row.get("artist_name")
            if isinstance(artist, dict):
                artist = artist.get("#text") or artist.get("name")
            if not title:
                continue
            record = {"track_name": str(title), "artist_name": str(artist or "Unknown artist")}
            album = row.get("album") or row.get("album_name")
            if isinstance(album, dict):
                album = album.get("#text")
            if album:
                record["album_name"] = str(album)
            if row.get("uts") or row.get("timestamp"):
                try:
                    record["played_at"] = datetime.fromtimestamp(
                        int(row.get("uts") or row.get("timestamp")), tz=timezone.utc).isoformat()
                except (ValueError, TypeError, OSError):
                    pass
            elif row.get("utc_time") or row.get("date") or row.get("played_at"):
                record["played_at"] = str(row.get("utc_time") or row.get("date") or row.get("played_at"))
            if row.get("play_count") or row.get("playcount"):
                try:
                    record["play_count"] = max(1, int(row.get("play_count") or row.get("playcount")))
                except (ValueError, TypeError):
                    pass
            tracks.append(stamp_track(record, "lastfm", confidence=0.9,
                                      raw_id=row.get("track_mbid") or row.get("mbid") or None,
                                      source_type="file_export"))
    else:  # CSV
        reader = csv.DictReader(io.StringIO(text))
        cols = {c.lower().strip(): c for c in (reader.fieldnames or [])}

        def col(*names):
            for n in names:
                if n in cols:
                    return cols[n]
            return None

        c_track, c_artist = col("track", "track_name", "song", "name"), col("artist", "artist_name")
        c_album, c_uts, c_time = col("album", "album_name"), col("uts"), col("utc_time", "date", "played_at")
        if not c_track or not c_artist:
            raise LastfmError("CSV must contain 'track' and 'artist' columns (Last.fm export format).")
        for row in reader:
            title = (row.get(c_track) or "").strip()
            if not title:
                continue
            record = {"track_name": title, "artist_name": (row.get(c_artist) or "Unknown artist").strip()}
            if c_album and row.get(c_album):
                record["album_name"] = row[c_album].strip()
            if c_uts and row.get(c_uts):
                try:
                    record["played_at"] = datetime.fromtimestamp(int(row[c_uts]), tz=timezone.utc).isoformat()
                except (ValueError, OSError):
                    pass
            elif c_time and row.get(c_time):
                record["played_at"] = row[c_time].strip()
            tracks.append(stamp_track(record, "lastfm", confidence=0.9, source_type="file_export"))

    if not tracks:
        raise LastfmError("No tracks found in the export file.")
    return make_history("lastfm", tracks)


def import_lastfm(username=None, file=None, limit=200):
    if file:
        return parse_export_file(file)
    if username:
        api_key = load_env().get("LASTFM_API_KEY", "").strip()
        if not api_key or api_key == "your_lastfm_api_key_here":
            raise LastfmError(
                "LASTFM_API_KEY is not configured. Get a free key at "
                "https://www.last.fm/api/account/create and add it to .env — "
                "or upload a Last.fm export file instead (works without any key).")
        return fetch_by_username(username, api_key, limit)
    raise LastfmError("Provide --username (needs LASTFM_API_KEY in .env) or --file <export>.")


def main():
    parser = argparse.ArgumentParser(description="Import Last.fm listening data (username via public API, or file export).")
    parser.add_argument("--username", help="Public Last.fm username (Mode A, needs LASTFM_API_KEY in .env)")
    parser.add_argument("--file", help="Last.fm CSV/JSON export file (Mode B, fully offline)")
    parser.add_argument("--limit", type=int, default=200)
    parser.add_argument("--output", default=str(OUTPUTS / "lastfm_normalized.json"))
    args = parser.parse_args()
    try:
        history = import_lastfm(args.username, args.file, args.limit)
    except (LastfmError, FileNotFoundError, json.JSONDecodeError) as exc:
        print(f"Error: {exc}")
        sys.exit(1)
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(history, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Imported {len(history['tracks'])} Last.fm tracks -> {out}")


if __name__ == "__main__":
    main()
