#!/usr/bin/env python3
"""
test_candidate_engine.py
========================
Offline tests for the candidate engine. Network providers are mocked via
injected fetch functions (no live API calls). No network.

Run:
    python scripts/test_candidate_engine.py
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))

import candidate_engine as CE

try:
    from genre_taxonomy import load_taxonomy
    TAX = load_taxonomy()
except Exception:
    TAX = None

PASS, FAIL = [], []


def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    mark = "PASS" if cond else "FAIL"
    print(f"  {mark}  {name}" + (f"  [{detail}]" if detail and not cond else ""))


# Mocked remote providers (what a Spotify/Last.fm hook would return).
def mock_spotify_search(profile, history, request):
    return [
        {"track_title": "Mock Spotify Track", "artist": "Mock Artist",
         "genres": ["electronic", "techno"], "valence": 0.4, "energy": 0.8,
         "popularity": 0.5, "source_url": "https://open.spotify.com/track/mock"},
        # duplicate of a local catalog track to exercise dedup:
        {"track_title": "Midnight City", "artist": "M83", "genres": ["synthpop"]},
    ]


def mock_lastfm_similar(profile, history, request):
    return [
        {"name": "Mock Lastfm Track", "artist": "Another Artist",
         "genres": ["ambient"], "discovered_from": "similar:Burial"},
        {"name": "No Genre Track", "artist": "Sparse Artist", "genres": []},
    ]


HISTORY = {"tracks": [
    {"track_name": "Midnight City", "artist_name": "M83"},
    {"track_name": "Strobe", "artist_name": "deadmau5"},
]}


def main():
    print("Candidate engine: local catalog")
    local = CE.build_candidate_pool(None, {"tracks": []}, {},
                                    enabled_sources=[{"name": "local_catalog",
                                                      "provider": CE.make_local_provider()}],
                                    taxonomy=TAX)
    check("local catalog produces candidates", local["summary"]["size"] > 0)
    check("local source attribution present",
          all(c["source"] == "local_catalog" for c in local["candidates"]))
    check("small pool warning for the 46-track demo catalog",
          "small_pool" in local["summary"]["warnings"])

    print("Candidate engine: mocked Spotify + Last.fm providers")
    sources = [
        {"name": "local_catalog", "provider": CE.make_local_provider()},
        {"name": "spotify_search", "provider": CE.make_spotify_search_provider(mock_spotify_search)},
        {"name": "lastfm_similar", "provider": CE.make_lastfm_similar_provider(mock_lastfm_similar)},
    ]
    pool = CE.build_candidate_pool(None, {"tracks": []}, {}, enabled_sources=sources, taxonomy=TAX)
    names = {c["title"] for c in pool["candidates"]}
    srcs = pool["summary"]["sources_used"]
    check("mocked spotify candidates included", "Mock Spotify Track" in names)
    check("mocked lastfm candidates included", "Mock Lastfm Track" in names)
    check("all three sources represented",
          {"local_catalog", "spotify_search", "lastfm_similar"} <= set(srcs), str(srcs))
    check("discovered_from carried through",
          any(c.get("discovered_from") == "similar:Burial" for c in pool["candidates"]))

    print("Candidate engine: inactive (not configured) providers")
    off = CE.build_candidate_pool(None, {"tracks": []}, {}, enabled_sources=[
        {"name": "spotify_search", "provider": CE.make_spotify_search_provider(None)},
        {"name": "lastfm_similar", "provider": CE.make_lastfm_similar_provider(None)},
    ], taxonomy=TAX)
    check("unconfigured remote sources yield nothing (no fakes)", off["summary"]["size"] == 0)

    print("Candidate engine: deduplication")
    # Midnight City appears in local catalog AND mock_spotify_search
    keys = [CE.track_key(c["artist"], c["title"]) for c in pool["candidates"]]
    check("duplicate (M83 - Midnight City) collapsed", keys.count(CE.track_key("M83", "Midnight City")) == 1)

    print("Candidate engine: known-track removal")
    with_known = CE.build_candidate_pool(None, HISTORY, {}, enabled_sources=sources, taxonomy=TAX)
    titles = {c["title"] for c in with_known["candidates"]}
    check("known track removed by default (Midnight City)", "Midnight City" not in titles)
    check("known track removed by default (Strobe)", "Strobe" not in titles)
    incl = CE.build_candidate_pool(None, HISTORY, {"include_familiar": True},
                                   enabled_sources=sources, taxonomy=TAX)
    incl_titles = {c["title"] for c in incl["candidates"]}
    check("include_familiar keeps known tracks", "Midnight City" in incl_titles)

    print("Candidate engine: normalization + confidence + explain")
    sample = pool["candidates"][0]
    check("normalized_genres populated when taxonomy present",
          isinstance(sample["normalized_genres"], list))
    check("matched_taxonomy_paths populated",
          any(c["matched_taxonomy_paths"] for c in pool["candidates"]))
    check("source_confidence attached and ordered (local >= lastfm)",
          all(c["source_confidence"] is not None for c in pool["candidates"]) and
          CE.SOURCE_CONFIDENCE["local_catalog"] > CE.SOURCE_CONFIDENCE["lastfm_similar"])
    check("explain reports sparse-genre count",
          with_known["summary"]["sparse_genre_count"] >= 1)

    print("Candidate engine: catalog passthrough fields for scorer")
    check("candidates keep track_title + audio features",
          all({"track_title", "valence", "energy", "popularity"} <= set(c) for c in pool["candidates"]))

    print("Candidate engine: Last.fm client-based provider (seeded, offline)")
    class FakeLastfm:
        def __init__(self, ready=True):
            self._ready = ready
        def config_status(self):
            return {"ready": self._ready}
        def get_similar_tracks(self, artist, track, limit=25):
            return [{"track_title": f"Similar to {track}", "artist": "Neighbor",
                     "source": "lastfm_similar", "source_url": "u",
                     "discovered_from": f"similar:{artist} - {track}", "genres": ["electronic"]}]
    seed_history = {"tracks": [{"track_name": "Nightcall", "artist_name": "Kavinsky"},
                               {"track_name": "Strobe", "artist_name": "deadmau5"}]}
    prov = CE.make_lastfm_similar_provider(client=FakeLastfm(ready=True))
    pool_lf = CE.build_candidate_pool(None, seed_history, {"lastfm_seed_limit": 2},
                                      enabled_sources=[{"name": "lastfm_similar", "provider": prov}],
                                      taxonomy=TAX)
    titles_lf = {c["title"] for c in pool_lf["candidates"]}
    check("client-based lastfm provider yields seeded candidates",
          any(t.startswith("Similar to") for t in titles_lf), str(sorted(titles_lf)))
    check("lastfm candidates attributed to lastfm_similar",
          all(c["source"] == "lastfm_similar" for c in pool_lf["candidates"]))
    prov_off = CE.make_lastfm_similar_provider(client=FakeLastfm(ready=False))
    pool_off = CE.build_candidate_pool(None, seed_history, {},
                                       enabled_sources=[{"name": "lastfm_similar", "provider": prov_off}])
    check("unconfigured lastfm client yields nothing", pool_off["summary"]["size"] == 0)

    print("Candidate engine: Last.fm tag enrichment + metadata quality")
    class FakeEnrichingLastfm:
        def config_status(self):
            return {"ready": True}
        def get_similar_tracks(self, artist, track, limit=25):
            return [{"track_title": f"Near {track} {i}", "artist": "Neighbor",
                     "source": "lastfm_similar", "genres": [],
                     "discovered_from": f"similar:{artist} - {track}"} for i in range(3)]
        def batch_enrich_candidates(self, candidates, limit=50):
            for c in candidates[:limit]:
                if not c.get("genres"):
                    c["genres"] = ["atmospheric black metal", "black metal"]
                    c["tag_source"] = "track"
                    c["tag_confidence"] = 0.8
            return candidates
    prov_e = CE.make_lastfm_similar_provider(client=FakeEnrichingLastfm())
    pool_e = CE.build_candidate_pool(None, {"tracks": [{"track_name": "Eternity", "artist_name": "Drudkh"}]},
                                     {"use_lastfm_candidates": True},
                                     enabled_sources=[{"name": "lastfm_similar", "provider": prov_e}],
                                     taxonomy=TAX)
    summ = pool_e["summary"]
    check("enriched candidates counted", summ["enriched_candidate_count"] >= 1, str(summ))
    check("tag_sources reports track-level tags", summ["tag_sources"]["track"] >= 1)
    check("enriched pool has matched taxonomy paths",
          any(c["matched_taxonomy_paths"] for c in pool_e["candidates"]))
    check("track-tag candidate confidence beats tagless",
          all(c["source_confidence"] >= 0.6 for c in pool_e["candidates"] if c.get("tag_source") == "track"))

    print("Candidate engine: lastfm_unavailable warning when requested but empty")
    class DeadLastfm:
        def config_status(self):
            return {"ready": True}
        def get_similar_tracks(self, *a, **k):
            return []
    prov_dead = CE.make_lastfm_similar_provider(client=DeadLastfm())
    pool_dead = CE.build_candidate_pool(None, {"tracks": [{"track_name": "X", "artist_name": "Y"}]},
                                        {"use_lastfm_candidates": True},
                                        enabled_sources=[
                                            {"name": "local_catalog", "provider": CE.make_local_provider()},
                                            {"name": "lastfm_similar", "provider": prov_dead}],
                                        taxonomy=TAX)
    check("lastfm_unavailable warning present when no lastfm candidates",
          "lastfm_unavailable" in pool_dead["summary"]["warnings"])

    print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
    if FAIL:
        print("Failed:", ", ".join(FAIL))
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
