"""ListenBrainz: open, public listening history by user name.

ListenBrainz (MetaBrainz Foundation) publishes every user's listens through a
free API. No developer app and no OAuth are needed, so this is the one service
that really is one step: type your user name. Many people feed it from
Spotify, Apple Music, YouTube Music or Jellyfin with a scrobbler, which makes
it a good bridge for services that have no API of their own.

API: GET https://api.listenbrainz.org/1/user/<name>/listens?count=&max_ts=
     GET https://api.listenbrainz.org/1/user/<name>/listen-count
An optional user token (from https://listenbrainz.org/settings/) only raises
rate limits; public listens don't need it.
"""
from __future__ import annotations

from urllib import parse

from . import base
from .base import Connector, ConnectorError

API = "https://api.listenbrainz.org/1"
PAGE = 1000            # the API's documented maximum per request
MAX_LISTENS = 5000     # enough for a solid DNA, bounded for speed and politeness


class ListenBrainz(Connector):
    id = "listenbrainz"
    label = "ListenBrainz"
    auth = "username"
    needs_redirect_registration = False
    fields = [
        {"name": "username", "label": "ListenBrainz user name", "required": True},
        {"name": "user_token", "label": "User token (optional)", "required": False, "secret": True,
         "help": "Only raises rate limits. Find it at listenbrainz.org → Settings."},
    ]
    dashboard_url = "https://listenbrainz.org/settings/"
    setup_steps = ["Type your ListenBrainz user name. Public listens need no password or app."]
    reads = f"Your public listens (up to the latest {MAX_LISTENS:,})."
    limits = "Only listens that reach ListenBrainz are visible (it records what your scrobbler sends)."

    def _headers(self, cfg):
        tok = cfg.get("user_token")
        return {"Authorization": f"Token {tok}"} if tok else {}

    def _user(self, cfg, token):
        name = (token or {}).get("username") or cfg.get("username") or ""
        if not name:
            raise ConnectorError("ListenBrainz user name is missing.", kind="setup")
        return parse.quote(name, safe="")

    def account_name(self, cfg, token):
        user = self._user(cfg, token)
        try:
            data = base.http_json(f"{API}/user/{user}/listen-count", headers=self._headers(cfg))
        except ConnectorError as exc:
            if exc.kind == "not_found":
                raise ConnectorError(f"There is no ListenBrainz user called '{parse.unquote(user)}'.",
                                     kind="setup") from exc
            raise
        count = ((data or {}).get("payload") or {}).get("count")
        if count is None:
            raise ConnectorError("ListenBrainz answered without a listen count.", kind="provider")
        return parse.unquote(user)

    def fetch_history(self, cfg, token):
        from source_common import make_history, stamp_track
        user = self._user(cfg, token)
        tracks, max_ts = [], None
        while len(tracks) < MAX_LISTENS:
            params = {"count": min(PAGE, MAX_LISTENS - len(tracks))}
            if max_ts:
                params["max_ts"] = max_ts
            data = base.http_json(f"{API}/user/{user}/listens", params=params, headers=self._headers(cfg))
            listens = ((data or {}).get("payload") or {}).get("listens") or []
            if not listens:
                break
            for item in listens:
                t = _track(item)
                if t:
                    stamp_track(t, "listenbrainz", confidence=0.95, raw_id=t.pop("_raw_id", None),
                                source_type="api")
                    tracks.append(t)
            oldest = min((int(i.get("listened_at") or 0) for i in listens), default=0)
            if not oldest or (max_ts and oldest >= max_ts):
                break
            max_ts = oldest
        return make_history("listenbrainz", tracks, extra={"account": parse.unquote(user),
                                                           "fetch_kind": "listens"})


def _track(item):
    meta = item.get("track_metadata") or {}
    title, artist = meta.get("track_name"), meta.get("artist_name")
    if not title or not artist:
        return None
    t = {"track_name": title, "artist_name": artist}
    if meta.get("release_name"):
        t["album_name"] = meta["release_name"]
    ts = base.epoch_to_iso(item.get("listened_at"))
    if ts:
        t["played_at"] = ts
    info = meta.get("additional_info") or {}
    mapping = meta.get("mbid_mapping") or {}
    if info.get("isrc"):
        t["isrc"] = info["isrc"]
    if info.get("duration_ms"):
        t["duration_ms"] = info["duration_ms"]
    t["_raw_id"] = mapping.get("recording_mbid") or info.get("recording_mbid") or item.get("recording_msid")
    return t


CONNECTOR = ListenBrainz()
