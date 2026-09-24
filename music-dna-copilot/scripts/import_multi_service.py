#!/usr/bin/env python3
"""Import listening/library exports from multiple music services into Music DNA.

Supported service presets: Apple Music, Deezer, TIDAL, SoundCloud, Bandcamp,
Yandex Music, Amazon Music, Qobuz, Pandora, generic CSV/JSON.
This module deliberately uses user-provided exports only; it never claims live
account access where an official connector is not configured.
"""
import csv, io, json
from pathlib import Path
from source_common import make_history, stamp_track

SERVICES = {
    "apple_music": "Apple Music", "deezer": "Deezer", "tidal": "TIDAL",
    "soundcloud": "SoundCloud", "bandcamp": "Bandcamp", "yandex_music": "Yandex Music",
    "amazon_music": "Amazon Music", "qobuz": "Qobuz", "pandora": "Pandora",
    "generic": "Other / generic export",
}
TITLE_KEYS = ("track_name","track","title","song","name","song name","track name")
ARTIST_KEYS = ("artist_name","artist","artist name","creator","author","channel")
ALBUM_KEYS = ("album_name","album","album name","release")
TIME_KEYS = ("played_at","played at","timestamp","time","date","played","endtime")
COUNT_KEYS = ("play_count","plays","play count","count")
ID_KEYS = ("id","track_id","track id","song_id","song id","uri")
ISRC_KEYS = ("isrc","isrc code","isrc_code")
GENRE_KEYS = ("genres","genre","tags")

def _norm(d): return {str(k).strip().lower(): v for k,v in d.items()}
def _pick(d, keys):
    for k in keys:
        if k in d and d[k] not in (None, ""): return d[k]
    return None

def _rows_from_json(obj):
    if isinstance(obj, list): return obj
    if isinstance(obj, dict):
        for key in ("tracks","songs","items","history","listening_history","data"):
            if isinstance(obj.get(key), list): return obj[key]
        return [obj]
    return []

def _to_track(row, service):
    if not isinstance(row, dict): return None
    d = _norm(row); title = _pick(d, TITLE_KEYS); artist = _pick(d, ARTIST_KEYS)
    if not title: return None
    # Some exports omit artist; retain the event rather than silently dropping it.
    artist = artist or "Unknown artist"
    t = {"track_name": str(title).strip(), "artist_name": str(artist).strip()}
    album = _pick(d, ALBUM_KEYS); played = _pick(d, TIME_KEYS); count = _pick(d, COUNT_KEYS)
    genres = _pick(d, GENRE_KEYS); raw_id = _pick(d, ID_KEYS); isrc = _pick(d, ISRC_KEYS)
    if album: t["album_name"] = str(album).strip()
    if played: t["played_at"] = str(played).strip()
    if count:
        try: t["play_count"] = max(1, int(float(count)))
        except (TypeError, ValueError): pass
    if isrc: t["isrc"] = str(isrc).strip().upper()
    if genres:
        if isinstance(genres, list): t["genres"] = [str(x).strip() for x in genres if str(x).strip()]
        else: t["genres"] = [x.strip() for x in str(genres).replace(";",",").split(",") if x.strip()]
    return stamp_track(t, service, confidence=0.88 if artist != "Unknown artist" else 0.65,
                       raw_id=raw_id, source_type="file_export")

def import_service_export(path, service="generic"):
    service = service if service in SERVICES else "generic"
    p = Path(path); raw = p.read_bytes(); rows = []
    if p.suffix.lower() == ".json":
        rows = _rows_from_json(json.loads(raw.decode("utf-8-sig", errors="replace")))
    else:
        text = raw.decode("utf-8-sig", errors="replace")
        sample = text[:4096]
        try: dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
        except csv.Error: dialect = csv.excel
        rows = list(csv.DictReader(io.StringIO(text), dialect=dialect))
    tracks = [t for t in (_to_track(r, service) for r in rows) if t]
    if not tracks: raise ValueError("No recognizable music rows found. Expected track/title and preferably artist columns.")
    return make_history(service, tracks, extra={"service_label": SERVICES[service], "import_file": p.name})
