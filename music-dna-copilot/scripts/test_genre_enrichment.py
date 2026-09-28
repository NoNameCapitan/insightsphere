#!/usr/bin/env python3
"""
test_genre_enrichment.py
========================
Offline tests for scripts/enrich_genres.py — the bridge between multi-source
imports (tagless YouTube Takeout rows) and the deep genre engine.
No network: Last.fm is a fake client. Run:

    python scripts/test_genre_enrichment.py
"""

import copy
import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
ROOT = SCRIPTS.parent
sys.path.insert(0, str(SCRIPTS))

import enrich_genres as eg  # noqa: E402
import import_youtube_takeout as yt  # noqa: E402
import merge_listening_sources as merger  # noqa: E402

PASS, FAIL = [], []


def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    print(f"  {'PASS' if cond else 'FAIL'}  {name}" + (f"  [{detail}]" if detail and not cond else ""))


class FakeLastfm:
    def __init__(self, tags):
        self.tags = tags
        self.calls = []

    def get_artist_top_tags(self, artist, limit=10, use_cache=True):
        self.calls.append(artist)
        return self.tags.get(artist, [])


def main():
    print("same-artist propagation")
    h = {"tracks": [
        {"track_name": "A", "artist_name": "Kavinsky", "genres": ["synthwave"]},
        {"track_name": "B", "artist_name": "kavinsky ", "genres": []},
    ]}
    h, st = eg.enrich_history(h, offline_map={})
    b = h["tracks"][1]
    check("tagless row got artist genres", b["genres"] == ["synthwave"], b.get("genres"))
    check("marked inferred + origin", b.get("genres_inferred") is True and b.get("genre_source") == "same_artist")
    check("stats counted", st["filled"] == 1 and st["same_artist"] == 1, st)
    check("original row untouched", "genres_inferred" not in h["tracks"][0])

    print("offline map")
    omap = eg.load_offline_map()
    check("offline map built from examples", len(omap) >= 10, len(omap))
    check("seed file extends the offline map", "boards of canada" in omap)
    h = {"tracks": [{"track_name": "X", "artist_name": "Unknown Artist 123"}]}
    h, st = eg.enrich_history(h, offline_map=omap)
    check("unknown artist left unresolved (no fake genres)",
          not h["tracks"][0].get("genres") and st["unresolved_artists"] == ["Unknown Artist 123"])

    print("Last.fm tags (fake client)")
    fake = FakeLastfm({"Drudkh": ["black metal", "seen live", "atmospheric black metal", "2000s"]})
    h = {"tracks": [{"track_name": "E", "artist_name": "Drudkh"},
                    {"track_name": "F", "artist_name": "Drudkh"}]}
    h, st = eg.enrich_history(h, lastfm_client=fake, offline_map={})
    g = h["tracks"][0].get("genres", [])
    check("non-genre tags dropped", "seen live" not in g and "2000s" not in g, g)
    check("genre tags kept", "black metal" in g, g)
    check("one lookup per artist", fake.calls == ["Drudkh"], fake.calls)
    check("origin lastfm_tags", h["tracks"][1].get("genre_source") == "lastfm_tags")

    fake = FakeLastfm({})
    h = {"tracks": [{"track_name": str(i), "artist_name": f"Art{i}"} for i in range(10)]}
    h, st = eg.enrich_history(h, lastfm_client=fake, offline_map={}, max_lastfm_lookups=3)
    check("lookup cap respected", len(fake.calls) == 3, len(fake.calls))

    class Boom:
        def get_artist_top_tags(self, *a, **k):
            raise RuntimeError("network down")
    h = {"tracks": [{"track_name": "Z", "artist_name": "Nobody"}]}
    h, st = eg.enrich_history(h, lastfm_client=Boom(), offline_map={})
    check("Last.fm failure never crashes", st["filled"] == 0)

    print("real Takeout + merge flow")
    takeout = yt.import_takeout(ROOT / "examples" / "sample_youtube_takeout_history.json")
    before = sum(1 for t in takeout["tracks"] if not t.get("genres"))
    enriched, st = eg.enrich_history(copy.deepcopy(takeout))
    check("takeout rows start tagless", before == len(takeout["tracks"]), before)
    check("takeout rows enriched offline", st["filled"] >= 2, st)
    check("history carries enrichment summary", enriched.get("enrichment", {}).get("genres", {}).get("filled") == st["filled"])

    merged = merger.merge_histories([takeout, {"source": "spotify", "tracks": [
        {"track_name": "Other", "artist_name": "Kavinsky", "genres": ["synthwave", "electronic"],
         "source": "spotify"}]}])
    merged = {"source": "merged", "tracks": merged}
    merged, st = eg.enrich_history(merged, offline_map={})
    kav = [t for t in merged["tracks"] if t["artist_name"] == "Kavinsky"]
    check("merged: Spotify genres flow to Takeout rows", all(t.get("genres") for t in kav), kav)

    print("no-op")
    h = {"tracks": [{"track_name": "A", "artist_name": "B", "genres": ["rock"]}]}
    h, st = eg.enrich_history(h)
    check("nothing to do when all tagged", st["missing"] == 0 and st["filled"] == 0)

    print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
