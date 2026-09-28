"""Deezer: OAuth 2.0 with the user's own Deezer app (read-only).

Endpoints (Deezer API):
  authorize  https://connect.deezer.com/oauth/auth.php?app_id=&redirect_uri=&perms=
  token      https://connect.deezer.com/oauth/access_token.php?app_id=&secret=&code=&output=json
  data       https://api.deezer.com/user/me, /user/me/history, /user/me/tracks

Deezer's flow needs the app secret for the token exchange, so it is stored
locally (0600) with the rest of the connector settings. Deezer does not
echo an OAuth `state` parameter reliably, so the state rides inside the
redirect URI's query string instead; Deezer only checks the domain.

Honest caveat shown in the UI: Deezer has at times paused registration of new
developer apps. People without an existing app can still import an export.
"""
from __future__ import annotations

from urllib import parse

from . import base
from .base import Connector, ConnectorError

AUTH_URL = "https://connect.deezer.com/oauth/auth.php"
TOKEN_URL = "https://connect.deezer.com/oauth/access_token.php"
API = "https://api.deezer.com"
PERMS = "basic_access,listening_history,offline_access"
MAX_ITEMS = 2000


class Deezer(Connector):
    id = "deezer"
    label = "Deezer"
    auth = "oauth"
    state_in_redirect = True
    fields = [
        {"name": "app_id", "label": "Application ID", "required": True},
        {"name": "secret", "label": "Secret key", "required": True, "secret": True},
    ]
    dashboard_url = "https://developers.deezer.com/myapps"
    setup_steps = [
        "Open Deezer for Developers → My Apps and create an app (or open an existing one).",
        "Set the Application domain / Redirect URL to the address shown below.",
        "Paste the Application ID and Secret key here.",
    ]
    reads = "Your recently played tracks and your favourite tracks."
    limits = "Deezer sometimes pauses new developer-app registration; if you can't create one, import an export instead."

    def _check(self, data):
        if isinstance(data, dict) and data.get("error"):
            err = data["error"] if isinstance(data["error"], dict) else {"message": str(data["error"])}
            msg = err.get("message") or "Deezer returned an error."
            kind = "auth" if err.get("type") in ("OAuthException", "InvalidTokenException") or err.get("code") in (200, 300) \
                else "rate_limit" if err.get("code") == 4 else "provider"
            raise ConnectorError(f"Deezer: {msg}", kind=kind)
        return data

    def redirect_with_state(self, redirect_uri, state):
        return f"{redirect_uri}?{parse.urlencode({'state': state})}"

    def authorize_url(self, cfg, redirect_uri, state, challenge):
        return f"{AUTH_URL}?" + parse.urlencode({
            "app_id": cfg["app_id"], "redirect_uri": self.redirect_with_state(redirect_uri, state),
            "perms": PERMS})

    def exchange_code(self, cfg, code, redirect_uri, verifier):
        data = self._check(base.http_json(TOKEN_URL, params={
            "app_id": cfg["app_id"], "secret": cfg["secret"], "code": code, "output": "json"}))
        if not isinstance(data, dict):
            raise ConnectorError("Deezer refused the authorization code.", kind="auth")
        # offline_access tokens come back with expires=0 (they don't expire).
        return base.token_payload(data)

    def _get(self, path, token, params=None):
        q = {"access_token": token["access_token"], **(params or {})}
        return self._check(base.http_json(f"{API}{path}", params=q))

    def account_name(self, cfg, token):
        me = self._get("/user/me", token)
        return me.get("name") or str(me.get("id") or "") or None

    def _paged(self, path, token):
        items, index = [], 0
        while len(items) < MAX_ITEMS:
            page = self._get(path, token, {"index": index, "limit": 100})
            data = page.get("data") or []
            items.extend(data)
            if not data or not page.get("next"):
                break
            index += len(data)
        return items[:MAX_ITEMS]

    def fetch_history(self, cfg, token):
        from source_common import make_history, stamp_track
        tracks = []
        for kind, path in (("history", "/user/me/history"), ("favorite", "/user/me/tracks")):
            for item in self._paged(path, token):
                t = _track(item, kind)
                if t:
                    stamp_track(t, "deezer", confidence=0.95, raw_id=item.get("id"), source_type="oauth")
                    tracks.append(t)
        return make_history("deezer", tracks, extra={"fetch_kind": "history+favorites"})


def _track(item, kind):
    title = item.get("title_short") or item.get("title")
    artist = (item.get("artist") or {}).get("name")
    if not title or not artist or item.get("type", "track") != "track":
        return None
    t = {"track_name": title, "artist_name": artist}
    album = (item.get("album") or {}).get("title")
    if album:
        t["album_name"] = album
    if item.get("duration"):
        t["duration_ms"] = int(item["duration"]) * 1000
    if item.get("isrc"):
        t["isrc"] = item["isrc"]
    ts = base.epoch_to_iso(item.get("timestamp") or item.get("time_add"))
    if kind == "history":
        t["signal"] = "recent_play"
        if ts:
            t["played_at"] = ts
    if kind == "favorite":
        t["signal"] = "saved_library"
        t["saved"] = True
        if ts:
            t["saved_at"] = ts
    if item.get("link"):
        t["provider_url"] = item["link"]
    return t


CONNECTOR = Deezer()
