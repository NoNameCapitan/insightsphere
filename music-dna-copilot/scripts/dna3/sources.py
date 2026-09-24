"""Sources: provider cards, imports, live sync and history loading.

Status honesty rules
--------------------
* A provider is `connected` only when a live session/credentials prove it
  (Spotify: an OAuth session; Last.fm: API key + username configured).
* `imported` means a normalized export from that service is on disk.
* Capability badges come from what the code can actually do today:
  LIVE_CONNECTION, IMPORT, REQUIRES_SETUP or COMING_SOON. There is no fake
  OAuth anywhere.
"""
from __future__ import annotations

import hashlib
import json
import tempfile
from pathlib import Path

from .errors import ProductError
from .store import Store, now_iso, parse_dt

ROOT = Path(__file__).resolve().parents[2]
EXAMPLES = ROOT / "examples"
DEMO_HISTORY = EXAMPLES / "demo_owner_taste.json"

# 2.x file names are kept so the classic workspace sees the same data.
LEGACY_FILES = {
    "spotify": "spotify_history.json",
    "lastfm": "lastfm_normalized.json",
    "youtube_music": "youtube_takeout_normalized.json",
}

# id, label, import parser, short description of what to upload
PROVIDERS = [
    ("spotify", "Spotify", "spotify_export", "Live read-only connection, or your Extended Streaming History (.json) from Spotify's privacy page."),
    ("apple_music", "Apple Music", "multi", "Apple privacy export: the Play Activity CSV (track + artist columns)."),
    ("lastfm", "Last.fm", "lastfm", "Live scrobble sync with your username + free API key, or an export file."),
    ("youtube_music", "YouTube Music", "takeout", "Google Takeout watch-history (.json/.html) or YouTube Music library CSV."),
    ("deezer", "Deezer", "multi", "CSV/JSON export with track and artist columns."),
    ("tidal", "TIDAL", "multi", "CSV/JSON export with track and artist columns."),
    ("soundcloud", "SoundCloud", "multi", "CSV/JSON export with track and artist columns."),
    ("amazon_music", "Amazon Music", "multi", "CSV/JSON export with track and artist columns."),
    ("qobuz", "Qobuz", "multi", "CSV/JSON export with track and artist columns."),
    ("bandcamp", "Bandcamp", "multi", "Collection export (CSV/JSON) with track and artist columns."),
    ("yandex_music", "Yandex Music", "multi", "CSV/JSON export with track and artist columns."),
    ("pandora", "Pandora", "multi", "CSV/JSON export with track and artist columns."),
    ("generic_csv", "Generic CSV", "multi", "Any CSV with track/title and artist columns (play counts, dates, genres optional)."),
    ("generic_json", "Generic JSON", "multi", "Any JSON list of tracks with title and artist fields."),
    ("local_files", "Local music folder", None, "Scanning a folder of audio files is planned, not implemented."),
]
PROVIDER_IDS = [p[0] for p in PROVIDERS]
LABELS = {p[0]: p[1] for p in PROVIDERS}
LABELS.update({"youtube_takeout": "YouTube Music", "demo": "Demo library", "sample": "Demo library",
               "csv": "CSV upload", "json": "JSON upload", "manual": "Manual input", "generic": "Generic export"})
MULTI_SERVICE_ID = {"generic_csv": "generic", "generic_json": "generic"}
IMPORT_EXTENSIONS = {".json", ".csv", ".html", ".htm", ".tsv", ".txt"}


def label(source_id):
    return LABELS.get(source_id, str(source_id).replace("_", " ").title())


def canonical_source(source_id):
    """Map the many 2.x source ids onto 3.0 provider ids."""
    return {"youtube_takeout": "youtube_music", "generic": "generic_csv", "sample": "demo",
            "spotify_export": "spotify"}.get(source_id, source_id)


# ---------------------------------------------------------------------------
# Optional engine modules (the product degrades honestly when one is missing)
# ---------------------------------------------------------------------------

def _mod(name):
    try:
        return __import__(name)
    except Exception:  # pragma: no cover - optional
        return None


def spotify_state():
    """(configured, connected, display_name, last_error)."""
    try:
        from mtr_app.spotify_state import SPOTIFY
    except Exception:  # pragma: no cover
        return False, False, None, None
    try:
        configured = SPOTIFY.configured()
        connected = SPOTIFY.connected()
    except Exception:
        return False, False, None, None
    who = getattr(SPOTIFY.session, "display_name", None) if connected else None
    return configured, connected, who, SPOTIFY.last_error or None


def lastfm_state():
    """(api_key_present, username)."""
    try:
        from mtr_app import local_config
        local_config.apply_to_env()
    except Exception:
        pass
    lf = _mod("lastfm_client")
    if lf is None:
        return False, None
    try:
        status = lf.LastfmClient().config_status()
    except Exception:
        return False, None
    return bool(status.get("api_key_present")), status.get("username") or None


# ---------------------------------------------------------------------------
# Discovering normalized histories on disk
# ---------------------------------------------------------------------------

def source_files(store: Store):
    """{provider_id: Path} for every normalized history the user imported."""
    found = {}
    for pid, name in LEGACY_FILES.items():
        p = store.path(name)
        if p.exists():
            found[pid] = p
    if store.imports_dir.is_dir():
        for p in sorted(store.imports_dir.glob("*.json")):
            found[p.stem] = p
    # 2.x classic-UI artefacts: count them only when they are genuine imports.
    legacy_multi = store.path("multi_service_normalized.json")
    if legacy_multi.exists():
        try:
            svc = json.loads(legacy_multi.read_text(encoding="utf-8")).get("source") or "generic"
        except (OSError, ValueError):
            svc = None
        if svc and canonical_source(svc) not in found:
            found[canonical_source(svc)] = legacy_multi
    local_input = store.path("local_input_history.json")
    if local_input.exists():
        try:
            src = json.loads(local_input.read_text(encoding="utf-8")).get("source")
        except (OSError, ValueError):
            src = None
        if src in {"csv", "json", "manual"} and "classic_" + src not in found:
            found["classic_" + src] = local_input
    return found


def load_histories(store: Store, *, demo=False):
    """Return [(provider_id, history_dict)]. Demo data never mixes with real data."""
    if demo:
        data = json.loads(DEMO_HISTORY.read_text(encoding="utf-8"))
        data["source"] = "demo"
        for t in data.get("tracks", []):
            t.setdefault("source", "demo")
            t.setdefault("source_type", "demo")
        return [("demo", data)]
    out = []
    for pid, path in source_files(store).items():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            store.log_diagnostic("corrupted_data", f"Could not read {path.name}; skipped it for this build.")
            continue
        if isinstance(data, dict) and isinstance(data.get("tracks"), list) and data["tracks"]:
            out.append((pid, data))
    return out


def _history_stats(history):
    tracks = history.get("tracks", [])
    events = sum(max(1, int(t.get("play_count", 1) or 1)) for t in tracks)
    times = [parse_dt(t.get("played_at")) for t in tracks]
    times = [t for t in times if t]
    return {
        "rows": len(tracks),
        "events": events,
        "first_played": min(times).isoformat() if times else None,
        "last_played": max(times).isoformat() if times else None,
    }


# ---------------------------------------------------------------------------
# Provider cards
# ---------------------------------------------------------------------------

def _registry(store):
    try:
        return store.read_json(store.v3 / "import_registry.json", {}) or {}
    except Exception:
        return {}


def provider_cards(store: Store):
    files = source_files(store)
    registry = _registry(store)
    sp_configured, sp_connected, sp_who, sp_error = spotify_state()
    lf_key, lf_user = lastfm_state()
    apple = _mod("apple_music_connector")
    cards = []
    for pid, name, parser, how in PROVIDERS:
        card = {"id": pid, "label": name, "how_to": how, "state": "not_connected",
                "capabilities": [], "badge": "IMPORT", "note": None, "stats": None,
                "last_synced": None, "can_import": parser is not None, "can_connect": False,
                "can_sync": False, "error": None}
        reg = registry.get(pid) or {}
        path = files.get(pid)
        if pid == "spotify" and "spotify_export" in files and not path:
            path = files["spotify_export"]
        if path is not None:
            try:
                card["stats"] = _history_stats(json.loads(path.read_text(encoding="utf-8")))
                card["state"] = "imported"
            except (OSError, ValueError):
                card["error"] = "The saved data for this source is unreadable. Re-import it."
            card["last_synced"] = reg.get("synced_at") or reg.get("imported_at")
            if not card["last_synced"]:
                try:
                    from datetime import datetime, timezone
                    card["last_synced"] = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat()
                except OSError:
                    pass
        if pid == "spotify":
            card["capabilities"] = ["live", "import"]
            if not sp_configured:
                card["badge"] = "REQUIRES_SETUP"
                card["note"] = "Live connection needs your own free Spotify app Client ID in .env (see SPOTIFY_SETUP.md). Export import works without it."
            else:
                card["badge"] = "LIVE_CONNECTION"
                card["can_connect"] = not sp_connected
            if sp_connected:
                card["state"] = "connected"
                card["can_sync"] = True
                card["account"] = sp_who
            elif card["state"] == "imported" and sp_configured:
                card["note"] = "Not connected right now. Your previously synced or imported data is still part of your DNA."
            if sp_error:
                card["error"] = sp_error
        elif pid == "lastfm":
            card["capabilities"] = ["live", "import"]
            if lf_key and lf_user:
                card["badge"] = "LIVE_CONNECTION"
                card["state"] = "connected" if card["state"] == "imported" else "configured"
                card["can_sync"] = True
                card["account"] = lf_user
            else:
                card["badge"] = "LIVE_CONNECTION"
                card["can_connect"] = True
                card["note"] = "Live sync needs your username and a free Last.fm API key. Export files work offline."
        elif pid == "apple_music":
            card["capabilities"] = ["import"]
            status = apple.config_status() if apple else {}
            card["note"] = ("Live Apple Music access is not available: it requires Apple developer credentials "
                            "and a Music User Token. Import your Apple privacy export instead.")
            card["live_setup_missing"] = status.get("missing", [])
        elif pid == "local_files":
            card["badge"] = "COMING_SOON"
            card["capabilities"] = []
        else:
            card["capabilities"] = ["import"]
            if pid not in ("generic_csv", "generic_json", "youtube_music"):
                card["note"] = "Uses the generic column importer; official export formats vary."
        cards.append(card)
    return cards


def sources_summary(store: Store, demo=False):
    cards = provider_cards(store)
    active = [c for c in cards if c["state"] in ("connected", "imported")]
    return {"cards": cards, "active_count": len(active), "demo_mode": demo,
            "active": [{"id": c["id"], "label": c["label"], "state": c["state"],
                        "rows": (c["stats"] or {}).get("rows"), "events": (c["stats"] or {}).get("events")}
                       for c in active]}


# ---------------------------------------------------------------------------
# Imports
# ---------------------------------------------------------------------------

def _spotify_export_history(path):
    """Spotify Extended Streaming History -> normalized history.

    Streams shorter than 30 s are not counted as listens (Spotify's own
    royalty threshold). The Spotify track URI is kept as provider identity."""
    from source_common import make_history, stamp_track
    raw = json.loads(Path(path).read_text(encoding="utf-8-sig"))
    if isinstance(raw, dict):
        raw = raw.get("items") or raw.get("tracks") or []
    if not isinstance(raw, list):
        raise ValueError("Expected a JSON list of streaming-history entries.")
    tracks, short = [], 0
    for e in raw:
        if not isinstance(e, dict):
            continue
        title = e.get("master_metadata_track_name") or e.get("trackName")
        artist = e.get("master_metadata_album_artist_name") or e.get("artistName")
        if not title:
            continue
        ms = e.get("ms_played", e.get("msPlayed", 0)) or 0
        if ms and ms < 30000:
            short += 1
            continue
        t = {"track_name": title, "artist_name": artist or "Unknown artist"}
        album = e.get("master_metadata_album_album_name")
        if album:
            t["album_name"] = album
        if e.get("ts") or e.get("endTime"):
            t["played_at"] = e.get("ts") or e.get("endTime")
        uri = e.get("spotify_track_uri")
        raw_id = None
        if uri and str(uri).startswith("spotify:track:"):
            t["provider_uri"] = uri
            raw_id = str(uri).split(":")[-1]
        stamp_track(t, "spotify", confidence=0.95, raw_id=raw_id, source_type="file_export")
        tracks.append(t)
    if not tracks:
        raise ValueError("No music streams found (podcasts and <30 s plays are ignored).")
    return make_history("spotify", tracks, extra={"import_kind": "extended_streaming_history",
                                                 "short_plays_ignored": short})


def import_file(store: Store, provider: str, filename: str, data: bytes):
    if provider not in PROVIDER_IDS:
        raise ProductError("BAD_REQUEST", "Unknown source", f"'{provider}' is not a supported source.")
    parser = dict((p[0], p[2]) for p in PROVIDERS)[provider]
    if parser is None:
        raise ProductError("UNSUPPORTED_FORMAT", "Not available yet",
                           f"{label(provider)} import is not implemented yet.")
    if not data:
        raise ProductError("BAD_REQUEST", "No file received", "Choose an export file to import.")
    suffix = Path(filename or "export.json").suffix.lower() or ".json"
    if suffix not in IMPORT_EXTENSIONS:
        raise ProductError("UNSUPPORTED_FORMAT", "Unsupported file type",
                           f"{suffix} files can't be imported. Use a .json or .csv export"
                           + (" (or .html for Google Takeout)." if provider == "youtube_music" else "."))
    digest = hashlib.sha256(data).hexdigest()
    registry = _registry(store)
    prev = registry.get(provider) or {}
    if prev.get("sha256") == digest:
        raise ProductError("DUPLICATE_IMPORT", "Already imported",
                           f"This exact {label(provider)} file was already imported on {prev.get('imported_at', 'an earlier date')[:10]}. Nothing changed.",
                           imported_at=prev.get("imported_at"))

    with tempfile.NamedTemporaryFile("wb", suffix=suffix, delete=False) as tmp:
        tmp.write(data)
        tmp_path = Path(tmp.name)
    try:
        if parser == "spotify_export":
            history = _spotify_export_history(tmp_path)
            target = store.imports_dir / "spotify_export.json"
        elif parser == "lastfm":
            history = __import__("import_lastfm").parse_export_file(tmp_path)
            target = store.path(LEGACY_FILES["lastfm"])
        elif parser == "takeout":
            history = __import__("import_youtube_takeout").import_takeout(tmp_path)
            target = store.path(LEGACY_FILES["youtube_music"])
        else:
            svc = MULTI_SERVICE_ID.get(provider, provider)
            history = __import__("import_multi_service").import_service_export(tmp_path, svc)
            target = store.imports_dir / f"{provider}.json"
    except ProductError:
        raise
    except (ValueError, KeyError, TypeError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ProductError("MALFORMED_IMPORT", "We couldn't read that file",
                           f"That doesn't look like a {label(provider)} export we understand. "
                           "Check that it has track and artist information.", detail=str(exc))
    finally:
        tmp_path.unlink(missing_ok=True)

    tracks = history.get("tracks") or []
    if not tracks:
        raise ProductError("MALFORMED_IMPORT", "No music found in that file",
                           "The file was readable but contained no tracks we could use.")
    store.write_json(target, history)
    stats = _history_stats(history)
    registry[provider] = {"sha256": digest, "filename": Path(filename or "").name[:120],
                          "imported_at": now_iso(), "rows": stats["rows"], "events": stats["events"],
                          "file": str(target.relative_to(store.base))}
    store.write_json(store.v3 / "import_registry.json", registry)
    replaced = bool(prev)
    return {"provider": provider, "label": label(provider), "replaced_previous": replaced, **stats,
            "notes": [n for n in [
                "This import replaced your previous one from the same service." if replaced else None,
                f"{history.get('short_plays_ignored')} plays under 30 seconds were not counted."
                if history.get("short_plays_ignored") else None,
            ] if n]}


def remove_source(store: Store, provider: str):
    """Delete the normalized copy of one source (the original export is untouched)."""
    files = source_files(store)
    targets = []
    if provider in files:
        targets.append(files[provider])
    if provider == "spotify" and "spotify_export" in files:
        targets.append(files["spotify_export"])
    if not targets:
        raise ProductError("NOT_FOUND", "Nothing to remove", f"No imported data from {label(provider)} was found.")
    for p in targets:
        p.unlink(missing_ok=True)
    registry = _registry(store)
    registry.pop(provider, None)
    store.write_json(store.v3 / "import_registry.json", registry)
    return {"provider": provider, "removed_files": [p.name for p in targets]}


# ---------------------------------------------------------------------------
# Live sync
# ---------------------------------------------------------------------------

def _classify_provider_error(provider, exc):
    text = str(exc)
    low = text.lower()
    name = label(provider)
    if "429" in text or "rate limit" in low or "error 29" in low:
        return ProductError("RATE_LIMITED", f"{name} asked us to slow down",
                            "Too many requests in a short time. Try syncing again in a few minutes.", detail=text)
    if "401" in text or "refresh token" in low or "invalid_grant" in low or "expired" in low:
        return ProductError("AUTH_EXPIRED", f"{name} connection expired",
                            f"Reconnect {name} to keep syncing. Your existing data is safe.", detail=text)
    if "error 10" in low or "error 26" in low or "api key" in low or "error 6" in low:
        return ProductError("REQUIRES_SETUP", f"{name} needs setup",
                            f"{name} rejected the configured credentials. Check your username and API key.", detail=text)
    if "timed out" in low or "could not reach" in low or "urlopen" in low or "name or service" in low \
            or "network" in low or "request failed" in low:
        return ProductError("OFFLINE", f"Couldn't reach {name}",
                            "You may be offline, or the service is down. Nothing was changed.", detail=text)
    return ProductError("PROVIDER_UNAVAILABLE", f"{name} isn't responding",
                        f"{name} returned an unexpected answer. Nothing was changed; try again later.", detail=text)


def sync_provider(store: Store, provider: str):
    if provider == "spotify":
        _configured, connected, _who, _err = spotify_state()
        if not connected:
            raise ProductError("REQUIRES_SETUP", "Spotify isn't connected", "Connect Spotify first, then sync.")
        from mtr_app.spotify_state import SPOTIFY
        sc = _mod("spotify_connector")
        try:
            history = sc.fetch_listening_history(SPOTIFY.session)
        except Exception as exc:
            raise _classify_provider_error("spotify", exc)
        target = store.path(LEGACY_FILES["spotify"])
    elif provider == "lastfm":
        key, user = lastfm_state()
        if not (key and user):
            raise ProductError("REQUIRES_SETUP", "Last.fm needs setup",
                               "Add your Last.fm username and API key first.")
        lf = _mod("lastfm_client")
        try:
            history = lf.LastfmClient().get_recent_tracks(username=user, limit=200, pages=5)
        except Exception as exc:
            raise _classify_provider_error("lastfm", exc)
        target = store.path(LEGACY_FILES["lastfm"])
    else:
        raise ProductError("BAD_REQUEST", "Sync not available",
                           f"{label(provider)} has no live sync. Import an export file instead.")
    if not history.get("tracks"):
        raise ProductError("NOT_ENOUGH_DATA", "No listening history returned",
                           f"{label(provider)} returned no tracks yet. Listen a little and try again.")
    store.write_json(target, history)
    try:
        import provider_adapter
        provider_adapter.update_sync_state(provider, cursor=provider_adapter.newest_cursor(history["tracks"]),
                                           tracks_added=len(history["tracks"]),
                                           path=store.v3 / "provider_sync_state.json")
    except Exception:
        pass
    registry = _registry(store)
    entry = registry.get(provider) or {}
    entry.update({"synced_at": now_iso(), **_history_stats(history)})
    registry[provider] = entry
    store.write_json(store.v3 / "import_registry.json", registry)
    return {"provider": provider, "label": label(provider), **_history_stats(history)}


def save_lastfm_credentials(username, api_key):
    from mtr_app import local_config
    username = (username or "").strip()
    api_key = (api_key or "").strip()
    if not username:
        raise ProductError("BAD_REQUEST", "Username needed", "Enter your Last.fm username.")
    local_config.set_lastfm(username, api_key or None)
    key, user = lastfm_state()
    return {"api_key_present": key, "username": user}


def disconnect(store: Store, provider: str):
    """Revoke a live connection. Imported data stays unless removed separately."""
    if provider == "spotify":
        from mtr_app.spotify_state import SPOTIFY
        SPOTIFY.session = None
        SPOTIFY.last_error = ""
        sc = _mod("spotify_connector")
        if sc is not None:
            sc.SpotifySession.delete_saved()
    elif provider == "lastfm":
        from mtr_app import local_config
        local_config.clear_lastfm()
    else:
        raise ProductError("BAD_REQUEST", "Nothing to disconnect",
                           f"{label(provider)} has no live connection; you can remove its imported data instead.")
    return {"provider": provider, "disconnected": True}
