"""Apple Music through MusicKit (read-only).

How Apple's access works
------------------------
* A *developer token* (ES256 JWT) identifies the app. It is created from a
  MusicKit key (.p8) in a paid Apple Developer account. Users either paste a
  ready token or paste Team ID + Key ID + the .p8 contents, and we sign the
  token locally (connectors/es256.py). Nothing leaves this computer.
* A *Music User Token* comes from Apple's own sign-in: our local page loads
  MusicKit JS from Apple's CDN and calls `music.authorize()`. Apple shows its
  consent screen; the token it returns is posted back to this app.
* Reads: https://api.music.apple.com/v1/me/recent/played/tracks,
  /v1/me/library/songs and /v1/me/history/heavy-rotation.

Music User Tokens can't be refreshed; when Apple expires one (typically after
months) the card asks the user to connect again.
"""
from __future__ import annotations

import time

from . import base, es256
from .base import Connector, ConnectorError

API = "https://api.music.apple.com"
RECENT_PAGES = 5         # recent/played/tracks: 30 per page
LIBRARY_MAX = 2000
MUSICKIT_JS = "https://js-cdn.music.apple.com/musickit/v3/musickit.js"


class AppleMusic(Connector):
    id = "apple_music"
    label = "Apple Music"
    auth = "musickit"
    needs_redirect_registration = False
    fields = [
        {"name": "team_id", "label": "Team ID", "required": False,
         "help": "Apple Developer → Membership details (10 characters)."},
        {"name": "key_id", "label": "MusicKit Key ID", "required": False,
         "help": "Certificates, Identifiers & Profiles → Keys → your key with MusicKit enabled."},
        {"name": "private_key", "label": "Private key (.p8 file contents)", "required": False, "secret": True,
         "multiline": True, "help": "Open the downloaded AuthKey_XXXX.p8 in a text editor and paste all of it."},
        {"name": "developer_token", "label": "…or a ready developer token (JWT)", "required": False, "secret": True,
         "help": "Use this instead of the three fields above if you already generated a token."},
    ]
    dashboard_url = "https://developer.apple.com/account/resources/authkeys/list"
    setup_steps = [
        "You need an Apple Developer Program membership (Apple requires it for MusicKit).",
        "Certificates, Identifiers & Profiles → Keys → create a key with “Media Services (MusicKit)” enabled and download the .p8 file.",
        "Paste your Team ID, the Key ID and the .p8 contents here (or a developer token you already have). The token is signed on this computer.",
    ]
    reads = "Recently played tracks, heavy rotation and the songs in your library."
    limits = "Apple requires a paid developer membership for MusicKit. Without one, import the Apple privacy export (Play Activity CSV)."

    def validate_config(self, cfg):
        out = {k: str(cfg.get(k) or "").strip() for k in ("team_id", "key_id", "private_key", "developer_token")}
        out = {k: v for k, v in out.items() if v}
        if out.get("developer_token"):
            if out["developer_token"].count(".") != 2:
                raise ConnectorError("The developer token should be a JWT (three parts separated by dots).", kind="setup")
            exp = es256.jwt_expiry(out["developer_token"])
            if exp and exp < time.time():
                raise ConnectorError("That developer token has already expired. Generate a new one.", kind="setup")
            return out
        missing = [f["label"] for f in self.fields[:3] if not out.get(f["name"])]
        if missing:
            raise ConnectorError("Enter a developer token, or Team ID, Key ID and the .p8 key "
                                 f"(missing: {', '.join(missing)}).", kind="setup")
        try:
            es256.private_key_from_pem(out["private_key"])
        except ValueError as exc:
            raise ConnectorError(f"The private key isn't a valid MusicKit .p8 key: {exc}", kind="setup") from exc
        return out

    def is_configured(self, cfg):
        return bool(cfg.get("developer_token") or (cfg.get("team_id") and cfg.get("key_id") and cfg.get("private_key")))

    def developer_token(self, cfg) -> str:
        if cfg.get("developer_token"):
            return cfg["developer_token"]
        if not self.is_configured(cfg):
            raise ConnectorError("Apple Music needs a one-time setup first.", kind="setup")
        # Cache the signed token for a day; it is valid for six months.
        cached = getattr(self, "_cache", None)
        key = (cfg["team_id"], cfg["key_id"], cfg["private_key"])
        if cached and cached[0] == key and cached[2] > time.time():
            return cached[1]
        tok = es256.apple_developer_token(cfg["team_id"], cfg["key_id"], cfg["private_key"])
        self._cache = (key, tok, time.time() + 86400)
        return tok

    def _headers(self, cfg, token):
        return {"Authorization": f"Bearer {self.developer_token(cfg)}",
                "Music-User-Token": token["music_user_token"]}

    def _get(self, cfg, token, path, params=None):
        try:
            return base.http_json(f"{API}{path}", params=params, headers=self._headers(cfg, token))
        except ConnectorError as exc:
            if exc.status == 401:
                raise ConnectorError("Apple rejected the developer token. Check the Team ID, Key ID and key.",
                                     kind="setup", status=401) from exc
            if exc.status == 403:
                raise ConnectorError("Apple Music access expired or was revoked. Connect again.",
                                     kind="auth", status=403) from exc
            raise

    def account_name(self, cfg, token):
        # There is no profile endpoint; a storefront lookup proves both tokens work.
        data = self._get(cfg, token, "/v1/me/storefront")
        sf = (data.get("data") or [{}])[0]
        name = (sf.get("attributes") or {}).get("name")
        return f"Apple Music ({name})" if name else "Apple Music account"

    def _collect(self, cfg, token, path, params, max_items, max_pages):
        items, pages = [], 0
        next_path, next_params = path, dict(params)
        while next_path and pages < max_pages and len(items) < max_items:
            data = self._get(cfg, token, next_path, next_params)
            items.extend(data.get("data") or [])
            pages += 1
            nxt = data.get("next")
            # Only follow Apple's relative "next" links under /v1/me/.
            next_path, next_params = (nxt, None) if isinstance(nxt, str) and nxt.startswith("/v1/me/") else (None, None)
        return items[:max_items]

    def fetch_history(self, cfg, token):
        from source_common import make_history, stamp_track
        tracks = []
        batches = [
            ("recent_play", self._collect(cfg, token, "/v1/me/recent/played/tracks", {"limit": 30}, 150, RECENT_PAGES)),
            ("heavy_rotation", self._heavy_rotation_songs(cfg, token)),
            ("saved_library", self._collect(cfg, token, "/v1/me/library/songs", {"limit": 100},
                                            LIBRARY_MAX, LIBRARY_MAX // 100)),
        ]
        for signal, items in batches:
            for item in items:
                t = _track(item, signal)
                if t:
                    stamp_track(t, "apple_music", confidence=0.95, raw_id=t.pop("_raw_id", None), source_type="oauth")
                    tracks.append(t)
        return make_history("apple_music", tracks, extra={"fetch_kind": "recent+heavy_rotation+library"})

    def _heavy_rotation_songs(self, cfg, token):
        # Heavy rotation returns albums/playlists, not songs; we keep it as an
        # artist signal only when the resource carries an artist name.
        out = []
        for res in self._collect(cfg, token, "/v1/me/history/heavy-rotation", {"limit": 10}, 30, 3):
            a = res.get("attributes") or {}
            if res.get("type") in ("albums", "library-albums") and a.get("artistName") and a.get("name"):
                out.append({"id": res.get("id"), "type": "album-rotation",
                            "attributes": {"name": a["name"], "artistName": a["artistName"],
                                           "albumName": a["name"], "genreNames": a.get("genreNames") or []}})
        return out


def _track(item, signal):
    a = item.get("attributes") or {}
    title, artist = a.get("name"), a.get("artistName")
    if not title or not artist:
        return None
    if item.get("type") == "album-rotation":
        # An album in heavy rotation: record the album as the "track" so the
        # artist signal counts, but mark it so nobody mistakes it for a song.
        t = {"track_name": title, "artist_name": artist, "album_name": title, "signal": "heavy_rotation_album"}
    else:
        t = {"track_name": title, "artist_name": artist, "signal": signal}
        if a.get("albumName"):
            t["album_name"] = a["albumName"]
    if a.get("durationInMillis"):
        t["duration_ms"] = a["durationInMillis"]
    if a.get("isrc"):
        t["isrc"] = a["isrc"]
    genres = [g for g in (a.get("genreNames") or []) if g and g.lower() != "music"]
    if genres:
        t["genres"] = genres
    if signal == "saved_library":
        t["saved"] = True
        if a.get("dateAdded"):
            t["saved_at"] = a["dateAdded"]
    t["_raw_id"] = (a.get("playParams") or {}).get("catalogId") or item.get("id")
    return t


CONNECTOR = AppleMusic()
