#!/usr/bin/env python3
"""test_music_dna_report.py — offline tests for the Music DNA report."""

import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))

import music_dna_report as MDR
from personal_store import PersonalStore

PASS, FAIL = [], []


def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    print(f"  {'PASS' if cond else 'FAIL'}  {name}" + (f"  [{detail}]" if detail and not cond else ""))


PROFILE = {
    "emotional_tone": "introspective", "energy_level": 0.42, "novelty_tolerance": "high",
    "mainstream_vs_niche": "niche", "mood_profile": "Leans dark and reflective.",
    "repetition_pattern": "varied", "taste_drift": "stable",
    "core_genres": [{"genre": "atmospheric black metal", "affinity_score": 1.0},
                    {"genre": "darkwave", "affinity_score": 0.8},
                    {"genre": "ambient", "affinity_score": 0.6}],
    "recurring_artists": [{"artist_name": "Drudkh", "play_count": 9},
                          {"artist_name": "Clan of Xymox", "play_count": 6}],
}

RECS = {"parameters": {
    "candidate_pool": {"size": 44, "sources_used": ["local_catalog", "lastfm_similar"],
                       "genre_metadata_quality": "medium"},
    "profile_quality": {"confidence": "medium"},
}}


def main():
    with tempfile.TemporaryDirectory() as d:
        store = PersonalStore(base_dir=d)
        store.add_record("favorites", {"track_title": "Eternity", "artist": "Drudkh",
                                       "genres": ["atmospheric black metal"], "action": "favorite"})
        store.add_record("rejects", {"track_title": "Sunshine", "artist": "Star",
                                     "genres": ["pop"], "action": "reject"})

        print("Report: structure + content")
        md = MDR.build_report(PROFILE, RECS, store, source_label="Last.fm: rj")
        for i, header in enumerate([
            "Taste summary", "Top genres", "Top artists", "Mood profile", "Energy profile",
            "Novelty tolerance", "Current source quality", "Recommendation strengths",
            "Weaknesses", "Suggested exploration", "Favorite presets",
            "Recent favorite recommendations", "Rejected styles", "next listening"], 1):
            check(f"section {i} present ({header})", header.lower() in md.lower())
        check("not raw JSON ({ not dominating)", md.count("{") <= 1)
        check("top genre rendered", "atmospheric black metal" in md)
        check("favorite rendered", "Drudkh — Eternity" in md)
        check("rejected style rendered", "pop" in md)
        check("source quality reflects pool", "44" in md and "lastfm_similar" in md)

        print("Report: branding")
        branded = MDR.build_report(PROFILE, RECS, store, branding="MyStudio")
        check("branding appears in title", "MyStudio" in branded.splitlines()[0])
        check("no branding when not set", "MyStudio" not in md)

        print("Report: write + empty profile")
        path = MDR.write_report(PROFILE, RECS, store, path=Path(d) / "r.md")
        check("report written to disk", path.exists() and path.read_text().startswith("# Music DNA"))
        empty = MDR.build_report({})
        check("empty profile still renders without crashing", "Music DNA Report" in empty)

    print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
    if FAIL:
        print("Failed:", ", ".join(FAIL))
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
