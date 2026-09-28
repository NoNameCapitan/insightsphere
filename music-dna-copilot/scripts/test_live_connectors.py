#!/usr/bin/env python3
"""Live connector tests (stdlib only, offline).

Every service is replaced by a fake HTTP layer (connectors.base.urlopen), so
these tests prove our side of each protocol: URLs and parameters we send,
how we parse real response shapes, pagination bounds, token handling,
storage permissions, honest card states, and the HTTP routes of the app.
They cannot prove a service's live behaviour; KNOWN_LIMITATIONS.md says so.
"""
import io
import json
import os
import shutil
import stat
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
os.environ["MTR_CONFIG_DIR"] = tempfile.mkdtemp(prefix="mtr-conn-")
for _k in ("SPOTIFY_CLIENT_ID", "SPOTIFY_REDIRECT_URI"):
    os.environ.pop(_k, None)

import connectors  # noqa: E402
from connectors import MANAGER, ConnectorError, base, es256  # noqa: E402
from connectors.apple_music import CONNECTOR as APPLE  # noqa: E402
from connectors.deezer import CONNECTOR as DEEZER  # noqa: E402
from connectors.listenbrainz import CONNECTOR as LB  # noqa: E402
from connectors.youtube_music import CONNECTOR as YT, video_to_track  # noqa: E402
from dna3 import api, dna as D, sources as SRC  # noqa: E402
from dna3.errors import ProductError  # noqa: E402
from dna3.store import Store  # noqa: E402

PASSED, FAILED = [], []


def check(name, cond, detail=""):
    (PASSED if cond else FAILED).append(name)
    print(f"  {'PASS' if cond else 'FAIL'}  {name}" + (f"  ({detail})" if detail and not cond else ""))


# ---------------------------------------------------------------------------
# Fake HTTP
# ---------------------------------------------------------------------------

class FakeResp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.close()


class FakeNet:
    """Route requests by URL prefix to handler(req, url, query) -> (status, obj)."""

    def __init__(self):
        self.routes = []
        self.calls = []

    def on(self, prefix, handler):
        self.routes.insert(0, (prefix, handler))

    def __call__(self, req, timeout=None):
        url = req.full_url
        self.calls.append(req)
        parts = urlsplit(url)
        query = {k: v[0] for k, v in parse_qs(parts.query).items()}
        if req.data:
            query.update({k: v[0] for k, v in parse_qs(req.data.decode()).items()})
        # Longest matching prefix wins; among equals, the newest registration.
        for prefix, handler in sorted(self.routes, key=lambda r: -len(r[0])):
            if url.startswith(prefix):
                status, obj = handler(req, url, query)
                body = json.dumps(obj).encode() if not isinstance(obj, (bytes, str)) else \
                    (obj.encode() if isinstance(obj, str) else obj)
                if status >= 400:
                    raise urllib.error.HTTPError(url, status, "err", {}, io.BytesIO(body))
                return FakeResp(body)
        raise urllib.error.URLError(f"no fake route for {url}")


NET = FakeNet()
base.urlopen = NET


def reset_net():
    NET.routes.clear()
    NET.calls.clear()


def raises_kind(kind, fn, *a, **k):
    try:
        fn(*a, **k)
    except ConnectorError as exc:
        return exc.kind == kind
    return False


def product_code(code, fn, *a, **k):
    try:
        fn(*a, **k)
    except ProductError as exc:
        return exc.code == code
    return False


H = {"Host": "127.0.0.1:8765", "X-MusicDNA-Client": "3"}


def call(store, method, path, body=None, headers=None):
    raw = json.dumps(body).encode() if body is not None else b""
    r = api.dispatch(store, method, "/api/v3/" + path, headers if headers is not None else H, raw)
    if r.stream is not None:
        return r.status, [json.loads(x) for x in b"".join(r.stream).decode().splitlines() if x]
    return r.status, json.loads(r.body.decode())


def fresh_store():
    return Store(tempfile.mkdtemp(prefix="conn-store-"))


def forget_all():
    for pid in list(connectors.REGISTRY):
        MANAGER.clear_setup(pid)
    MANAGER.pending.clear()


# ---------------------------------------------------------------------------
# Fixtures in the services' documented response shapes
# ---------------------------------------------------------------------------

def lb_listens(n_total, page_size_seen):
    """ListenBrainz: listens newest first, paginated by max_ts."""
    all_listens = [{"listened_at": 1_700_000_000 - i * 300, "recording_msid": f"msid-{i}",
                    "track_metadata": {"artist_name": f"Artist {i % 7}", "track_name": f"Song {i}",
                                       "release_name": "Album", "additional_info": {"isrc": "GBAAA0000001"} if i == 0 else {},
                                       "mbid_mapping": {"recording_mbid": f"mbid-{i}"} if i % 2 else {}}}
                   for i in range(n_total)]

    def handler(req, url, q):
        if "/listen-count" in url:
            return 200, {"payload": {"count": n_total}}
        count = int(q.get("count", 25))
        page_size_seen.append(count)
        max_ts = int(q["max_ts"]) if "max_ts" in q else None
        rows = [x for x in all_listens if max_ts is None or x["listened_at"] < max_ts][:count]
        return 200, {"payload": {"count": len(rows), "listens": rows, "user_id": "rob"}}
    return handler


def deezer_item(i, kind):
    it = {"id": 1000 + i, "type": "track", "title": f"Deezer Song {i} (Remastered)", "title_short": f"Deezer Song {i}",
          "duration": 200 + i, "link": f"https://www.deezer.com/track/{1000 + i}",
          "artist": {"id": 5, "name": f"Deezer Artist {i % 3}"}, "album": {"title": "Deezer Album"}}
    it["timestamp" if kind == "history" else "time_add"] = 1_700_000_000 + i
    return it


def yt_video(vid, title, channel, category="10", duration="PT3M30S"):
    return {"id": vid, "snippet": {"title": title, "channelTitle": channel, "categoryId": category,
                                   "publishedAt": "2020-01-01T00:00:00Z"},
            "contentDetails": {"duration": duration}}


def openssl_p8():
    if not shutil.which("openssl"):
        return None
    d = tempfile.mkdtemp()
    key = Path(d) / "AuthKey_TEST.p8"
    r = subprocess.run(["openssl", "genpkey", "-algorithm", "EC", "-pkeyopt", "ec_paramgen_curve:P-256",
                        "-out", str(key)], capture_output=True)
    return key.read_text() if r.returncode == 0 else None


def main():
    print("1. Manager: setup storage, secrecy and validation")
    forget_all()
    check("setup requires the required fields", raises_kind("setup", MANAGER.save_setup, "deezer", {"app_id": "1"}))
    st = MANAGER.save_setup("deezer", {"app_id": "123", "secret": "s3cret"})
    check("setup saved as configured, not connected", st["configured"] and not st["connected"])
    mode = stat.S_IMODE(MANAGER.path.stat().st_mode)
    check("connectors.json is private (0600)", mode == 0o600, oct(mode))
    check("secrets are masked in status", st["config_public"]["secret"] != "s3cret" and st["config_public"]["app_id"] == "123")
    MANAGER.save_setup("deezer", {"app_id": "123"})
    check("blank secret on re-save keeps the stored one", MANAGER.config("deezer").get("secret") == "s3cret")
    MANAGER._store_token("deezer", {"access_token": "t"}, True, account="me")
    MANAGER.save_setup("deezer", {"app_id": "999", "secret": "other"})
    check("new credentials drop the old session", not MANAGER.status("deezer")["connected"])
    check("unknown connector rejected", raises_kind("setup", MANAGER.save_setup, "napster", {}))

    print("2. Manager: sign-in state handling")
    forget_all()
    MANAGER.save_setup("deezer", {"app_id": "123", "secret": "s"})
    check("start without setup is refused", raises_kind("setup", MANAGER.start, "youtube_music", "http://127.0.0.1:8765"))
    started = MANAGER.start("deezer", "http://127.0.0.1:8765", remember=False)
    check("unknown state rejected", raises_kind("auth", MANAGER.finish, "deezer", "nope", code="x"))
    check("state bound to its provider", raises_kind("auth", MANAGER.finish, "youtube_music", started["state"], code="x"))
    s2 = MANAGER.start("deezer", "http://127.0.0.1:8765")
    check("provider-side refusal reported", raises_kind("auth", MANAGER.finish, "deezer", s2["state"], error_text="user_denied"))
    check("state is single-use", MANAGER.pending_for("deezer", s2["state"]) is None)
    s3 = MANAGER.start("deezer", "http://127.0.0.1:8765")
    MANAGER.pending[s3["state"]]["created"] -= base.PENDING_TTL + 5
    check("expired sign-in rejected", raises_kind("auth", MANAGER.finish, "deezer", s3["state"], code="c"))

    print("3. ListenBrainz (public, user name only)")
    forget_all()
    reset_net()
    seen = []
    NET.on("https://api.listenbrainz.org/1/user/rob/", lb_listens(2300, seen))
    NET.on("https://api.listenbrainz.org/1/user/ghost/", lambda r, u, q: (404, {"error": "Cannot find user"}))
    MANAGER.save_setup("listenbrainz", {"username": "ghost"})
    check("unknown user is a setup error", raises_kind("setup", MANAGER.connect_username, "listenbrainz"))
    MANAGER.save_setup("listenbrainz", {"username": "rob"})
    st = MANAGER.connect_username("listenbrainz", remember=True)
    check("connected after the service confirmed the user", st["connected"] and st["account"] == "rob")
    h = MANAGER.fetch("listenbrainz")
    check("paginates with max_ts through all listens", len(h["tracks"]) == 2300, len(h["tracks"]))
    check("never asks for more than 1000 per page", seen and max(seen) <= 1000)
    t0 = h["tracks"][0]
    check("listen normalized (time, album, isrc, source)", t0["played_at"].startswith("2023-11-14") and t0["album_name"] == "Album"
          and t0["isrc"] == "GBAAA0000001" and t0["source"] == "listenbrainz" and t0["source_type"] == "api")
    check("MusicBrainz id kept as raw id when mapped", h["tracks"][1]["raw_id"] == "mbid-1")
    reset_net()
    seen2 = []
    NET.on("https://api.listenbrainz.org/1/user/rob/", lb_listens(9000, seen2))
    check("history capped for speed", len(MANAGER.fetch("listenbrainz")["tracks"]) == 5000)
    user_hdr = [r.get_header("Authorization") for r in NET.calls]
    check("no token sent when none configured", not any(user_hdr))
    NET.on("https://api.listenbrainz.org/1/user/weird%20name/", lb_listens(3, []))
    MANAGER.save_setup("listenbrainz", {"username": "weird name", "user_token": "tok"})
    MANAGER.connect_username("listenbrainz")
    check("user names are URL-escaped", any("weird%20name" in r.full_url for r in NET.calls))
    check("optional user token sent as Token header", NET.calls[-1].get_header("Authorization") == "Token tok")

    print("4. Deezer (OAuth with the user's app)")
    forget_all()
    reset_net()
    MANAGER.save_setup("deezer", {"app_id": "555", "secret": "sec"})
    started = MANAGER.start("deezer", "http://127.0.0.1:8765")
    q = parse_qs(urlsplit(started["redirect"]).query)
    ru = q["redirect_uri"][0]
    check("authorize URL targets Deezer connect", started["redirect"].startswith("https://connect.deezer.com/oauth/auth.php"))
    check("read-only perms incl. history", q["perms"][0] == "basic_access,listening_history,offline_access")
    check("state travels inside the redirect URI", parse_qs(urlsplit(ru).query)["state"][0] == started["state"]
          and ru.startswith("http://127.0.0.1:8765/connect/deezer/callback"))
    NET.on("https://connect.deezer.com/oauth/access_token.php", lambda r, u, q: (200, "wrong code") if q["code"] == "bad"
           else (200, {"access_token": "dz-token", "expires": 0}))
    NET.on("https://api.deezer.com/user/me/history", lambda r, u, q: (200, {"error": {
        "type": "OAuthException", "message": "Invalid OAuth access token.", "code": 300}}) if q["access_token"] != "dz-token" else (200, {
        "data": [deezer_item(i, "history") for i in range(int(q["index"]), min(int(q["index"]) + 100, 150))],
        "total": 150, **({"next": "x"} if int(q["index"]) + 100 < 150 else {})}))
    NET.on("https://api.deezer.com/user/me/tracks", lambda r, u, q: (200, {"data": [deezer_item(i, "fav") for i in range(3)], "total": 3}))
    NET.on("https://api.deezer.com/user/me", lambda r, u, q: (200, {"id": 42, "name": "dz user"}) if q["access_token"] == "dz-token"
           else (200, {"error": {"type": "OAuthException", "message": "Invalid OAuth access token.", "code": 300}}))
    check("non-JSON token answer is an error", raises_kind("provider", MANAGER.finish, "deezer", started["state"], code="bad"))
    started = MANAGER.start("deezer", "http://127.0.0.1:8765")
    st = MANAGER.finish("deezer", started["state"], code="good")
    check("connected with the Deezer account name", st["connected"] and st["account"] == "dz user")
    token_req = [r for r in NET.calls if "access_token.php" in r.full_url][-1]
    check("token exchange uses app id + secret + code", "app_id=555" in token_req.full_url and "secret=sec" in token_req.full_url)
    h = MANAGER.fetch("deezer")
    hist = [t for t in h["tracks"] if t.get("signal") == "recent_play"]
    favs = [t for t in h["tracks"] if t.get("signal") == "saved_library"]
    check("history paginated by index", len(hist) == 150)
    check("favourites marked saved", len(favs) == 3 and all(t["saved"] for t in favs))
    check("short title, artist, ms duration, time", hist[0]["track_name"] == "Deezer Song 0" and hist[0]["duration_ms"] == 200000
          and hist[0]["played_at"].startswith("2023-11-14"))
    MANAGER._store_token("deezer", {"access_token": "revoked"}, True)
    check("Deezer error JSON in a 200 is an auth error", raises_kind("auth", MANAGER.fetch, "deezer"))

    print("5. YouTube Music (Google OAuth, liked music)")
    forget_all()
    reset_net()
    check("topic channel -> artist", (video_to_track(yt_video("a", "Song A", "Band A - Topic")) or {}).get("artist_name") == "Band A")
    t = video_to_track(yt_video("b", "Band B - Hit Song (Official Video)", "BandBVEVO"))
    check("'Artist - Title (Official Video)' parsed and cleaned", t and t["artist_name"] == "Band B" and t["track_name"] == "Hit Song")
    check("non-music likes are skipped", video_to_track(yt_video("c", "Cat video", "Cats", category="15")) is None)
    check("ISO duration parsed", video_to_track(yt_video("d", "X - Y", "Z", duration="PT1H2M3S"))["duration_ms"] == 3723000)
    MANAGER.save_setup("youtube_music", {"client_id": "cid.apps.googleusercontent.com", "client_secret": "gsec"})
    started = MANAGER.start("youtube_music", "http://127.0.0.1:9000", remember=True)
    q = parse_qs(urlsplit(started["redirect"]).query)
    check("Google authorize uses PKCE S256", q["code_challenge_method"][0] == "S256" and len(q["code_challenge"][0]) >= 43)
    check("read-only YouTube scope only", q["scope"][0] == "https://www.googleapis.com/auth/youtube.readonly")
    check("offline access for refresh", q["access_type"][0] == "offline")
    check("loopback redirect on the app's port", q["redirect_uri"][0] == "http://127.0.0.1:9000/connect/youtube_music/callback")
    tokens = {"n": 0}

    def token_ep(req, url, qq):
        tokens["n"] += 1
        if qq.get("grant_type") == "authorization_code":
            ok = qq.get("code_verifier") and qq.get("client_secret") == "gsec"
            return (200, {"access_token": "ya29.a", "refresh_token": "1//r", "expires_in": 3599}) if ok else (400, {"error": "invalid_grant"})
        return 200, {"access_token": "ya29.b", "expires_in": 3599}
    NET.on("https://oauth2.googleapis.com/token", token_ep)
    NET.on("https://www.googleapis.com/youtube/v3/channels", lambda r, u, qq: (200, {"items": [{"snippet": {"title": "My Channel"}}]}))
    pages = {None: ([yt_video(f"v{i}", f"Topic Song {i}", "Artist X - Topic") for i in range(50)], "P2"),
             "P2": ([yt_video("w1", "Artist Y - Deep Cut", "Artist Y"), yt_video("w2", "Vlog", "Me", category="22")], None)}

    def videos(req, url, qq):
        if req.get_header("Authorization") == "Bearer ya29.a" and NET.__dict__.get("expire_a"):
            return 401, {"error": {"code": 401}}
        items, nxt = pages[qq.get("pageToken")]
        return 200, {"items": items, **({"nextPageToken": nxt} if nxt else {})}
    NET.on("https://www.googleapis.com/youtube/v3/videos", videos)
    st = MANAGER.finish("youtube_music", started["state"], code="4/abc")
    check("connected, channel name as account", st["connected"] and st["account"] == "My Channel")
    ex = [r for r in NET.calls if "oauth2.googleapis.com" in r.full_url][0]
    check("code exchange sends the PKCE verifier", "code_verifier=" in ex.data.decode())
    check("refresh token persisted (remember on)", "1//r" in MANAGER.path.read_text())
    h = MANAGER.fetch("youtube_music")
    check("liked music across pages, non-music dropped", len(h["tracks"]) == 51 and h["liked_videos_inspected"] == 52)
    NET.expire_a = True
    h = MANAGER.fetch("youtube_music")
    check("revoked access token -> one refresh, then success", len(h["tracks"]) == 51 and MANAGER.token("youtube_music")["access_token"] == "ya29.b")
    tok = MANAGER.token("youtube_music")
    check("refresh keeps the refresh token", tok.get("refresh_token") == "1//r")
    MANAGER._update("youtube_music", token={**tok, "expires_at": time.time() - 5})
    n_before = tokens["n"]
    MANAGER.fetch("youtube_music")
    check("expired token refreshed before the call", tokens["n"] == n_before + 1)

    print("6. Apple Music (MusicKit + locally signed developer token)")
    forget_all()
    reset_net()
    check("needs a token or the key trio", raises_kind("setup", MANAGER.save_setup, "apple_music", {"team_id": "T"}))
    check("garbage key rejected at setup", raises_kind("setup", MANAGER.save_setup, "apple_music",
                                                        {"team_id": "T", "key_id": "K", "private_key": "not a key"}))
    expired = es256.jwt({"alg": "ES256"}, {"exp": int(time.time()) - 10}, 12345)
    check("expired pasted token rejected", raises_kind("setup", MANAGER.save_setup, "apple_music", {"developer_token": expired}))
    pem = openssl_p8()
    if pem:
        MANAGER.save_setup("apple_music", {"team_id": "ABCDE12345", "key_id": "KEY1234567", "private_key": pem})
        dev = APPLE.developer_token(MANAGER.config("apple_music"))
        hdr = json.loads(__import__("base64").urlsafe_b64decode(dev.split(".")[0] + "=="))
        check("developer token signed locally (ES256, kid)", hdr == {"alg": "ES256", "kid": "KEY1234567"})
        check("token valid for Apple's six-month maximum", es256.jwt_expiry(dev) - time.time() > 15_700_000)
    else:
        check("openssl unavailable: developer-token signing check skipped", True)
        MANAGER.save_setup("apple_music", {"developer_token": es256.jwt({"alg": "ES256"}, {"exp": int(time.time()) + 999}, 12345)})
    started = MANAGER.start("apple_music", "http://127.0.0.1:8765")
    check("MusicKit start returns a state, no redirect", "redirect" not in started and started["state"])
    NET.on("https://api.music.apple.com/v1/me/storefront", lambda r, u, q: (200, {"data": [{"id": "ua", "attributes": {"name": "Ukraine"}}]})
           if r.get_header("Music-user-token") == "mut" else (403, {"errors": []}))

    def song(i, lib=False):
        a = {"name": f"Apple Song {i}", "artistName": f"Apple Artist {i % 4}", "albumName": "Apple Album",
             "durationInMillis": 180000, "genreNames": ["Alternative", "Music"]}
        if lib:
            a.update({"playParams": {"catalogId": f"cat{i}"}, "dateAdded": "2024-05-01T10:00:00Z"})
        else:
            a["isrc"] = f"USAAA00000{i}"
        return {"id": f"{'i.' if lib else ''}{i}", "type": "library-songs" if lib else "songs", "attributes": a}
    NET.on("https://api.music.apple.com/v1/me/recent/played/tracks", lambda r, u, q: (403, {"errors": []})
           if r.get_header("Music-user-token") != "mut" else (200, {"data": [song(i) for i in range(30)],
                                                                   "next": "https://evil.example/steal"}))
    NET.on("https://api.music.apple.com/v1/me/history/heavy-rotation", lambda r, u, q: (200, {"data": [
        {"id": "l.1", "type": "library-albums", "attributes": {"name": "Rotation LP", "artistName": "Heavy Band"}},
        {"id": "pl.1", "type": "playlists", "attributes": {"name": "Some Playlist"}}]}))
    NET.on("https://api.music.apple.com/v1/me/library/songs", lambda r, u, q: (200, {
        "data": [song(i, True) for i in range(int(q.get("offset", 0)), int(q.get("offset", 0)) + 100)] if int(q.get("offset", 0)) < 200 else [],
        **({"next": f"/v1/me/library/songs?offset={int(q.get('offset', 0)) + 100}"} if int(q.get("offset", 0)) < 100 else {})}))
    check("MusicKit refusal reported", raises_kind("auth", MANAGER.finish, "apple_music", started["state"], error_text="cancelled"))
    started = MANAGER.start("apple_music", "http://127.0.0.1:8765", remember=False)
    st = MANAGER.finish("apple_music", started["state"], user_token="mut")
    check("connected after a storefront call proved both tokens", st["connected"] and st["account"] == "Apple Music (Ukraine)")
    check("remember off: user token kept in memory only", "mut" not in MANAGER.path.read_text())
    h = MANAGER.fetch("apple_music")
    sig = [t["signal"] for t in h["tracks"]]
    check("recent plays read; foreign next link not followed", sig.count("recent_play") == 30
          and not any("evil.example" in r.full_url for r in NET.calls))
    check("library paginated via Apple's relative next", sig.count("saved_library") == 200)
    check("heavy-rotation albums kept as album signal only", sig.count("heavy_rotation_album") == 1)
    rp = h["tracks"][0]
    check("genres without the generic 'Music'", rp["genres"] == ["Alternative"] and rp["isrc"] == "USAAA000000")
    lib = [t for t in h["tracks"] if t["signal"] == "saved_library"][0]
    check("library song: catalog id + dateAdded", lib["raw_id"] == "cat0" and lib["saved_at"].startswith("2024-05-01"))
    MANAGER._store_token("apple_music", {"music_user_token": "old"}, False)
    check("expired Music User Token -> reconnect (403)", raises_kind("auth", MANAGER.fetch, "apple_music"))

    print("7. Sources: honest cards, sync, merge, removal")
    forget_all()
    reset_net()
    store = fresh_store()
    cards = {c["id"]: c for c in SRC.provider_cards(store)}
    check("Deezer without setup says REQUIRES_SETUP", cards["deezer"]["badge"] == "REQUIRES_SETUP" and not cards["deezer"]["can_connect"])
    check("setup spec shows the exact redirect URI", cards["deezer"]["setup"]["redirect_domain"] == "http://127.0.0.1:8765"
          and cards["youtube_music"]["setup"]["redirect_uri"].endswith("/connect/youtube_music/callback"))
    check("ListenBrainz can connect with no app", cards["listenbrainz"]["can_connect"] and cards["listenbrainz"]["badge"] == "LIVE_CONNECTION")
    check("services without an API say why", "no play history" in (cards["tidal"]["note"] or "")
          and "no official public API" in (cards["yandex_music"]["note"] or ""))
    check("no card claims connected without a token", not any(c["state"] == "connected" for c in cards.values()))
    NET.on("https://api.listenbrainz.org/1/user/rob/", lb_listens(40, []))
    code, body = call(store, "POST", "sources/listenbrainz/setup", {"fields": {"username": "rob"}})
    check("setup route", code == 200 and body["setup"]["configured"])
    code, body = call(store, "POST", "sources/listenbrainz/connect", {"remember": True})
    check("one-step connect for ListenBrainz", code == 200 and body["connect"]["connected"] and body["connect"]["account"] == "rob")
    code, body = call(store, "POST", "sources/listenbrainz/sync", {})
    check("sync writes a separate live copy", code == 200 and body["sync"]["rows"] == 40 and SRC.live_path(store, "listenbrainz").exists())
    SRC.import_file(store, "deezer", "deezer.csv", b"title,artist\nImported Song,Imported Band\n")
    MANAGER.save_setup("deezer", {"app_id": "1", "secret": "s"})
    MANAGER._store_token("deezer", {"access_token": "dz-token"}, True, account="dz user")
    NET.on("https://api.deezer.com/user/me/history", lambda r, u, q: (200, {"data": [deezer_item(i, "history") for i in range(5)]}))
    NET.on("https://api.deezer.com/user/me/tracks", lambda r, u, q: (200, {"data": []}))
    code, body = call(store, "POST", "sources/deezer/sync", {})
    files = SRC.source_files(store)
    check("live sync never overwrites an imported export", "deezer" in files and "deezer_live" in files)
    cards = {c["id"]: c for c in SRC.provider_cards(store)}
    check("card: connected, account, combined stats", cards["deezer"]["state"] == "connected" and cards["deezer"]["account"] == "dz user"
          and cards["deezer"]["stats"]["rows"] == 6)
    check("live copies count toward the right provider", SRC.canonical_source("deezer_live") == "deezer")
    steps = list(D.build_steps(store))
    done = steps[-1]
    check("DNA builds from live + imported sources", done["step"] == "done", str(done)[:200])
    per = [s["id"] for s in ((done.get("dna") or {}).get("stats") or {}).get("sources", [])]
    deezer_rows = sum(s["rows"] for s in done["dna"]["stats"]["sources"] if s["id"] == "deezer")
    check("DNA lists ListenBrainz and Deezer once each", sorted(per) == ["deezer", "listenbrainz"], per)
    check("Deezer import + live sync counted together", deezer_rows == 6, deezer_rows)
    code, body = call(store, "POST", "sources/deezer/remove", {"confirm": True})
    check("remove deletes imported and live copies", code == 200 and "deezer" not in SRC.source_files(store)
          and "deezer_live" not in SRC.source_files(store))
    code, body = call(store, "POST", "sources/deezer/disconnect", {"confirm": True})
    check("disconnect drops the token", code == 200 and not MANAGER.status("deezer")["connected"])
    code, body = call(store, "POST", "sources/tidal/connect", {})
    check("no fake connect for services without an API", code == 400)
    MANAGER.save_setup("youtube_music", {"client_id": "c", "client_secret": "s"})
    code, body = call(store, "POST", "sources/youtube_music/connect", {"remember": False})
    check("OAuth connect returns the service's sign-in URL", code == 200 and body["connect"]["redirect"].startswith("https://accounts.google.com/"))
    check("pending sign-in remembers the choice", any(p["pid"] == "youtube_music" and p["remember"] is False for p in MANAGER.pending.values()))
    code, body = call(store, "POST", "sources/youtube_music/forget", {})
    check("forget requires confirmation", code == 400)
    code, body = call(store, "POST", "sources/youtube_music/forget", {"confirm": True})
    check("forget clears the setup", code == 200 and not MANAGER.status("youtube_music")["configured"])
    code, body = call(store, "POST", "sources/listenbrainz/sync", {}, headers={"Host": "127.0.0.1:8765"})
    check("sync without the app header is blocked (CSRF)", code == 403)

    print("8. Spotify setup from the UI (no .env editing)")
    import spotify_connector as sc
    try:
        sc.load_config()
        check("Spotify unconfigured at start", False)
    except sc.SpotifyAuthError:
        check("Spotify unconfigured at start", True)
    code, body = call(store, "POST", "sources/spotify/setup", {"fields": {"client_id": "abc123"}}, headers={**H, "Host": "localhost:8790"})
    cid, ru = sc.load_config()
    check("Client ID saved from the form is used", code == 200 and cid == "abc123")
    check("redirect URI matches the port the app runs on", ru == "http://127.0.0.1:8790/spotify/callback")
    code, body = call(store, "POST", "sources/spotify/connect", {"remember": True})
    check("Spotify connect hands off to the PKCE login", body["connect"]["redirect"] == "/spotify/login?next=v3&remember=1")
    os.environ["SPOTIFY_CLIENT_ID"] = "from-env"
    check(".env still wins over the form", sc.load_config()[0] == "from-env")
    os.environ.pop("SPOTIFY_CLIENT_ID")

    print("9. Privacy: forget every connection")
    MANAGER.save_setup("listenbrainz", {"username": "rob"})
    MANAGER.connect_username("listenbrainz")
    code, body = call(store, "GET", "privacy")
    check("privacy inventory shows the credentials file", code == 200 and body["stored"]["connections"]["exists"])
    code, body = call(store, "POST", "privacy/forget_connections", {"confirm": True})
    check("forget_connections clears setups and tokens", code == 200 and not any(
        MANAGER.status(p)["configured"] or MANAGER.status(p)["connected"] for p in connectors.LIVE_IDS)
        and not MANAGER.config("spotify"))
    check("synced data is kept (removal is separate)", SRC.live_path(store, "listenbrainz").exists())

    print("10. HTTP routes in local_interface")
    import local_interface as li
    from http.server import HTTPServer
    li.OUTPUTS = Path(tempfile.mkdtemp())
    srv = HTTPServer(("127.0.0.1", 0), li.Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    port = srv.server_address[1]
    url = f"http://127.0.0.1:{port}"

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *a, **k):
            return None
    opener = urllib.request.build_opener(NoRedirect)

    def get(path, headers=None):
        req = urllib.request.Request(url + path, headers=headers or {})
        try:
            with opener.open(req, timeout=10) as r:
                return r.status, r.read().decode(), dict(r.headers)
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode(), dict(e.headers)

    def post(path, obj, headers=None):
        req = urllib.request.Request(url + path, data=json.dumps(obj).encode(), method="POST",
                                     headers={"Content-Type": "application/json", **(headers or {})})
        try:
            with opener.open(req, timeout=10) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read() or b"{}")
    try:
        forget_all()
        reset_net()
        code, _, hdr = get("/connect/deezer/callback?state=forged&code=x")
        check("forged callback state -> failure redirect", code == 302 and "connect_failed=deezer" in hdr.get("Location", ""))
        MANAGER.save_setup("deezer", {"app_id": "555", "secret": "sec"})
        NET.on("https://connect.deezer.com/oauth/access_token.php", lambda r, u, q: (200, {"access_token": "dz-token", "expires": 0}))
        NET.on("https://api.deezer.com/user/me", lambda r, u, q: (200, {"id": 1, "name": "dz user"}))
        started = MANAGER.start("deezer", url)
        cb = parse_qs(urlsplit(started["redirect"]).query)["redirect_uri"][0]
        code, _, hdr = get(urlsplit(cb).path + "?" + urlsplit(cb).query + "&code=abc")
        check("real callback completes the connection", code == 302 and "connected=deezer" in hdr.get("Location", "")
              and MANAGER.status("deezer")["connected"])
        started = MANAGER.start("deezer", url)
        cb = parse_qs(urlsplit(started["redirect"]).query)["redirect_uri"][0]
        code, _, hdr = get(urlsplit(cb).path + "?" + urlsplit(cb).query + "?code=abc")
        check("callback tolerates '?code=' appended to our query", code == 302 and "connected=deezer" in hdr.get("Location", ""))
        code, _, _ = get("/connect/deezer/callback?state=x", headers={"Host": "evil.example"})
        check("DNS-rebinding guard on /connect", code == 403)
        MANAGER.save_setup("apple_music", {"developer_token": es256.jwt({"alg": "ES256", "kid": "K"}, {"iss": "T", "exp": int(time.time()) + 999}, 777)})
        code, _, hdr = get("/connect/apple_music/start?state=nope")
        check("MusicKit page needs a live sign-in state", code == 302)
        st_apple = MANAGER.start("apple_music", url)["state"]
        code, html, hdr = get(f"/connect/apple_music/start?state={st_apple}")
        csp = hdr.get("Content-Security-Policy", "")
        check("MusicKit page served with Apple-only script allowance", code == 200 and "connect-apple.js" in html
              and "https://js-cdn.music.apple.com" in csp and "'unsafe-eval'" not in csp)
        code, body, _ = get(f"/connect/apple_music/config?state={st_apple}")
        check("config gives the developer token for a live state", code == 200 and json.loads(body)["developer_token"].count(".") == 2)
        check("config refuses unknown states", get("/connect/apple_music/config?state=zzz")[0] == 400)
        code, body = post("/connect/apple_music/token", {"state": st_apple, "music_user_token": "mut"})
        check("token post without the app header blocked", code == 403)
        NET.on("https://api.music.apple.com/v1/me/storefront", lambda r, u, q: (200, {"data": [{"attributes": {"name": "Ukraine"}}]}))
        code, body = post("/connect/apple_music/token", {"state": st_apple, "music_user_token": "mut"}, {"X-MusicDNA-Client": "3"})
        check("MusicKit token completes the connection", code == 200 and body["ok"] and MANAGER.status("apple_music")["connected"])
        code, body = post("/connect/apple_music/token", {"state": st_apple, "music_user_token": "again"}, {"X-MusicDNA-Client": "3"})
        check("MusicKit state can't be replayed", code == 200 and not body["ok"])
        code, body, _ = get("/api/v3/sources")
        cards = {c["id"]: c for c in json.loads(body)["cards"]}
        check("cards over HTTP use the app's real port", cards["youtube_music"]["setup"]["redirect_uri"] ==
              f"http://127.0.0.1:{port}/connect/youtube_music/callback")
    finally:
        srv.shutdown()
        srv.server_close()
        forget_all()

    print(f"\n{len(PASSED)} passed, {len(FAILED)} failed")
    return 0 if not FAILED else 1


if __name__ == "__main__":
    sys.exit(main())
