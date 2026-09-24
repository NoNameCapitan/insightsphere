#!/usr/bin/env python3
"""
test_deep_genre_recommendations.py
==================================
Offline tests that deep-genre constraints actually shape recommendation output:
strict filtering, exclusion, adjacency, reasoning fields, and backward
compatibility when no constraints are supplied. No network.

Run:
    python scripts/test_deep_genre_recommendations.py
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))

import json
import generate_recommendations as G

PASS, FAIL = [], []


def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    mark = "PASS" if cond else "FAIL"
    print(f"  {mark}  {name}" + (f"  [{detail}]" if detail and not cond else ""))


def build_taste():
    """Build a real taste profile from the bundled sample history."""
    import analyze_taste as A
    hist = json.loads((ROOT / "examples" / "sample_listening_history.json").read_text(encoding="utf-8"))
    tracks = hist["tracks"]
    genre_affinity = A.calculate_genre_affinity(tracks)
    return {
        "generated_at": "test",
        "core_genres": genre_affinity,
        "recurring_artists": A.calculate_artist_recurrence(tracks),
        "mood_profile": A.calculate_mood_profile(tracks, genre_affinity),
        "energy_level": 0.5,
        "novelty_tolerance": 0.5,
        "taste_drift": A.calculate_taste_drift(tracks),
        "emotional_tone": "balanced",
    }


CATALOG = str(ROOT / "examples" / "sample_candidate_catalog.json")


def recs(genre_constraints=None, mood=0, task="focus", novelty=3, max_items=12):
    taste = build_taste()
    return G.generate_recommendations(taste, mood, task, novelty, max_items, CATALOG,
                                      use_feedback=False, genre_constraints=genre_constraints)


def main():
    tax = G.get_taxonomy()
    if tax is None:
        print("  FAIL  taxonomy could not be loaded")
        sys.exit(1)

    print("Deep genre: backward compatibility")
    base = recs(None)
    check("no constraints -> recommendations produced", len(base["recommendations"]) > 0)
    check("no constraints -> no genre_constraints in parameters",
          "genre_constraints" not in base["parameters"])
    check("no constraints -> no genre_reasoning on items",
          all("genre_reasoning" not in r for r in base["recommendations"]))
    check("scoring_breakdown always present",
          all("scoring_breakdown" in r for r in base["recommendations"]))

    print("Deep genre: strict mode filters unrelated tracks")
    strict = recs({"selected_families": ["electronic"], "strictness": "strict",
                   "discovery_direction": "inside"})
    p = strict["parameters"]
    check("strict reduces the candidate pool",
          p["candidates_after_genre_filter"] < p["candidate_pool_size"],
          f"{p['candidates_after_genre_filter']}/{p['candidate_pool_size']}")
    # every surviving recommendation must be within the electronic subtree (distance 0)
    target = tax.expand_selection(["electronic"])
    all_in = all(
        any(tax.normalize(g) in target for g in r["genres"])
        for r in strict["recommendations"])
    check("strict: every recommendation matches the selected genre tree", all_in)
    check("strict: genre_reasoning marks results as passed_strict",
          all(r.get("genre_reasoning", {}).get("strictness_result") == "passed_strict"
              for r in strict["recommendations"]))

    print("Deep genre: exclusion")
    excl = recs({"exclude_genres": ["electronic"]})
    leaked = [r["track_title"] for r in excl["recommendations"]
              if any(str(g).lower() == "electronic" for g in r["genres"])]
    check("excluded genre never appears in recommendations", not leaked, str(leaked[:3]))
    check("exclusion reports filtered_out count",
          excl["parameters"].get("genre_filtered_out", 0) > 0)

    print("Deep genre: adjacency vs inside")
    inside = recs({"selected_families": ["ambient"], "strictness": "strict",
                   "discovery_direction": "inside"})
    adjacent = recs({"selected_families": ["ambient"], "strictness": "strict",
                     "discovery_direction": "adjacent"})
    check("adjacent keeps >= inside (related genres allowed)",
          adjacent["parameters"]["candidates_after_genre_filter"]
          >= inside["parameters"]["candidates_after_genre_filter"])
    adj_dists = {r.get("genre_reasoning", {}).get("taxonomy_distance")
                 for r in adjacent["recommendations"]}
    check("adjacent excludes distant/unrelated (max distance <= 0.5)",
          all((d is None or d <= 0.5) for d in adj_dists), str(sorted(d for d in adj_dists if d is not None)))

    print("Deep genre: reasoning + scoring fields")
    soft = recs({"selected_families": ["electronic"], "strictness": "soft"})
    sample = soft["recommendations"][0]
    gr = sample.get("genre_reasoning", {})
    sb = sample.get("scoring_breakdown", {})
    check("genre_reasoning has required keys",
          {"matched_selected_genres", "taxonomy_distance", "strictness_result",
           "why_it_matches_genre_request"} <= set(gr.keys()))
    check("scoring_breakdown has genre components",
          {"user_genre_affinity_score", "requested_genre_match_score",
           "taxonomy_distance_score", "total_score"} <= set(sb.keys()))

    print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
    if FAIL:
        print("Failed:", ", ".join(FAIL))
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
