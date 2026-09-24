#!/usr/bin/env python3
"""
spotify_connector.py
====================
V2 connector: real Spotify OAuth using Authorization Code with PKCE.

Design constraints (kept from V1 architecture):
    - Standard library only. No spotipy, no requests, no dotenv.
    - Output conforms to schemas/listening_history.schema.json.
    - Privacy-first: tokens live in memory by default. Persisting the
      refresh token to disk happens ONLY with explicit user consent
      (--remember flag or the "remember" checkbox in the local UI),
      and the file is written with 0600 permissions.
    - Honest connector states: clear errors, no fake access.

Why PKCE:
    PKCE does not require the client secret, which means no secret has
    to live on the user's machine. Only SPOTIFY_CLIENT_ID is needed.
    (SPOTIFY_CLIENT_SECRET in .env is optional and unused by this flow.)

Setup (one time):
    1. Create an app at https://developer.spotify.com/dashboard
    2. Add the redirect URI from your .env, default:
           http://127.0.0.1:8765/spotify/callback
    3. Put the Client ID into .env as SPOTIFY_CLIENT_ID.
    See SPOTIFY_SETUP.md for a step-by-step guide.

CLI usage:
    python scripts/spotify_connector.py login [--remember]
    python scripts/spotify_connector.py status
    python scripts/spotify_connector.py fetch [--output outputs/spotify_history.json]
    python scripts/spotify_connector.py logout

Scopes requested (read-only):
    user-top-read               -> /me/top/tracks (taste over 3 time ranges)
    user-read-recently-played   -> /me/player/recently-played
"""

import argparse
import base64
import hashlib
import json
import os
import secrets
import socket
import stat
import sys
import threading
import time
import webbrowser
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib import error, parse, request

SCRIPTS = Path(__file__).resolve().parent
ROOT = SCRIPTS.parents[0]
OUTPUTS = ROOT / "outputs"
sys.path.insert(0, str(SCRIPTS))

from env_loader import load_env  # noqa: E402

AUTH_URL = "https://accounts.spotify.com/authorize"
TOKEN_URL = "https://accounts.spotify.com/api/token"
API_BASE = "https://api.spotify.com/v1"
SCOPES = "user-top-read user-read-recently-played user-library-read playlist-read-private playlist-read-collaborative user-follow-read"
DEFAULT_REDIRECT_URI = "http://127.0.0.1:8765/spotify/callback"

# Refresh token storage (opt-in only). 0600 permissions, user home dir.
TOKEN_DIR = Path(os.environ.get("MTR_CONFIG_DIR", Path.home() / ".config" / "music-taste-recommender"))
TOKEN_FILE = TOKEN_DIR / "spotify_tokens.json"


class SpotifyAuthError(RuntimeError):
    pass


# ---------------------------------------------------------------------------
# PKCE helpers
# ---------------------------------------------------------------------------

def generate_pkce_pair() -> tuple[str, str]:
    """Return (code_verifier, code_challenge) per RFC 7636 (S256)."""
    verifier = base64.urlsafe_b64encode(secrets.token_bytes(64)).rstrip(b"=").decode("ascii")
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return verifier, challenge


def build_authorize_url(client_id: str, redirect_uri: str, code_challenge: str, state: str) -> str:
    params = {
        "client_id": client_id,
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "scope": SCOPES,
        "code_challenge_method": "S256",
        "code_challenge": code_challenge,
        "state": state,
    }
    return f"{AUTH_URL}?{parse.urlencode(params)}"


# ---------------------------------------------------------------------------
# Token client
# ---------------------------------------------------------------------------

class SpotifySession:
    """
    Holds OAuth tokens for one connected Spotify account.

    Tokens stay in memory unless `remember=True`, in which case the
    refresh token is persisted to TOKEN_FILE with 0600 permissions.
    """

    def __init__(self, client_id: str, redirect_uri: str, remember: bool = False):
        self.client_id = client_id
        self.redirect_uri = redirect_uri
        self.remember = remember
        self.access_token: str | None = None
        self.refresh_token: str | None = None
        self.expires_at: float = 0.0
        self.display_name: str | None = None

    # -- persistence (opt-in) ------------------------------------------------

    def save(self):
        if not self.remember or not self.refresh_token:
            return
        TOKEN_DIR.mkdir(parents=True, exist_ok=True)
        payload = {
            "refresh_token": self.refresh_token,
            "client_id": self.client_id,
            "display_name": self.display_name,
            "saved_at": datetime.now(timezone.utc).isoformat(),
        }
        TOKEN_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        TOKEN_FILE.chmod(stat.S_IRUSR | stat.S_IWUSR)  # 0600

    @classmethod
    def load_saved(cls, client_id: str, redirect_uri: str) -> "SpotifySession | None":
        if not TOKEN_FILE.exists():
            return None
        try:
            payload = json.loads(TOKEN_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return None
        if payload.get("client_id") != client_id or not payload.get("refresh_token"):
            return None
        session = cls(client_id, redirect_uri, remember=True)
        session.refresh_token = payload["refresh_token"]
        session.display_name = payload.get("display_name")
        return session

    @staticmethod
    def delete_saved() -> bool:
        if TOKEN_FILE.exists():
            TOKEN_FILE.unlink()
            return True
        return False

    # -- token endpoints -----------------------------------------------------

    def _token_request(self, data: dict) -> dict:
        body = parse.urlencode(data).encode("ascii")
        req = request.Request(
            TOKEN_URL,
            data=body,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise SpotifyAuthError(f"Spotify token endpoint returned {exc.code}: {detail}") from exc
        except error.URLError as exc:
            raise SpotifyAuthError(f"Could not reach Spotify token endpoint: {exc.reason}") from exc

    def exchange_code(self, code: str, code_verifier: str):
        payload = self._token_request({
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": self.redirect_uri,
            "client_id": self.client_id,
            "code_verifier": code_verifier,
        })
        self._apply_token_payload(payload)
        self.save()

    def refresh(self):
        if not self.refresh_token:
            raise SpotifyAuthError("No refresh token. Connect Spotify first.")
        payload = self._token_request({
            "grant_type": "refresh_token",
            "refresh_token": self.refresh_token,
            "client_id": self.client_id,
        })
        self._apply_token_payload(payload)
        self.save()

    def _apply_token_payload(self, payload: dict):
        self.access_token = payload.get("access_token")
        if payload.get("refresh_token"):
            self.refresh_token = payload["refresh_token"]
        self.expires_at = time.time() + int(payload.get("expires_in", 3600)) - 60
        if not self.access_token:
            raise SpotifyAuthError(f"Token response missing access_token: {payload}")

    def ensure_access_token(self) -> str:
        if not self.access_token or time.time() >= self.expires_at:
            self.refresh()
        return self.access_token

    @property
    def connected(self) -> bool:
        return bool(self.access_token or self.refresh_token)

    # -- API calls -----------------------------------------------------------

    def api_get(self, path: str, params: dict | None = None) -> dict:
        token = self.ensure_access_token()
        url = f"{API_BASE}{path}"
        if params:
            url += "?" + parse.urlencode(params)
        req = request.Request(url, headers={"Authorization": f"Bearer {token}"})
        try:
            with request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except error.HTTPError as exc:
            if exc.code == 401:
                # Access token expired mid-session: refresh once and retry.
                self.refresh()
                req = request.Request(url, headers={"Authorization": f"Bearer {self.access_token}"})
                with request.urlopen(req, timeout=30) as resp:
                    return json.loads(resp.read().decode("utf-8"))
            if exc.code == 429:
                retry_after = int(exc.headers.get("Retry-After", "2"))
                time.sleep(min(retry_after, 10))
                return self.api_get(path, params)
            detail = exc.read().decode("utf-8", errors="replace")
            raise SpotifyAuthError(f"Spotify API {path} returned {exc.code}: {detail}") from exc

    def fetch_profile(self):
        me = self.api_get("/me")
        self.display_name = me.get("display_name") or me.get("id")
        return self.display_name


# ---------------------------------------------------------------------------
# Login flow (standalone CLI mode: temporary local callback server)
# ---------------------------------------------------------------------------

class _CallbackCapture(BaseHTTPRequestHandler):
    result: dict = {}
    expected_state: str = ""
    callback_path: str = "/callback"

    def do_GET(self):
        parsed = parse.urlsplit(self.path)
        if parsed.path != self.callback_path:
            self.send_response(404)
            self.end_headers()
            return
        qs = parse.parse_qs(parsed.query)
        state = qs.get("state", [""])[0]
        if state != self.expected_state:
            _CallbackCapture.result = {"error": "state_mismatch"}
        elif "error" in qs:
            _CallbackCapture.result = {"error": qs["error"][0]}
        else:
            _CallbackCapture.result = {"code": qs.get("code", [""])[0]}
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        ok = "code" in _CallbackCapture.result
        msg = "Spotify connected. You can close this tab and return to the terminal." if ok \
            else f"Authorization failed: {_CallbackCapture.result.get('error')}"
        self.wfile.write(f"<html><body style='font-family:sans-serif'><h2>{msg}</h2></body></html>".encode("utf-8"))

    def log_message(self, *args):
        return


def run_login_flow(client_id: str, redirect_uri: str, remember: bool, open_browser: bool = True) -> SpotifySession:
    """Full PKCE login using a temporary local HTTP server for the callback."""
    parsed = parse.urlsplit(redirect_uri)
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or 80
    callback_path = parsed.path or "/callback"

    verifier, challenge = generate_pkce_pair()
    state = secrets.token_urlsafe(24)
    auth_url = build_authorize_url(client_id, redirect_uri, challenge, state)

    _CallbackCapture.result = {}
    _CallbackCapture.expected_state = state
    _CallbackCapture.callback_path = callback_path

    try:
        server = HTTPServer((host, port), _CallbackCapture)
    except OSError as exc:
        raise SpotifyAuthError(
            f"Could not bind {host}:{port} for the OAuth callback ({exc}). "
            "If the local UI is running on this port, connect Spotify from the UI instead, "
            "or set a different SPOTIFY_REDIRECT_URI in .env (and in the Spotify dashboard)."
        ) from exc

    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    print("Open this URL to authorize (read-only access to top tracks and recent plays):")
    print(f"  {auth_url}")
    if open_browser:
        webbrowser.open(auth_url)

    deadline = time.time() + 300
    try:
        while not _CallbackCapture.result and time.time() < deadline:
            time.sleep(0.2)
    finally:
        server.shutdown()
        server.server_close()

    if not _CallbackCapture.result:
        raise SpotifyAuthError("Timed out waiting for the Spotify authorization callback (5 minutes).")
    if "error" in _CallbackCapture.result:
        raise SpotifyAuthError(f"Authorization failed: {_CallbackCapture.result['error']}")

    session = SpotifySession(client_id, redirect_uri, remember=remember)
    session.exchange_code(_CallbackCapture.result["code"], verifier)
    session.fetch_profile()
    session.save()
    return session


# ---------------------------------------------------------------------------
# History fetch + normalization to listening_history.schema.json
# ---------------------------------------------------------------------------

def _artist_genre_map(session: SpotifySession, artist_ids: list[str]) -> dict[str, list[str]]:
    """Batch-resolve artist genres via /artists (max 50 ids per call)."""
    genres: dict[str, list[str]] = {}
    unique_ids = [a for a in dict.fromkeys(artist_ids) if a]
    for i in range(0, len(unique_ids), 50):
        batch = unique_ids[i:i + 50]
        data = session.api_get("/artists", {"ids": ",".join(batch)})
        for artist in data.get("artists", []) or []:
            if artist:
                genres[artist["id"]] = [g.lower() for g in artist.get("genres", [])]
    return genres


def _track_record(item: dict, time_range: str | None = None, played_at: str | None = None) -> tuple[dict, str | None]:
    artists = item.get("artists", [])
    primary = artists[0] if artists else {}
    record = {
        "track_name": item.get("name", "Unknown Track"),
        "artist_name": primary.get("name", "Unknown Artist"),
        "album_name": (item.get("album") or {}).get("name", ""),
        "duration_ms": item.get("duration_ms", 0),
    }
    if item.get("id"):
        record["raw_id"] = item["id"]
    if item.get("uri"):
        record["provider_uri"] = item["uri"]
    external_ids = item.get("external_ids") or {}
    if external_ids.get("isrc"):
        record["isrc"] = external_ids["isrc"]
    if time_range:
        record["time_range"] = time_range
    if played_at:
        record["played_at"] = played_at
    return record, primary.get("id")


def _paged_items(session: SpotifySession, path: str, params=None, max_pages=40):
    """Fetch an offset-paginated Spotify collection without following arbitrary URLs."""
    params = dict(params or {})
    params.setdefault("limit", 50)
    offset = int(params.get("offset", 0))
    items = []
    for _ in range(max_pages):
        params["offset"] = offset
        data = session.api_get(path, params)
        page = data.get("items", []) or []
        items.extend(page)
        if not data.get("next") or not page:
            break
        offset += len(page)
    return items


def fetch_listening_history(session: SpotifySession, top_limit: int = 50, recent_limit: int = 50,
                            include_library: bool = True, include_playlists: bool = True,
                            include_followed_artists: bool = True) -> dict:
    """Build a richer Spotify taste history from top/recent/library/playlists/follows."""
    tracks: list[dict] = []
    artist_ids: list[str] = []
    track_artist_idx: list[tuple[int, str | None]] = []
    play_counts: dict[tuple[str, str], int] = {}

    def add_item(item, **markers):
        record, artist_id = _track_record(item, time_range=markers.pop("time_range", None),
                                          played_at=markers.pop("played_at", None))
        record.update(markers)
        track_artist_idx.append((len(tracks), artist_id))
        tracks.append(record)
        if artist_id:
            artist_ids.append(artist_id)
        return record

    for time_range in ("short_term", "medium_term", "long_term"):
        data = session.api_get("/me/top/tracks", {"limit": top_limit, "time_range": time_range})
        for item in data.get("items", []):
            add_item(item, time_range=time_range, signal="top_track")

    recent = session.api_get("/me/player/recently-played", {"limit": recent_limit})
    for entry in recent.get("items", []):
        item = entry.get("track") or {}
        record = add_item(item, played_at=entry.get("played_at"), signal="recent_play")
        key = (record["track_name"], record["artist_name"])
        play_counts[key] = play_counts.get(key, 0) + 1

    if include_library:
        for entry in _paged_items(session, "/me/tracks"):
            item = entry.get("track") or {}
            if item:
                add_item(item, saved_at=entry.get("added_at"), signal="saved_library", saved=True)

    playlist_count = 0
    if include_playlists:
        for playlist in _paged_items(session, "/me/playlists"):
            pid = playlist.get("id")
            if not pid:
                continue
            playlist_count += 1
            pdata = session.api_get(f"/playlists/{pid}")
            pitems = ((pdata.get("tracks") or {}).get("items") or [])
            for entry in pitems:
                item = entry.get("track") or {}
                if item and item.get("type", "track") == "track":
                    add_item(item, signal="playlist", playlist_id=pid,
                             playlist_name=playlist.get("name") or pdata.get("name"))

    followed = []
    if include_followed_artists:
        after = None
        for _ in range(40):
            params = {"type": "artist", "limit": 50}
            if after:
                params["after"] = after
            data = session.api_get("/me/following", params)
            artists_page = (data.get("artists") or {})
            page = artists_page.get("items", []) or []
            followed.extend({"id": a.get("id"), "name": a.get("name"), "genres": a.get("genres", [])} for a in page)
            after = ((artists_page.get("cursors") or {}).get("after"))
            if not artists_page.get("next") or not page or not after:
                break

    genre_map = _artist_genre_map(session, artist_ids)
    for idx, artist_id in track_artist_idx:
        if artist_id and genre_map.get(artist_id):
            tracks[idx]["genres"] = genre_map[artist_id]
        tracks[idx]["source"] = "spotify"
        tracks[idx]["source_type"] = "oauth"
        tracks[idx]["confidence"] = 1.0

    for track in tracks:
        key = (track["track_name"], track["artist_name"])
        if play_counts.get(key, 0) > 1 and track.get("signal") == "recent_play":
            track["play_count"] = play_counts[key]

    return {
        "source": "spotify",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "user_id": session.display_name or "spotify_user",
        "tracks": tracks,
        "followed_artists": followed,
        "source_summary": {
            "top_and_recent": True, "saved_library": include_library,
            "playlists": playlist_count, "followed_artists": len(followed),
        },
    }


# ---------------------------------------------------------------------------
# Candidate catalog from Spotify search (V2.1, optional)
# ---------------------------------------------------------------------------

def _top_counts(values, limit):
    counts: dict[str, int] = {}
    for v in values:
        if v:
            counts[v] = counts.get(v, 0) + 1
    return [v for v, _ in sorted(counts.items(), key=lambda kv: -kv[1])[:limit]]


def build_candidate_catalog(session: SpotifySession, history: dict,
                            max_artists: int = 5, max_genres: int = 5,
                            per_query: int = 10) -> dict:
    """
    Build a candidate catalog by querying Spotify Search with the user's
    top artists and genres from the fetched history. Honest limitations:

    - Spotify's public audio-features endpoint is deprecated for new apps,
      so candidates carry NO valence/energy/tempo numbers. The engine falls
      back to neutral defaults (0.5), which means mood/task matching for
      Spotify candidates is driven mostly by genre signals.
    - This is search, not Spotify's recommendation algorithm. We do not
      claim Spotify-quality recommendations.

    Tracks already present in the user's history are excluded so the
    catalog favors discovery. Read-only; no write scopes.
    """
    tracks_in = history.get("tracks", [])
    known = {(t.get("track_name", "").lower(), t.get("artist_name", "").lower()) for t in tracks_in}
    seed_artists = _top_counts((t.get("artist_name") for t in tracks_in), max_artists)
    seed_genres = _top_counts((g for t in tracks_in for g in t.get("genres", [])), max_genres)

    queries = [f'artist:"{a}"' for a in seed_artists] + [f'genre:"{g}"' for g in seed_genres]
    if not queries:
        raise SpotifyAuthError("Not enough history to build Spotify candidate queries.")

    candidates: dict[tuple, dict] = {}
    artist_ids: list[str] = []
    for q in queries:
        try:
            data = session.api_get("/search", {"q": q, "type": "track", "limit": per_query})
        except SpotifyAuthError:
            continue  # one failed query should not kill the whole catalog
        for item in (data.get("tracks") or {}).get("items", []) or []:
            artists = item.get("artists", [])
            primary = artists[0] if artists else {}
            key = (item.get("name", "").lower(), primary.get("name", "").lower())
            if key in known or key in candidates:
                continue
            candidates[key] = {
                "track_title": item.get("name", "Unknown track"),
                "artist": primary.get("name", "Unknown artist"),
                "genres": [],
                "popularity": round((item.get("popularity") or 50) / 100.0, 2),
                "_artist_id": primary.get("id"),
            }
            if primary.get("id"):
                artist_ids.append(primary["id"])

    if not candidates:
        raise SpotifyAuthError("Spotify search returned no usable candidate tracks.")

    genre_map = _artist_genre_map(session, artist_ids)
    tracks = []
    for cand in candidates.values():
        artist_id = cand.pop("_artist_id", None)
        cand["genres"] = genre_map.get(artist_id, []) if artist_id else []
        tracks.append(cand)

    return {
        "source": "spotify_search",
        "description": (
            "Candidate catalog built from Spotify Search using the user's top "
            f"artists ({', '.join(seed_artists) or '-'}) and genres "
            f"({', '.join(seed_genres) or '-'}). No audio features available "
            "(endpoint deprecated by Spotify), so mood/task matching for these "
            "candidates relies on genre signals."
        ),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "seed_artists": seed_artists,
        "seed_genres": seed_genres,
        "tracks": tracks,
    }


# ---------------------------------------------------------------------------
# Config + CLI
# ---------------------------------------------------------------------------

def load_config() -> tuple[str, str]:
    env = load_env()
    client_id = env.get("SPOTIFY_CLIENT_ID", "").strip()
    redirect_uri = env.get("SPOTIFY_REDIRECT_URI", DEFAULT_REDIRECT_URI).strip() or DEFAULT_REDIRECT_URI
    if not client_id or client_id == "your_spotify_client_id_here":
        raise SpotifyAuthError(
            "SPOTIFY_CLIENT_ID is not configured. Copy .env.example to .env, create an app at "
            "https://developer.spotify.com/dashboard, and paste the Client ID. See SPOTIFY_SETUP.md."
        )
    return client_id, redirect_uri


def cmd_login(args):
    client_id, redirect_uri = load_config()
    session = run_login_flow(client_id, redirect_uri, remember=args.remember, open_browser=not args.no_browser)
    who = session.display_name or "Spotify account"
    print(f"Connected as: {who}")
    if args.remember:
        print(f"Refresh token stored with 0600 permissions at: {TOKEN_FILE}")
    else:
        print("Token kept in memory only for this process. Use --remember to persist, or run `fetch` now:")
        # Without --remember a separate `fetch` invocation cannot reuse the token,
        # so do the fetch immediately in the same process.
        history = fetch_listening_history(session)
        out = OUTPUTS / "spotify_history.json"
        OUTPUTS.mkdir(exist_ok=True)
        out.write_text(json.dumps(history, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Fetched {len(history['tracks'])} tracks -> {out}")


def cmd_status(_args):
    try:
        client_id, redirect_uri = load_config()
    except SpotifyAuthError as exc:
        print(f"Not configured: {exc}")
        return
    saved = SpotifySession.load_saved(client_id, redirect_uri)
    if saved:
        who = saved.display_name or "unknown account"
        print(f"Configured. Saved connection found for: {who} ({TOKEN_FILE})")
    else:
        print("Configured (client ID present). No saved connection. Run: python scripts/spotify_connector.py login")


def cmd_fetch(args):
    client_id, redirect_uri = load_config()
    session = SpotifySession.load_saved(client_id, redirect_uri)
    if session is None:
        raise SpotifyAuthError(
            "No saved Spotify connection. Run `python scripts/spotify_connector.py login --remember` first, "
            "or use `login` without --remember to fetch in one step."
        )
    history = fetch_listening_history(session)
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(history, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Fetched {len(history['tracks'])} tracks -> {out}")


def cmd_logout(_args):
    if SpotifySession.delete_saved():
        print(f"Removed saved Spotify connection: {TOKEN_FILE}")
    else:
        print("No saved Spotify connection found.")
    print("To revoke the app entirely, also remove it at https://www.spotify.com/account/apps/")


def main():
    parser = argparse.ArgumentParser(description="Spotify OAuth connector (V2)")
    sub = parser.add_subparsers(dest="command", required=True)

    p_login = sub.add_parser("login", help="Authorize via Spotify (PKCE)")
    p_login.add_argument("--remember", action="store_true",
                         help="Persist the refresh token to a 0600-permission file (explicit consent)")
    p_login.add_argument("--no-browser", action="store_true", help="Print the URL instead of opening a browser")
    p_login.set_defaults(func=cmd_login)

    p_status = sub.add_parser("status", help="Show connector configuration / connection state")
    p_status.set_defaults(func=cmd_status)

    p_fetch = sub.add_parser("fetch", help="Fetch listening history into normalized JSON")
    p_fetch.add_argument("--output", default=str(OUTPUTS / "spotify_history.json"))
    p_fetch.set_defaults(func=cmd_fetch)

    p_logout = sub.add_parser("logout", help="Delete the saved refresh token")
    p_logout.set_defaults(func=cmd_logout)

    args = parser.parse_args()
    try:
        args.func(args)
    except SpotifyAuthError as exc:
        print(f"Error: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
