#!/usr/bin/env python3
"""
test_spotify_connector.py
=========================
Offline tests for the V2 Spotify connector. No network access required:
Spotify API calls are mocked. Run:

    python scripts/test_spotify_connector.py
"""

import base64
import hashlib
import json
import os
import stat
import sys
import tempfile
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
ROOT = SCRIPTS.parents[0]
sys.path.insert(0, str(SCRIPTS))

# Isolate token storage before importing the connector.
_tmp_config = tempfile.mkdtemp(prefix="mtr_test_")
os.environ["MTR_CONFIG_DIR"] = _tmp_config

import spotify_connector as sc  # noqa: E402
from env_loader import load_env  # noqa: E402

PASS = 0
FAIL = 0


def check(name, condition, detail=""):
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  PASS  {name}")
    else:
        FAIL += 1
        print(f"  FAIL  {name}  {detail}")


# --- PKCE -------------------------------------------------------------------
print("PKCE")
verifier, challenge = sc.generate_pkce_pair()
expected = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
check("challenge is S256(verifier)", challenge == expected)
check("verifier length 43-128", 43 <= len(verifier) <= 128, f"len={len(verifier)}")
check("no padding chars", "=" not in verifier and "=" not in challenge)
v2, _ = sc.generate_pkce_pair()
check("verifiers are unique", v2 != verifier)

url = sc.build_authorize_url("client123", "http://127.0.0.1:8765/spotify/callback", challenge, "state123")
check("authorize URL has PKCE params",
      "code_challenge_method=S256" in url and "client_id=client123" in url and "state=state123" in url)
check("authorize URL requests read-only scopes",
      "user-top-read" in url and "user-read-recently-played" in url)

# --- env loader ---------------------------------------------------------------
print("env loader")
with tempfile.NamedTemporaryFile("w", suffix=".env", delete=False) as f:
    f.write("# comment\nSPOTIFY_CLIENT_ID=abc123\nQUOTED='hello'\nEMPTY=\n")
    env_path = Path(f.name)
env = load_env(env_path)
check("reads KEY=VALUE", env.get("SPOTIFY_CLIENT_ID") == "abc123")
check("strips quotes", env.get("QUOTED") == "hello")
os.environ["SPOTIFY_CLIENT_ID"] = "override"
env = load_env(env_path)
check("os.environ overrides file", env.get("SPOTIFY_CLIENT_ID") == "override")
del os.environ["SPOTIFY_CLIENT_ID"]
env_path.unlink()

# --- token store (opt-in persistence) ----------------------------------------
print("token store")
session = sc.SpotifySession("client123", "http://127.0.0.1:8765/spotify/callback", remember=False)
session.refresh_token = "rt_secret"
session.save()
check("no file written without --remember", not sc.TOKEN_FILE.exists())

session.remember = True
session.display_name = "Test User"
session.save()
check("file written with --remember", sc.TOKEN_FILE.exists())
mode = stat.S_IMODE(sc.TOKEN_FILE.stat().st_mode)
check("file permissions are 0600", mode == 0o600, oct(mode))

loaded = sc.SpotifySession.load_saved("client123", "http://127.0.0.1:8765/spotify/callback")
check("saved session loads", loaded is not None and loaded.refresh_token == "rt_secret")
check("client_id mismatch rejected",
      sc.SpotifySession.load_saved("other_client", "http://127.0.0.1:8765/spotify/callback") is None)
check("delete_saved removes file", sc.SpotifySession.delete_saved() and not sc.TOKEN_FILE.exists())

# --- normalization with mocked API --------------------------------------------
print("history normalization (mocked API)")

MOCK_TOP = {
    "short_term": {"items": [
        {"name": "Nightcall", "artists": [{"name": "Kavinsky", "id": "a1"}],
         "album": {"name": "OutRun"}, "duration_ms": 258000},
    ]},
    "medium_term": {"items": [
        {"name": "Midnight City", "artists": [{"name": "M83", "id": "a2"}],
         "album": {"name": "Hurry Up, We're Dreaming"}, "duration_ms": 243000},
    ]},
    "long_term": {"items": []},
}
MOCK_RECENT = {"items": [
    {"track": {"name": "Nightcall", "artists": [{"name": "Kavinsky", "id": "a1"}],
               "album": {"name": "OutRun"}, "duration_ms": 258000},
     "played_at": "2026-06-10T08:00:00Z"},
    {"track": {"name": "Nightcall", "artists": [{"name": "Kavinsky", "id": "a1"}],
               "album": {"name": "OutRun"}, "duration_ms": 258000},
     "played_at": "2026-06-09T22:10:00Z"},
]}
MOCK_ARTISTS = {"artists": [
    {"id": "a1", "genres": ["Synthwave", "Electro"]},
    {"id": "a2", "genres": ["indietronica"]},
]}


class MockSession(sc.SpotifySession):
    def __init__(self):
        super().__init__("client123", "http://127.0.0.1:8765/spotify/callback")
        self.display_name = "Test User"
        self.calls = []

    def api_get(self, path, params=None):
        self.calls.append((path, params))
        if path == "/me/top/tracks":
            return MOCK_TOP[params["time_range"]]
        if path == "/me/player/recently-played":
            return MOCK_RECENT
        if path == "/artists":
            return MOCK_ARTISTS
        raise AssertionError(f"unexpected path {path}")


mock = MockSession()
history = sc.fetch_listening_history(mock, include_library=False, include_playlists=False, include_followed_artists=False)

check("source is spotify", history["source"] == "spotify")
check("exported_at present", bool(history.get("exported_at")))
check("user_id from profile", history["user_id"] == "Test User")
check("tracks collected from top + recent", len(history["tracks"]) == 4, f"got {len(history['tracks'])}")

by_name = {}
for t in history["tracks"]:
    by_name.setdefault(t["track_name"], []).append(t)

nightcall_top = [t for t in by_name["Nightcall"] if t.get("time_range") == "short_term"][0]
check("time_range tagged on top tracks", nightcall_top["time_range"] == "short_term")
check("genres resolved + lowercased", nightcall_top.get("genres") == ["synthwave", "electro"])
recent_nightcalls = [t for t in by_name["Nightcall"] if t.get("played_at")]
check("played_at on recent plays", all(t.get("played_at") for t in recent_nightcalls))
check("repeat recent plays aggregated into play_count",
      all(t.get("play_count") == 2 for t in recent_nightcalls))

# schema required keys
required_ok = all("track_name" in t and "artist_name" in t for t in history["tracks"])
check("all tracks have required schema fields", required_ok)

# batching: only one /artists call for 2 unique ids
artist_calls = [c for c in mock.calls if c[0] == "/artists"]
check("artist genres fetched in one batch", len(artist_calls) == 1)

# --- end-to-end into existing pipeline ----------------------------------------
print("pipeline compatibility")
import subprocess
with tempfile.TemporaryDirectory() as td:
    hist_path = Path(td) / "spotify_history.json"
    taste_path = Path(td) / "taste.json"
    recs_path = Path(td) / "recs.json"
    hist_path.write_text(json.dumps(history, indent=2), encoding="utf-8")
    r1 = subprocess.run([sys.executable, str(SCRIPTS / "analyze_taste.py"), str(hist_path), str(taste_path)],
                        cwd=ROOT, capture_output=True, text=True)
    check("analyze_taste accepts connector output", r1.returncode == 0, r1.stderr[-300:])
    r2 = subprocess.run([sys.executable, str(SCRIPTS / "generate_recommendations.py"), str(taste_path),
                         "--mood", "1", "--task", "night_drive", "--novelty", "4",
                         "--catalog", str(ROOT / "examples" / "sample_candidate_catalog.json"),
                         "--output", str(recs_path)],
                        cwd=ROOT, capture_output=True, text=True)
    check("generate_recommendations accepts the profile", r2.returncode == 0, r2.stderr[-300:])
    if r2.returncode == 0:
        recs = json.loads(recs_path.read_text(encoding="utf-8"))
        check("recommendations produced", len(recs.get("recommendations", [])) > 0)

print(f"\n{PASS} passed, {FAIL} failed")
sys.exit(1 if FAIL else 0)
