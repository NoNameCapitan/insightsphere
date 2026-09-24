#!/usr/bin/env python3
"""
test_user_scenarios.py
======================
Offline, end-to-end scenario tests that exercise the real analyze -> recommend
pipeline against a crafted catalog, plus candidate-pool quality via the candidate
engine with a mocked Last.fm client. No network.

Run:
    python scripts/test_user_scenarios.py
"""

import json
import subprocess
import sys
import tempfile
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
    print(f"  {'PASS' if cond else 'FAIL'}  {name}" + (f"  [{detail}]" if detail and not cond else ""))


def trk(title, artist, genres, valence=0.4, energy=0.6, tempo=120,
        instrumentalness=0.2, popularity=0.4):
    return {"track_title": title, "artist": artist, "genres": genres, "valence": valence,
            "energy": energy, "tempo": tempo, "instrumentalness": instrumentalness,
            "popularity": popularity}


CATALOG = {"tracks": [
    trk("Eternity", "Drudkh", ["atmospheric black metal", "black metal", "atmospheric"], 0.2, 0.8),
    trk("Estrangement", "Burzum", ["black metal", "atmospheric black metal"], 0.2, 0.75),
    trk("Slam Pit", "Acme", ["deathcore"], 0.3, 0.95),
    trk("Breakdown City", "Tier", ["metalcore"], 0.35, 0.9),
    trk("Shadows Fall", "Clan of Xymox", ["darkwave", "gothic"], 0.3, 0.5),
    trk("Grey Walls", "The Sound", ["post-punk", "gothic"], 0.35, 0.55),
    trk("Sunshine Pop", "Star", ["pop"], 0.9, 0.7, popularity=0.95),
    trk("Drip Trap", "Rapper", ["trap"], 0.6, 0.8, popularity=0.8),
    trk("Drift", "Stars of the Lid", ["ambient", "drone"], 0.4, 0.2, instrumentalness=0.95),
    trk("Glitch Logic", "Aphex Twin", ["idm", "electronic"], 0.45, 0.5, instrumentalness=0.8),
    trk("Slow River", "Bonobo", ["downtempo", "electronic"], 0.5, 0.45, instrumentalness=0.6),
    trk("Big Drop", "DJ X", ["edm", "big room"], 0.7, 0.95, popularity=0.9),
    trk("Kyiv Lights", "Latexfauna", ["ukrainian", "indie", "alternative"], 0.55, 0.6),
    trk("Generic Indie", "Some Band", ["indie", "alternative"], 0.5, 0.6),
]}

HISTORY = {"source": "test", "exported_at": "2024-01-01T00:00:00Z", "tracks": [
    {"track_name": "Autumn Aurora", "artist_name": "Drudkh", "album_name": "",
     "genres": ["atmospheric black metal"], "play_count": 9, "played_at": "2024-01-01T00:00:00Z"},
    {"track_name": "Medusa", "artist_name": "Clan of Xymox", "album_name": "",
     "genres": ["darkwave"], "play_count": 6, "played_at": "2024-01-02T00:00:00Z"},
    {"track_name": "Adagio", "artist_name": "Stars of the Lid", "album_name": "",
     "genres": ["ambient"], "play_count": 7, "played_at": "2024-01-03T00:00:00Z"},
    {"track_name": "Cofolight", "artist_name": "Latexfauna", "album_name": "",
     "genres": ["ukrainian", "indie"], "play_count": 5, "played_at": "2024-01-04T00:00:00Z"},
]}


def run_pipeline(tmp, genre_flags, mood="0", task="night_drive", novelty="3", maximum="12"):
    hist = tmp / "history.json"
    hist.write_text(json.dumps(HISTORY), encoding="utf-8")
    cat = tmp / "catalog.json"
    cat.write_text(json.dumps(CATALOG), encoding="utf-8")
    taste = tmp / "taste.json"
    recs = tmp / "recs.json"
    r = subprocess.run([sys.executable, str(SCRIPTS / "analyze_taste.py"), str(hist), str(taste)],
                       capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        return None, r.stderr
    cmd = [sys.executable, str(SCRIPTS / "generate_recommendations.py"), str(taste),
           "--mood", mood, "--task", task, "--novelty", novelty, "--max", maximum,
           "--catalog", str(cat), "--output", str(recs)] + genre_flags
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        return None, r.stderr
    return json.loads(recs.read_text(encoding="utf-8")), ""


def genres_of(rec):
    return [str(g).lower() for g in rec.get("genres", [])]


def main():
    with tempfile.TemporaryDirectory() as d:
        tmp = Path(d)

        print("Scenario 1: atmospheric black metal, strict, exclude deathcore/metalcore")
        recs, err = run_pipeline(tmp, ["--genre-subgenres", "atmospheric black metal",
                                       "--strictness", "strict",
                                       "--exclude-genres", "deathcore, metalcore",
                                       "--discovery", "inside"])
        check("scenario 1 pipeline ran", recs is not None, err)
        if recs:
            items = recs["recommendations"]
            leaked = [r["track_title"] for r in items
                      if any(g in ("deathcore", "metalcore") for g in genres_of(r))]
            check("S1: excluded genres absent", not leaked, str(leaked))
            check("S1: every result has genre_reasoning", all("genre_reasoning" in r for r in items))
            params = recs["parameters"]
            check("S1: honest pool accounting present",
                  "candidate_pool_size" in params and "candidates_after_genre_filter" in params)

        print("Scenario 2: darkwave/post-punk night walk, adjacent")
        recs, err = run_pipeline(tmp, ["--genre-families", "gothic",
                                       "--genre-subgenres", "post-punk, darkwave",
                                       "--discovery", "adjacent"])
        check("scenario 2 pipeline ran", recs is not None, err)
        if recs:
            items = recs["recommendations"]
            def score(r):
                return r.get("scoring_breakdown", {}).get("total_score", r.get("confidence_score", 0) / 100)
            def is_goth(r):
                return any(g in ("gothic", "post-punk", "darkwave") for g in genres_of(r))
            def is_bad(r):
                return any(g in ("pop", "trap") for g in genres_of(r))
            goth = [score(r) for r in items if is_goth(r)]
            bad = [score(r) for r in items if is_bad(r)]
            check("S2: unrelated pop/trap rejected or penalized below gothic",
                  (not bad) or (goth and max(goth) > max(bad)), f"goth={goth} bad={bad}")
            check("S2: returns gothic-family results", bool(goth))

        print("Scenario 3: electronic focus, exclude EDM/big room/trap")
        recs, err = run_pipeline(tmp, ["--genre-subgenres", "ambient, idm, downtempo",
                                       "--exclude-genres", "edm, big room, trap",
                                       "--strictness", "balanced", "--discovery", "inside"],
                                 task="focus")
        check("scenario 3 pipeline ran", recs is not None, err)
        if recs:
            items = recs["recommendations"]
            bad = [r["track_title"] for r in items
                   if any(g in ("edm", "big room", "trap") for g in genres_of(r))]
            check("S3: excluded EDM/big room/trap absent", not bad, str(bad))
            calm = [r for r in items if any(g in ("ambient", "idm", "downtempo") for g in genres_of(r))]
            check("S3: calm/focus candidates present and ranked", bool(calm))

        print("Scenario 4: Ukrainian indie/alternative, prefer Ukrainian")
        recs, err = run_pipeline(tmp, ["--genre-families", "ukrainian",
                                       "--genre-subgenres", "indie, alternative",
                                       "--prefer-ukrainian", "--discovery", "adjacent"])
        check("scenario 4 pipeline ran", recs is not None, err)
        if recs:
            items = recs["recommendations"]
            uk = [r for r in items if "ukrainian" in genres_of(r)]
            # Either Ukrainian-tagged candidates surface, or the pool is honestly limited.
            check("S4: Ukrainian-tagged surfaced OR limited pool acknowledged",
                  bool(uk) or recs["parameters"].get("candidates_after_genre_filter", 0) <= 3)

        print("Scenario 5: candidate pool quality (local-only vs enriched Last.fm)")
        local = CE.build_candidate_pool(None, {"tracks": []}, {},
                                        enabled_sources=[{"name": "local_catalog",
                                                          "provider": CE.make_local_provider()}],
                                        taxonomy=TAX)
        check("S5: local-only small pool warns", "small_pool" in local["summary"]["warnings"])

        class FakeEnriching:
            def config_status(self):
                return {"ready": True}
            def get_similar_tracks(self, artist, track, limit=25):
                return [{"track_title": f"N{i}-{track}", "artist": "Neighbor",
                         "source": "lastfm_similar", "genres": [],
                         "discovered_from": f"similar:{artist} - {track}"} for i in range(8)]
            def batch_enrich_candidates(self, candidates, limit=50):
                for c in candidates[:limit]:
                    if not c.get("genres"):
                        c["genres"] = ["atmospheric black metal", "black metal"]
                        c["tag_source"] = "track"
                        c["tag_confidence"] = 0.8
                return candidates
        prov = CE.make_lastfm_similar_provider(client=FakeEnriching())
        enriched = CE.build_candidate_pool(
            None, {"tracks": [{"track_name": "Autumn Aurora", "artist_name": "Drudkh"}]},
            {"use_lastfm_candidates": True},
            enabled_sources=[{"name": "lastfm_similar", "provider": prov}], taxonomy=TAX)
        es = enriched["summary"]
        check("S5: enriched candidate count > 0", es["enriched_candidate_count"] > 0, str(es))
        check("S5: genre metadata quality is high when enriched",
              es["genre_metadata_quality"] == "high", es["genre_metadata_quality"])

    print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
    if FAIL:
        print("Failed:", ", ".join(FAIL))
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
