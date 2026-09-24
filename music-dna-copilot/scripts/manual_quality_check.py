#!/usr/bin/env python3
"""
manual_quality_check.py
=======================
Not a unit test. Runs several real local scenarios against the sample data and
writes a readable checklist to outputs/manual_quality_check.md so the owner can
judge whether recommendations are actually *good*, not just whether code passes.

    python3 scripts/manual_quality_check.py

Offline: uses the bundled sample history + candidate catalog. No network.
"""

import json
import os
import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
ROOT = SCRIPTS.parents[0]
sys.path.insert(0, str(SCRIPTS))

os.environ.setdefault("MTR_PIPELINE_TIMEOUT", "30")
os.environ["LASTFM_API_KEY"] = ""
os.environ["LASTFM_USERNAME"] = ""

import local_interface as li

HISTORY = ROOT / "examples" / "sample_listening_history.json"
CATALOG = ROOT / "examples" / "sample_candidate_catalog.json"
OUT = ROOT / "outputs" / "manual_quality_check.md"


def gc(**kw):
    base = {"genre_families": "", "genre_subgenres": "", "genre_microgenres": "",
            "exclude_genres": "", "strictness": "", "discovery": "",
            "prefer_ukrainian": False, "prefer_instrumental": False,
            "prefer_vocal": False, "prefer_obscure": False, "prefer_popular": False}
    base.update(kw)
    return base


SCENARIOS = [
    {"name": "Night Drive", "mood": -1, "task": "night_drive", "novelty": 3,
     "gc": gc()},
    {"name": "Atmospheric Black Metal (strict, no deathcore/metalcore)", "mood": -1,
     "task": "relaxation", "novelty": 3,
     "gc": gc(genre_families="metal", genre_subgenres="atmospheric black metal",
              strictness="strict", discovery="inside", exclude_genres="deathcore,metalcore")},
    {"name": "Darkwave Walk (adjacent)", "mood": 0, "task": "walking", "novelty": 3,
     "gc": gc(genre_subgenres="darkwave", discovery="adjacent")},
    {"name": "Focus (electronic, no EDM)", "mood": 0, "task": "work_focus", "novelty": 3,
     "gc": gc(genre_families="electronic", exclude_genres="edm", discovery="inside")},
    {"name": "Ukrainian Indie / Alternative", "mood": 1, "task": "walking", "novelty": 3,
     "gc": gc(genre_families="indie,alternative", prefer_ukrainian=True)},
    {"name": "Creator Mode / Dark Mystic Video", "mood": -1, "task": "ai_video", "novelty": 4,
     "gc": gc(discovery="adjacent")},
    {"name": "Wild Discovery", "mood": 0, "task": "discovering_new_artists", "novelty": 5,
     "gc": gc(discovery="cross_genre")},
]


def _split(text):
    return [x.strip().lower() for x in str(text or "").replace(";", ",").split(",") if x.strip()]


def check_rules(items, constraints):
    """Return (exclude_ok, strict_ok, notes) for the scenario's items."""
    excluded = _split(constraints.get("exclude_genres"))
    selected = _split(constraints.get("genre_families")) + _split(constraints.get("genre_subgenres")) \
        + _split(constraints.get("genre_microgenres"))
    exclude_ok, strict_ok = True, True
    bad_exclude, bad_strict = [], []
    for it in items:
        genres = [g.lower() for g in it.get("genres", [])]
        joined = " ".join(genres)
        for ex in excluded:
            if any(ex in g for g in genres):
                exclude_ok = False
                bad_exclude.append(f"{it.get('artist')} — {it.get('track_title')} ({ex})")
        if constraints.get("strictness") == "strict" and selected:
            if not any(sel in joined for sel in selected):
                strict_ok = False
                bad_strict.append(f"{it.get('artist')} — {it.get('track_title')}")
    notes = []
    if bad_exclude:
        notes.append("excluded genre leaked: " + "; ".join(bad_exclude[:5]))
    if bad_strict:
        notes.append("strict mismatch: " + "; ".join(bad_strict[:5]))
    return exclude_ok, strict_ok, notes


def run_scenario(sc, history):
    profile, recs, _prompt = li.run_pipeline(
        HISTORY, sc["mood"], sc["task"], sc["novelty"], 8, CATALOG, "en",
        genre_constraints=sc["gc"])
    items = recs.get("recommendations", [])
    params = recs.get("parameters", {})
    try:
        pq = li.compute_profile_quality(history, profile, recs, "sample history", None)
    except Exception:
        pq = None
    exclude_ok, strict_ok, notes = check_rules(items, sc["gc"])
    return {"profile": profile, "recs": recs, "items": items, "params": params,
            "pq": pq, "exclude_ok": exclude_ok, "strict_ok": strict_ok, "notes": notes}


def render(sc, res):
    L = [f"## {sc['name']}", ""]
    g = sc["gc"]
    L.append("**Input settings**")
    L.append("")
    L.append(f"- mood: {sc['mood']} · task: {sc['task']} · novelty: {sc['novelty']}")
    constraint_bits = [f"{k}={v}" for k, v in g.items() if v and not isinstance(v, bool)]
    pref_bits = [k for k, v in g.items() if v is True]
    L.append(f"- genre constraints: {', '.join(constraint_bits) or '(none)'}")
    if pref_bits:
        L.append(f"- preferences: {', '.join(pref_bits)}")
    L.append("")
    items = res["items"]
    p = res["params"]
    L.append(f"**Recommendations returned:** {len(items)}")
    L.append(f"**Candidate pool size:** {p.get('candidate_pool_size', '?')} · "
             f"after genre filter: {p.get('candidates_after_genre_filter', '?')}")
    if res["pq"]:
        pq = res["pq"]
        L.append(f"**Profile quality:** {pq.get('confidence', '?')} "
                 f"({pq.get('tracks_analyzed', '?')} tracks, {pq.get('detected_genres', '?')} genres)")
    L.append("")
    L.append("**Top 5**")
    L.append("")
    if items:
        for it in items[:5]:
            genres = ", ".join(it.get("genres", [])[:4])
            L.append(f"1. {it.get('artist', '?')} — {it.get('track_title', '?')} "
                     f"[{it.get('group', '?')}] · {genres}")
    else:
        L.append("_(no recommendations — pool too small or constraints too tight)_")
    L.append("")
    L.append(f"**Exclude rules respected:** {'yes' if res['exclude_ok'] else 'NO'}")
    if g.get("strictness") == "strict":
        L.append(f"**Strict match respected:** {'yes' if res['strict_ok'] else 'NO'}")
    for n in res["notes"]:
        L.append(f"- ⚠️ {n}")
    L.append("")
    L.append("**Owner notes** (fill in during a 3–5 day personal test):")
    L.append("")
    L.append("- Manual verdict: ____________________________________________")
    L.append("- Best tracks: ______________________________________________")
    L.append("- Bad tracks: _______________________________________________")
    L.append("- Genre accuracy (1–5): _____________________________________")
    L.append("- Would I listen to this? (yes / no): _______________________")
    L.append("- What to adjust next: ______________________________________")
    L.append("")
    L.append("---")
    L.append("")
    return "\n".join(L)


def main():
    history = json.loads(HISTORY.read_text(encoding="utf-8"))
    OUT.parent.mkdir(exist_ok=True)
    parts = ["# Manual quality check", "",
             "Generated by `scripts/manual_quality_check.py` against the bundled sample data.",
             "Review each scenario and write a manual verdict.", "", "---", ""]
    summary_rows = []
    for sc in SCENARIOS:
        res = run_scenario(sc, history)
        parts.append(render(sc, res))
        warn = "; ".join(res["notes"]) if res["notes"] else "none"
        rule_flag = "ok" if (res["exclude_ok"] and (res["strict_ok"] or sc["gc"].get("strictness") != "strict")) else "CHECK"
        summary_rows.append(f"| {sc['name']} | {len(res['items'])} | {warn} | {rule_flag} | _____ |")
    table = ["## Summary", "",
             "| Scenario | Result count | Warnings | Rules | Manual verdict |",
             "| --- | --- | --- | --- | --- |"] + summary_rows + ["", "---", ""]
    parts.insert(6, "\n".join(table))
    OUT.write_text("\n".join(parts), encoding="utf-8")
    print(f"Wrote {OUT} ({len(SCENARIOS)} scenarios).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
