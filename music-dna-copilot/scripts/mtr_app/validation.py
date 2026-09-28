"""
mtr_app.validation
==================
User-input validation and normalization for uploaded/pasted listening
histories. Raises UserInputError with translated, user-facing messages.
"""

import json
import re
from datetime import datetime, timezone

from mtr_app.i18n import t
from mtr_app.io_http import MAX_TRACKS

# Leading list markers to strip from pasted lines: "1.", "1)", "-", "*", "•".
_re_manual_marker = re.compile(r"^\s*(?:\d+[.)]|[-*•])\s+")

class UserInputError(ValueError):
    """Error with a translated, user-facing message."""

def read_field(fields, name, default=""):
    field = fields.get(name)
    if field is None:
        return default
    value = getattr(field, "value", default)
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value

def read_upload(fields, name):
    field = fields.get(name)
    if field is None:
        return None, b""
    return getattr(field, "filename", None), getattr(field, "data", b"")

def validate_history(data, lang, source="json"):
    """Lightweight, defensive validation/sanitization for uploaded histories.

    - confirms the object shape (dict with a non-empty 'tracks' list);
    - enforces MAX_TRACKS;
    - keeps only rows with a usable track_name + artist_name (strings),
      coercing play_count to an int >= 1 and dropping non-string genres.

    Raises UserInputError (translated) on unrecoverable problems.
    """
    if not isinstance(data, dict) or not isinstance(data.get("tracks"), list):
        raise UserInputError(t(lang, "err_json_shape"))
    tracks = data["tracks"]
    if len(tracks) > MAX_TRACKS:
        raise UserInputError(t(lang, "err_too_many_tracks", n=len(tracks), limit=MAX_TRACKS))

    clean = []
    for row in tracks:
        if not isinstance(row, dict):
            continue
        name = row.get("track_name")
        artist = row.get("artist_name")
        if not isinstance(name, str) or not name.strip():
            continue
        if not isinstance(artist, str) or not artist.strip():
            continue
        row["track_name"] = name.strip()
        row["artist_name"] = artist.strip()
        genres = row.get("genres")
        if isinstance(genres, list):
            row["genres"] = [str(g).strip().lower() for g in genres if str(g).strip()]
        elif genres is not None:
            row.pop("genres", None)
        if "play_count" in row:
            try:
                pc = int(row["play_count"])
                row["play_count"] = pc if pc >= 1 else 1
            except (TypeError, ValueError):
                row.pop("play_count", None)
        clean.append(row)

    if not clean:
        raise UserInputError(t(lang, "err_track_shape"))
    data["tracks"] = clean
    return data

def ensure_history_object(data, lang, source="json"):
    if isinstance(data, list):
        data = {"source": source, "exported_at": datetime.now(timezone.utc).isoformat(), "tracks": data}
    if isinstance(data, dict) and isinstance(data.get("tracks"), list):
        data.setdefault("source", source)
        data.setdefault("exported_at", datetime.now(timezone.utc).isoformat())
        if not data["tracks"]:
            raise UserInputError(t(lang, "err_no_tracks"))
        return validate_history(data, lang, source)
    raise UserInputError(t(lang, "err_json_shape"))

def parse_json_or_fail(text, lang):
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise UserInputError(t(lang, "err_bad_json", detail=exc)) from exc

def build_manual_history(text, genres_text, lang):
    genres = [g.strip().lower() for g in genres_text.replace(";", ",").split(",") if g.strip()]
    tracks = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        # strip a leading list marker like "1.", "1)", "-", "*", "•"
        line = _re_manual_marker.sub("", line).strip()
        if not line:
            continue
        low = line.lower()
        if " by " in low:
            # unambiguous "Track by Artist"
            idx = low.index(" by ")
            title, artist = line[:idx].strip(), line[idx + 4:].strip()
        elif "—" in line:
            title, artist = [p.strip() for p in line.split("—", 1)]
        elif "–" in line:  # en-dash
            title, artist = [p.strip() for p in line.split("–", 1)]
        elif " - " in line:
            title, artist = [p.strip() for p in line.split(" - ", 1)]
        elif "\t" in line:
            title, artist = [p.strip() for p in line.split("\t", 1)]
        else:
            title, artist = line, "Unknown artist"
        title = title.strip("\"' ")
        artist = artist.strip("\"' ")
        if title:
            tracks.append({
                "track_name": title,
                "artist_name": artist or "Unknown artist",
                "genres": genres,
                "play_count": 1,
            })
    if not tracks:
        raise UserInputError(t(lang, "err_manual_empty"))
    return {"source": "manual", "exported_at": datetime.now(timezone.utc).isoformat(), "tracks": tracks}
