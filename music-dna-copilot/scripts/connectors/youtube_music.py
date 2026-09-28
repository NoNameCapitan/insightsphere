"""YouTube Music through Google sign-in and the YouTube Data API (read-only).

What is (and isn't) possible
----------------------------
YouTube Music has no public API of its own, and Google does not expose watch
history through any API. What the official YouTube Data API v3 *does* give a
signed-in user is the list of videos they liked, and YouTube Music "thumbs up"
on songs land in the same Liked list. We keep the ones YouTube files under the
Music category (categoryId 10) and turn "Artist - Topic" channels and
"Artist - Title" video names into track + artist.

For full play history, Google Takeout import remains available on the card.

Flow: OAuth 2.0 for installed apps with PKCE and a loopback redirect
(any 127.0.0.1 port is accepted for "Desktop app" clients).
Scope: https://www.googleapis.com/auth/youtube.readonly
"""
from __future__ import annotations

import re
from urllib import parse

from . import base
from .base import Connector, ConnectorError

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
API = "https://www.googleapis.com/youtube/v3"
SCOPE = "https://www.googleapis.com/auth/youtube.readonly"
MUSIC_CATEGORY = "10"
MAX_PAGES = 20   # 50 per page -> up to 1,000 liked videos inspected

_DURATION = re.compile(r"P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?")


class YouTubeMusic(Connector):
    id = "youtube_music"
    label = "YouTube Music"
    auth = "oauth"
    fields = [
        {"name": "client_id", "label": "OAuth client ID", "required": True,
         "help": "Google Cloud → APIs & Services → Credentials → OAuth client ID of type Desktop app."},
        {"name": "client_secret", "label": "Client secret", "required": True, "secret": True,
         "help": "Shown next to the client ID. Google requires it even for desktop apps."},
    ]
    dashboard_url = "https://console.cloud.google.com/apis/credentials"
    setup_steps = [
        "In Google Cloud Console create a project and enable “YouTube Data API v3”.",
        "Configure the OAuth consent screen (External, Testing) and add your Google account as a test user.",
        "Create credentials → OAuth client ID → Desktop app. Loopback addresses like the one below are allowed automatically.",
        "Paste the client ID and client secret here.",
    ]
    reads = "Songs you liked on YouTube / YouTube Music (the Music category of your Liked videos) and your channel name."
    limits = "Google has no API for YouTube Music play history; use Google Takeout import for that."
    needs_redirect_registration = False

    def authorize_url(self, cfg, redirect_uri, state, challenge):
        return f"{AUTH_URL}?" + parse.urlencode({
            "client_id": cfg["client_id"], "redirect_uri": redirect_uri, "response_type": "code",
            "scope": SCOPE, "access_type": "offline", "prompt": "consent", "state": state,
            "code_challenge": challenge, "code_challenge_method": "S256"})

    def exchange_code(self, cfg, code, redirect_uri, verifier):
        return base.token_payload(base.http_json(TOKEN_URL, form={
            "code": code, "client_id": cfg["client_id"], "client_secret": cfg["client_secret"],
            "redirect_uri": redirect_uri, "grant_type": "authorization_code", "code_verifier": verifier}))

    def refresh(self, cfg, token):
        if not token.get("refresh_token"):
            raise ConnectorError("Google session expired. Connect YouTube Music again.", kind="auth")
        try:
            data = base.http_json(TOKEN_URL, form={
                "client_id": cfg["client_id"], "client_secret": cfg["client_secret"],
                "refresh_token": token["refresh_token"], "grant_type": "refresh_token"})
        except ConnectorError as exc:
            if exc.status in (400, 401):
                raise ConnectorError("Google revoked or expired this connection. Connect again.", kind="auth") from exc
            raise
        return base.token_payload(data, previous=token)

    def _get(self, path, token, params):
        return base.http_json(f"{API}{path}", params=params,
                              headers={"Authorization": f"Bearer {token['access_token']}"})

    def account_name(self, cfg, token):
        data = self._get("/channels", token, {"part": "snippet", "mine": "true"})
        items = data.get("items") or []
        if not items:
            return "Google account (no YouTube channel)"
        return (items[0].get("snippet") or {}).get("title") or "YouTube account"

    def fetch_history(self, cfg, token):
        from source_common import make_history, stamp_track
        tracks, page_token, inspected = [], None, 0
        for _ in range(MAX_PAGES):
            params = {"part": "snippet,contentDetails", "myRating": "like", "maxResults": 50}
            if page_token:
                params["pageToken"] = page_token
            data = self._get("/videos", token, params)
            items = data.get("items") or []
            inspected += len(items)
            for item in items:
                t = video_to_track(item)
                if t:
                    stamp_track(t, "youtube_music", confidence=t.pop("_confidence"), raw_id=item.get("id"),
                                source_type="oauth")
                    tracks.append(t)
            page_token = data.get("nextPageToken")
            if not page_token or not items:
                break
        return make_history("youtube_music", tracks, extra={"fetch_kind": "liked_music",
                                                            "liked_videos_inspected": inspected})


def _duration_ms(iso):
    m = _DURATION.fullmatch(iso or "")
    if not m or not any(m.groups()):
        return None
    d, h, mi, s = (int(x or 0) for x in m.groups())
    return ((d * 24 + h) * 3600 + mi * 60 + s) * 1000


def video_to_track(item):
    """Liked video -> track, or None when it isn't music we can name honestly."""
    sn = item.get("snippet") or {}
    if str(sn.get("categoryId")) != MUSIC_CATEGORY:
        return None
    from source_common import clean_title
    raw_title = (sn.get("title") or "").strip()
    channel = (sn.get("channelTitle") or "").strip()
    if not raw_title:
        return None
    if channel.endswith(" - Topic"):
        # Auto-generated YouTube Music uploads: channel is the artist, title is the song.
        artist, title, conf = channel[: -len(" - Topic")], raw_title, 0.95
    elif " - " in raw_title:
        artist, title, conf = raw_title.split(" - ", 1)[0], raw_title.split(" - ", 1)[1], 0.8
    elif " – " in raw_title:
        artist, title, conf = raw_title.split(" – ", 1)[0], raw_title.split(" – ", 1)[1], 0.8
    else:
        artist, title, conf = re.sub(r"(VEVO|Official)$", "", channel).strip(), raw_title, 0.6
    title = clean_title(title) or title
    artist = artist.strip()
    if not artist or not title:
        return None
    t = {"track_name": title, "artist_name": artist, "signal": "saved_library", "saved": True,
         "_confidence": conf, "provider_url": f"https://music.youtube.com/watch?v={item.get('id')}"}
    ms = _duration_ms((item.get("contentDetails") or {}).get("duration"))
    if ms:
        t["duration_ms"] = ms
    return t


CONNECTOR = YouTubeMusic()
