#!/usr/bin/env python3
"""
test_genre_taxonomy.py
======================
Offline tests for the deep genre taxonomy and its operations. No network.

Run:
    python scripts/test_genre_taxonomy.py
"""

import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS))

from genre_taxonomy import load_taxonomy

PASS, FAIL = [], []


def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    mark = "PASS" if cond else "FAIL"
    print(f"  {mark}  {name}" + (f"  [{detail}]" if detail and not cond else ""))


def main():
    tax = load_taxonomy()

    print("Taxonomy: structure")
    required_families = [
        "rock", "metal", "punk", "electronic", "hip-hop", "pop", "r&b", "soul",
        "jazz", "classical", "ambient", "experimental", "folk", "country",
        "reggae", "latin", "world", "soundtrack", "industrial", "gothic",
        "alternative", "indie", "k-pop", "j-pop", "ukrainian", "phonk",
        "synthwave", "hyperpop",
    ]
    missing = [f for f in required_families if f not in tax.families]
    check("all required families present", not missing, f"missing: {missing}")
    check("metal lists black/death/doom subgenres",
          {"black metal", "death metal", "doom metal"} <= set(
              g.lower() for g in tax.families["metal"]["subgenres"]))
    check("electronic lists techno/house/dnb subgenres",
          {"techno", "house", "drum and bass"} <= set(
              g.lower() for g in tax.families["electronic"]["subgenres"]))

    print("Taxonomy: alias normalization")
    check("alias 'edm' -> electronic family", tax.family_of("edm") == "electronic")
    check("alias 'synth wave' -> synthwave", tax.normalize("synth wave") == "synthwave")
    check("alias 'kpop' -> k-pop", tax.normalize("kpop") == "k-pop")
    check("'atmospheric black metal' canonical",
          tax.normalize("atmospheric black metal") == "atmospheric black metal")
    check("messy 'Atmo Black Metal' resolves into metal family",
          tax.family_of("Atmo Black Metal") == "metal")

    print("Taxonomy: parent -> subgenre expansion")
    metal_tree = tax.expand_family("metal")
    check("expand_family(metal) includes subgenres",
          {"metal", "black metal", "doom metal"} <= metal_tree)
    check("subgenre selection resolves to its family",
          tax.token_to_family.get("blackgaze") == "metal")

    print("Taxonomy: strict matching")
    check("strict: black metal track matches [metal]",
          tax.matches_selection(["black metal"], ["metal"]))
    check("strict: pop track rejected for [black metal]",
          not tax.matches_selection(["pop"], ["black metal"]))
    check("strict: subgenre selection stays narrow (doom != black metal)",
          not tax.matches_selection(["doom metal"], ["black metal"]))

    print("Taxonomy: exclusion")
    check("exclude metalcore filters a metalcore track",
          tax.is_excluded(["metalcore"], ["metalcore"]))
    check("exclude family pop filters dance pop track",
          tax.is_excluded(["dance pop"], ["pop"]))
    check("non-excluded track passes",
          not tax.is_excluded(["black metal"], ["pop"]))

    print("Taxonomy: adjacency / distance")
    check("adjacent: industrial is adjacent to [metal]",
          tax.matches_adjacent(["industrial"], ["metal"]))
    check("adjacent: classical is NOT adjacent to [metal]",
          not tax.matches_adjacent(["classical"], ["metal"]))
    check("distance exact == 0.0", tax.distance(["black metal"], ["black metal"]) == 0.0)
    check("distance sibling ~0.25", tax.distance(["death metal"], ["black metal"]) == 0.25)
    check("distance related ~0.5", tax.distance(["industrial"], ["metal"]) == 0.5)
    check("distance distant >= 0.85", tax.distance(["reggaeton"], ["metal"]) >= 0.85)
    check("distance unrelated == 1.0", tax.distance(["polka"], ["metal"]) == 1.0)

    print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
    if FAIL:
        print("Failed:", ", ".join(FAIL))
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
