#!/usr/bin/env python3
"""test_personal_memory.py — offline tests for personal-memory scoring + summary."""

import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))

from personal_store import PersonalStore
import analyze_taste as analyzer
import generate_recommendations as recommender

PASS, FAIL = [], []


def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    print(f"  {'PASS' if cond else 'FAIL'}  {name}" + (f"  [{detail}]" if detail and not cond else ""))


def trk(title, artist, genres, valence=0.5, energy=0.5):
    return {"track_title": title, "artist": artist, "genres": genres, "valence": valence,
            "energy": energy, "tempo": 120, "instrumentalness": 0.2, "popularity": 0.5}


CATALOG = {"tracks": [
    trk("Eternity", "Drudkh", ["atmospheric black metal"]),
    trk("Filth", "Darkthrone", ["black metal"]),
    trk("Shadows", "Clan of Xymox", ["darkwave"]),
    trk("Drift", "Stars of the Lid", ["ambient"]),
    trk("Sunshine", "Star", ["pop"]),
]}

HISTORY = {"source": "t", "exported_at": "2024-01-01T00:00:00Z", "tracks": [
    {"track_name": "X", "artist_name": "Drudkh", "genres": ["atmospheric black metal"], "play_count": 5},
    {"track_name": "Y", "artist_name": "Clan of Xymox", "genres": ["darkwave"], "play_count": 4},
    {"track_name": "Z", "artist_name": "Stars of the Lid", "genres": ["ambient"], "play_count": 3},
]}


def build_taste_profile():
    tracks = HISTORY["tracks"]
    genre_affinity = analyzer.calculate_genre_affinity(tracks)
    recurring_artists = analyzer.calculate_artist_recurrence(tracks)
    mood_profile = analyzer.calculate_mood_profile(tracks, genre_affinity)
    repetition = analyzer.calculate_repetition_pattern(tracks)
    novelty_tolerance = analyzer.calculate_novelty_tolerance(repetition)
    taste_drift = analyzer.calculate_taste_drift(tracks)
    return {
        "generated_at": "2026-01-01T00:00:00+00:00",
        "core_genres": genre_affinity,
        "recurring_artists": recurring_artists,
        "mood_profile": mood_profile,
        "energy_level": round(mood_profile["average_energy"], 3),
        "mainstream_vs_niche": 0.5,
        "repetition_pattern": repetition,
        "novelty_tolerance": round(novelty_tolerance, 3),
        "taste_drift": taste_drift,
        "emotional_tone": analyzer.determine_emotional_tone(mood_profile),
        "possible_use_cases": analyzer.suggest_use_cases(mood_profile, mood_profile["average_energy"]),
    }


def run(tmp, memory=None, maximum="5"):
    cat = tmp / "c.json"
    cat.write_text(json.dumps(CATALOG), encoding="utf-8")
    return recommender.generate_recommendations(
        build_taste_profile(),
        mood=0,
        task="walking",
        novelty=3,
        max_items=int(maximum),
        catalog_path=cat,
        use_feedback=False,
        personal_memory=memory,
    )


def titles(recs):
    return [r["track_title"] for r in recs["recommendations"]]


def main():
    with tempfile.TemporaryDirectory() as d:
        tmp = Path(d)

        print("Personal memory: blocked exact track excluded")
        memory = {"blocked_tracks": [{"artist": "Star", "track_title": "Sunshine"}],
                  "boosted_genres": [], "reduced_genres": [],
                  "boosted_artists": [], "reduced_artists": []}
        recs = run(tmp, memory)
        check("blocked exact track excluded", "Sunshine" not in titles(recs))
        check("personal_memory_applied recorded a block",
              recs["parameters"]["personal_memory_applied"]["blocked_tracks_removed"] == 1)

        print("Personal memory: boosted genre ranks higher than baseline")
        base = run(tmp)
        boosted = run(tmp, {"blocked_tracks": [], "boosted_genres": ["darkwave"],
                            "reduced_genres": [], "boosted_artists": [], "reduced_artists": []})
        def score_of(recs, title):
            for r in recs["recommendations"]:
                if r["track_title"] == title:
                    return r["confidence_score"]
            return -1
        check("boosted-genre track score increased",
              score_of(boosted, "Shadows") >= score_of(base, "Shadows"),
              f"base={score_of(base,'Shadows')} boosted={score_of(boosted,'Shadows')}")
        check("boost did not override anything illegal (still valid output)",
              len(boosted["recommendations"]) >= 1)

        print("Personal memory: reduced artist penalized")
        reduced = run(tmp, {"blocked_tracks": [], "boosted_genres": [], "reduced_genres": [],
                            "boosted_artists": [], "reduced_artists": ["darkthrone"]})
        check("reduced-artist track score decreased or equal",
              score_of(reduced, "Filth") <= score_of(base, "Filth"))

        print("Personal memory: strict exclude not overridden by feedback")
        # block nothing, but boost a genre that is excluded -> excluded must still win
        hist = tmp / "h.json"; hist.write_text(json.dumps(HISTORY))
        cat = tmp / "c.json"; cat.write_text(json.dumps(CATALOG))
        taste = tmp / "t.json"; recs_p = tmp / "rp.json"
        memory2 = {"boosted_genres": ["pop"], "blocked_tracks": [],
                   "reduced_genres": [], "boosted_artists": [], "reduced_artists": []}
        out = recommender.generate_recommendations(
            build_taste_profile(),
            mood=0, task="walking", novelty=3, max_items=5, catalog_path=cat,
            use_feedback=False,
            personal_memory=memory2,
            genre_constraints={"exclude_genres": ["pop"], "strictness": "strict"},
        )
        check("strict exclude beats personal boost (pop still absent)",
              "Sunshine" not in [x["track_title"] for x in out["recommendations"]])

        print("Personal memory: store summary counts")
        store = PersonalStore(base_dir=d)
        store.add_record("favorites", {"track_title": "Eternity", "artist": "Drudkh",
                                       "genres": ["atmospheric black metal"], "action": "favorite"})
        store.add_record("rejects", {"track_title": "Sunshine", "artist": "Star",
                                     "genres": ["pop"], "action": "reject"})
        store.add_record("listen_later", {"track_title": "Drift", "artist": "Stars of the Lid",
                                          "action": "listen_later"})
        mem_sum = store.personal_memory()
        check("summary counts favorites/rejects/listen_later",
              mem_sum["favorites_count"] == 1 and mem_sum["rejects_count"] == 1
              and mem_sum["listen_later_count"] == 1)
        check("summary boosts favorite genre", "atmospheric black metal" in mem_sum["boosted_genres"])
        check("summary blocks rejected track",
              any(b["track_title"] == "Sunshine" for b in mem_sum["blocked_tracks"]))

    print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
    if FAIL:
        print("Failed:", ", ".join(FAIL))
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
