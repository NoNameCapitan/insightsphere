#!/usr/bin/env python3
"""
test_lastfm_tag_enrichment.py
=============================
Offline tests for Last.fm tag enrichment + local cache. Network is mocked via an
injected transport; the cache is written to a temp file. No network, no shared state.

Run:
    python scripts/test_lastfm_tag_enrichment.py
"""

import json
import sys
import tempfile
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS))

from lastfm_client import LastfmClient, LastfmError

PASS, FAIL = [], []


def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    print(f"  {'PASS' if cond else 'FAIL'}  {name}" + (f"  [{detail}]" if detail and not cond else ""))


TRACK_TAGS = {"toptags": {"tag": [
    {"name": "atmospheric black metal", "count": 100},
    {"name": "black metal", "count": 80},
    {"name": "atmospheric", "count": 40},
]}}
ARTIST_TAGS = {"toptags": {"tag": [
    {"name": "black metal", "count": 100}, {"name": "ambient", "count": 30}]}}


def route(mapping):
    def transport(params):
        m = params.get("method")
        if m not in mapping:
            raise AssertionError(f"unexpected method {m}")
        val = mapping[m]
        if isinstance(val, Exception):
            raise val
        return val
    return transport


_TMP_DIR = tempfile.mkdtemp(prefix="mtr_tagcache_")
_TMP_N = [0]
import atexit as _atexit
import shutil as _shutil
_atexit.register(lambda: _shutil.rmtree(_TMP_DIR, ignore_errors=True))


def tmp_cache():
    # Unique path inside a dedicated, auto-removed temp dir. Never touches the
    # shared outputs/cache/lastfm_tags_cache.json, so smoke phases stay isolated.
    _TMP_N[0] += 1
    return Path(_TMP_DIR) / f"cache_{_TMP_N[0]}.json"


def main():
    print("Tag enrichment: top tags success")
    c = LastfmClient(api_key="K", transport=route({"track.getTopTags": TRACK_TAGS}),
                     cache_path=tmp_cache())
    tt = c.get_track_top_tags("Drudkh", "Eternity")
    check("track top tags parsed + normalized", tt[:2] == ["atmospheric black metal", "black metal"])
    c2 = LastfmClient(api_key="K", transport=route({"artist.getTopTags": ARTIST_TAGS}),
                      cache_path=tmp_cache())
    check("artist top tags parsed", c2.get_artist_top_tags("Drudkh") == ["black metal", "ambient"])

    print("Tag enrichment: empty / error / invalid JSON")
    c3 = LastfmClient(api_key="K", transport=route({"track.getTopTags": {"toptags": {"tag": []}}}),
                      cache_path=tmp_cache())
    check("empty tags returns []", c3.get_track_top_tags("X", "Y") == [])
    c4 = LastfmClient(api_key="K", transport=route({"track.getTopTags": {"error": 6, "message": "not found"}}),
                      cache_path=tmp_cache())
    check("API error returns [] (no crash)", c4.get_track_top_tags("X", "Y") == [])
    c5 = LastfmClient(api_key="K", transport=route({"track.getTopTags": ValueError("bad json")}),
                      cache_path=tmp_cache())
    check("invalid JSON returns [] (no crash)", c5.get_track_top_tags("X", "Y") == [])
    check("no api key returns [] (no crash)",
          LastfmClient(api_key="", cache_path=tmp_cache()).get_track_top_tags("X", "Y") == [])

    print("Tag enrichment: cache miss then hit")
    cache_file = tmp_cache()
    c6 = LastfmClient(api_key="K", transport=route({"track.getTopTags": TRACK_TAGS}), cache_path=cache_file)
    _ = c6.get_track_top_tags("Drudkh", "Eternity")
    check("cache miss writes cache file", cache_file.exists())
    stored = json.loads(cache_file.read_text())
    check("cache entry has tags + source + confidence",
          any(v.get("source") == "track" and v.get("tags") for v in stored.values()))

    def boom(params):
        raise AssertionError("network must not be called on cache hit")
    c7 = LastfmClient(api_key="K", transport=boom, cache_path=cache_file)
    check("cache hit avoids network", c7.get_track_top_tags("Drudkh", "Eternity")[0] == "atmospheric black metal")

    print("Tag enrichment: candidate enrichment")
    cand = {"track_title": "Eternity", "artist": "Drudkh", "genres": []}
    LastfmClient(api_key="K", transport=route({"track.getTopTags": TRACK_TAGS}),
                 cache_path=tmp_cache()).enrich_track_candidate(cand)
    check("candidate enriched from track tags",
          cand["tag_source"] == "track" and "atmospheric black metal" in cand["genres"])

    cand2 = {"track_title": "Obscure", "artist": "Drudkh", "genres": []}
    LastfmClient(api_key="K", transport=route({
        "track.getTopTags": {"toptags": {"tag": []}}, "artist.getTopTags": ARTIST_TAGS}),
        cache_path=tmp_cache()).enrich_track_candidate(cand2)
    check("candidate falls back to artist tags",
          cand2["tag_source"] == "artist" and cand2["genres"] == ["black metal", "ambient"]
          and "tag_warning" in cand2)

    cand3 = {"track_title": "Z", "artist": "Q", "genres": []}
    LastfmClient(api_key="K", transport=route({"track.getTopTags": TimeoutError("down"),
                                               "artist.getTopTags": TimeoutError("down")}),
                 cache_path=tmp_cache()).enrich_track_candidate(cand3)
    check("enrichment does not crash when Last.fm fails",
          cand3["tag_source"] == "none" and cand3["tag_confidence"] == 0.0)

    cand4 = {"track_title": "Has", "artist": "Tags", "genres": ["techno"]}
    LastfmClient(api_key="K", transport=boom, cache_path=tmp_cache()).enrich_track_candidate(cand4)
    check("already-tagged candidate skips network", cand4["genres"] == ["techno"]
          and cand4["tag_source"] == "existing")

    print("Tag enrichment: bounded batch")
    cands = [{"track_title": f"T{i}", "artist": "A", "genres": []} for i in range(5)]
    LastfmClient(api_key="K", transport=route({"track.getTopTags": TRACK_TAGS}),
                 cache_path=tmp_cache()).batch_enrich_candidates(cands, limit=3)
    enriched = sum(1 for c in cands if c.get("tag_source") == "track")
    check("batch respects limit (<=3 enriched)", enriched <= 3 and enriched >= 1, f"enriched={enriched}")

    print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
    if FAIL:
        print("Failed:", ", ".join(FAIL))
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
