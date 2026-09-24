#!/usr/bin/env python3
"""Unified provider capability + incremental-sync foundation (v2.3, stdlib only)."""
from __future__ import annotations
import json
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUTS = ROOT / "outputs"
STATE_PATH = OUTPUTS / "provider_sync_state.json"

@dataclass(frozen=True)
class ProviderSpec:
    id: str; label: str; mode: str
    capabilities: tuple[str, ...]
    live_ready: bool = False
    import_ready: bool = False
    notes: str = ""

PROVIDERS = {
    "spotify": ProviderSpec("spotify","Spotify","live",("history","library","playlists","favorites","catalog","search"),True,True,"OAuth read-only"),
    "lastfm": ProviderSpec("lastfm","Last.fm","live",("history","favorites","catalog"),True,True,"API key + username"),
    "apple_music": ProviderSpec("apple_music","Apple Music","prepared",("history","library","playlists","favorites","catalog","recommendations"),False,True,"Live adapter prepared; developer credentials required"),
    "youtube_takeout": ProviderSpec("youtube_takeout","YouTube Music","import",("history",),False,True,"Google Takeout import"),
    "deezer": ProviderSpec("deezer","Deezer","import",("history","library","playlists","favorites"),False,True),
    "tidal": ProviderSpec("tidal","TIDAL","import",("history","library","playlists","favorites"),False,True),
    "soundcloud": ProviderSpec("soundcloud","SoundCloud","import",("history","library","playlists","favorites"),False,True),
    "bandcamp": ProviderSpec("bandcamp","Bandcamp","import",("library","favorites"),False,True),
    "yandex_music": ProviderSpec("yandex_music","Yandex Music","import",("history","library","playlists","favorites"),False,True),
    "amazon_music": ProviderSpec("amazon_music","Amazon Music","import",("history","library","playlists","favorites"),False,True),
    "qobuz": ProviderSpec("qobuz","Qobuz","import",("history","library","playlists","favorites"),False,True),
    "pandora": ProviderSpec("pandora","Pandora","import",("history","favorites"),False,True),
}

def provider_manifest():
    return [asdict(v) | {"capabilities": list(v.capabilities)} for v in PROVIDERS.values()]

def _load_state(path=STATE_PATH):
    try: return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError): return {"providers": {}}

def get_sync_state(provider, path=STATE_PATH):
    return _load_state(path).get("providers", {}).get(provider, {})

def update_sync_state(provider, *, cursor=None, tracks_added=0, events_added=0, status="ok", path=STATE_PATH):
    data=_load_state(path); data.setdefault("providers", {})
    old=data["providers"].get(provider,{})
    old.update({"last_sync": datetime.now(timezone.utc).isoformat(), "status": status,
                "tracks_added": int(tracks_added), "events_added": int(events_added)})
    if cursor is not None: old["cursor"] = cursor
    data["providers"][provider]=old
    p=Path(path); p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data,indent=2,ensure_ascii=False),encoding="utf-8")
    return old

def incremental_tracks(provider, tracks, path=STATE_PATH):
    """Return only rows newer than saved played_at cursor. Untimestamped rows stay eligible."""
    cursor=get_sync_state(provider,path).get("cursor")
    if not cursor: return list(tracks)
    return [t for t in tracks if not t.get("played_at") or str(t["played_at"]) > str(cursor)]

def newest_cursor(tracks):
    vals=[str(t["played_at"]) for t in tracks if t.get("played_at")]
    return max(vals) if vals else None
