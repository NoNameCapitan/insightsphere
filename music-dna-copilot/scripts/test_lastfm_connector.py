#!/usr/bin/env python3
"""
test_lastfm_connector.py
========================
Offline tests for the Last.fm client. All network calls are mocked via an
injected transport; nothing touches the network.

Run:
    python scripts/test_lastfm_connector.py
"""

import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS))

from lastfm_client import LastfmClient, LastfmError

PASS, FAIL = [], []


def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    mark = "PASS" if cond else "FAIL"
    print(f"  {mark}  {name}" + (f"  [{detail}]" if detail and not cond else ""))


# ---- canned API responses, keyed by method --------------------------------
RECENT = {"recenttracks": {"track": [
    {"name": "Nightcall", "artist": {"#text": "Kavinsky"}, "album": {"#text": "OutRun"},
     "url": "https://last.fm/x", "mbid": "abc",
     "date": {"uts": "1700000000", "#text": "14 Nov 2023"}},
    {"name": "Now Playing", "artist": {"#text": "Someone"}, "album": {"#text": ""},
     "@attr": {"nowplaying": "true"}, "url": "https://last.fm/y"},
], "@attr": {"user": "tester"}}}

TOP_TRACKS = {"toptracks": {"track": [
    {"name": "Strobe", "artist": {"name": "deadmau5"}, "playcount": "42", "url": "u1"},
    {"name": "Opus", "artist": {"name": "Eric Prydz"}, "playcount": "20", "url": "u2"},
]}}

TOP_ARTISTS = {"topartists": {"artist": [
    {"name": "Burial", "playcount": "120", "url": "a1"},
    {"name": "Boards of Canada", "playcount": "90", "url": "a2"},
]}}

SIMILAR_TRACKS = {"similartracks": {"track": [
    {"name": "Tewlve", "artist": {"name": "Kavinsky"}, "url": "s1", "match": "0.9"},
    {"name": "Wrong", "artist": {"name": "Depeche Mode"}, "url": "s2", "match": "0.4"},
]}}

SIMILAR_ARTISTS = {"similarartists": {"artist": [
    {"name": "College", "url": "sa1", "match": "0.8"},
    {"name": "Lifelike", "url": "sa2", "match": "0.6"},
]}}

ERROR_RESP = {"error": 6, "message": "User not found"}


def make_transport(routes):
    def transport(params):
        method = params.get("method")
        if method not in routes:
            raise AssertionError(f"unexpected method {method}")
        return routes[method]
    return transport


def main():
    print("Last.fm: config status")
    no_key = LastfmClient(api_key="", username="")
    st = no_key.config_status()
    check("missing api key -> not ready", st["ready"] is False and not st["api_key_present"])
    check("missing api key -> helpful message", "LASTFM_API_KEY" in st["message"])
    ready = LastfmClient(api_key="KEY", username="tester")
    check("api key + username -> ready", ready.config_status()["ready"] is True)

    print("Last.fm: missing config never crashes (raises clean error)")
    try:
        no_key.get_recent_tracks(); ok = False
    except LastfmError:
        ok = True
    check("recent tracks without api key raises LastfmError", ok)
    try:
        LastfmClient(api_key="KEY", username="").get_recent_tracks(); ok = False
    except LastfmError:
        ok = True
    check("recent tracks without username raises LastfmError", ok)

    print("Last.fm: recent tracks normalization")
    c = LastfmClient(api_key="KEY", username="tester",
                     transport=make_transport({"user.getRecentTracks": RECENT}))
    hist = c.get_recent_tracks()
    check("history source is lastfm", hist["source"] == "lastfm")
    check("history has username", hist["username"] == "tester")
    t0 = hist["tracks"][0]
    check("track normalized fields present",
          {"track_name", "artist_name", "album_name", "played_at", "play_count",
           "source", "source_url", "import_confidence"} <= set(t0))
    check("scrobble time parsed to ISO", isinstance(t0["played_at"], str) and "2023" in t0["played_at"])
    check("now-playing track has no played_at",
          hist["tracks"][1]["played_at"] is None)

    print("Last.fm: top tracks / artists")
    c2 = LastfmClient(api_key="KEY", username="tester", transport=make_transport({
        "user.getTopTracks": TOP_TRACKS, "user.getTopArtists": TOP_ARTISTS}))
    tt = c2.get_top_tracks()
    check("top tracks carry play_count", tt[0]["play_count"] == 42 and tt[0]["track_name"] == "Strobe")
    ta = c2.get_top_artists()
    check("top artists normalized", ta[0]["artist_name"] == "Burial" and ta[0]["play_count"] == 120)

    print("Last.fm: similar tracks / artists (candidate seeds)")
    c3 = LastfmClient(api_key="KEY", transport=make_transport({"track.getSimilar": SIMILAR_TRACKS}))
    sim = c3.get_similar_tracks("Kavinsky", "Nightcall", limit=10)
    check("similar tracks normalized as candidates",
          sim[0]["source"] == "lastfm_similar" and sim[0]["track_title"] == "Tewlve")
    check("similar tracks carry discovered_from",
          sim[0]["discovered_from"] == "similar:Kavinsky - Nightcall")
    c4 = LastfmClient(api_key="KEY", transport=make_transport({"artist.getSimilar": SIMILAR_ARTISTS}))
    sa = c4.get_similar_artists("Kavinsky")
    check("similar artists normalized", sa[0]["artist"] == "College" and sa[0]["source"] == "lastfm_similar")

    print("Last.fm: error + empty handling")
    cerr = LastfmClient(api_key="KEY", username="ghost",
                        transport=make_transport({"user.getRecentTracks": ERROR_RESP}))
    try:
        cerr.get_recent_tracks(); ok = False
    except LastfmError as e:
        ok = "User not found" in str(e)
    check("Last.fm API error response raises LastfmError", ok)

    def boom(params):
        raise TimeoutError("connection timed out")
    cto = LastfmClient(api_key="KEY", username="t", transport=boom)
    try:
        cto.get_recent_tracks(); ok = False
    except LastfmError:
        ok = True
    check("network failure wrapped as LastfmError (no crash)", ok)

    cempty = LastfmClient(api_key="KEY", username="t",
                          transport=make_transport({"user.getRecentTracks": {"recenttracks": {"track": []}}}))
    check("empty recent tracks returns empty list cleanly", cempty.get_recent_tracks()["tracks"] == [])
    csim_empty = LastfmClient(api_key="KEY", transport=make_transport({"track.getSimilar": {"similartracks": {}}}))
    check("empty similar tracks returns []", csim_empty.get_similar_tracks("a", "b") == [])

    print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
    if FAIL:
        print("Failed:", ", ".join(FAIL))
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
