#!/usr/bin/env python3
"""
music_dna_report.py
===================
Render a readable, shareable Music DNA report (Markdown) from a taste profile,
the latest recommendations, and the local personal store. No raw JSON dumps.

Designed to be copy-pasted into another AI, a creator workflow, or kept locally.
Stdlib only.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUTS = ROOT / "outputs"


def _g(profile, key, default=None):
    return profile.get(key, default) if isinstance(profile, dict) else default


def _genre_names(profile, n=8):
    return [g.get("genre", "") for g in (_g(profile, "core_genres") or [])[:n] if g.get("genre")]


def _artist_names(profile, n=8):
    return [a.get("artist_name", "") for a in (_g(profile, "recurring_artists") or [])[:n]
            if a.get("artist_name")]


def _bullets(items, empty="None yet."):
    items = [str(i) for i in items if str(i).strip()]
    return "\n".join(f"- {i}" for i in items) if items else f"- {empty}"


def build_report(profile, recs=None, store=None, source_label="", branding=None):
    profile = profile or {}
    recs = recs or {}
    params = recs.get("parameters", {})
    pool = params.get("candidate_pool", {})
    pq = params.get("profile_quality", {})
    memory = store.personal_memory() if store else {}

    genres = _genre_names(profile)
    artists = _artist_names(profile)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    title = "Music DNA Report"
    if branding:
        title += f" — {branding}"

    favorites = store.list_records("favorites")[-10:] if store else []
    presets = [p["name"] for p in store.list_presets()] if store else []
    rejects_styles = memory.get("reduced_genres", [])

    # Strengths / weaknesses
    strengths, weaknesses = [], []
    if len(genres) >= 5:
        strengths.append("Clear, multi-genre taste signal.")
    else:
        weaknesses.append("Few detected genres — add more history for a richer profile.")
    if pq.get("confidence") == "high":
        strengths.append("High-confidence profile (enough tracks, genres, and candidates).")
    elif pq.get("confidence") == "low":
        weaknesses.append("Low-confidence profile — small history or candidate pool.")
    if pool.get("genre_metadata_quality") in ("low", "medium"):
        weaknesses.append("Candidate genre metadata is thin; enable Last.fm tags or upload tagged history.")
    if pool.get("size", 0) and pool["size"] < 60:
        weaknesses.append("Small candidate pool can narrow strict-mode results.")

    # Exploration directions: adjacent to top genres + any boosted styles
    explore = list(dict.fromkeys((memory.get("boosted_genres") or []) + genres[:3]))[:6]

    lines = [
        f"# {title}",
        f"_Generated {now}. Local-first — this stays on your device._",
        "",
        "## 1. Taste summary",
        f"Emotional tone: **{_g(profile, 'emotional_tone', 'balanced')}**, "
        f"energy **{_g(profile, 'energy_level', 0.5):.2f}/1.0**, "
        f"novelty tolerance **{_g(profile, 'novelty_tolerance', 'moderate')}**, "
        f"mainstream/niche: **{_g(profile, 'mainstream_vs_niche', 'mixed')}**.",
        "",
        "## 2. Top genres",
        _bullets(genres, "Not enough genre data yet."),
        "",
        "## 3. Top artists",
        _bullets(artists, "Not enough artist data yet."),
        "",
        "## 4. Mood profile",
        f"{_g(profile, 'mood_profile', 'Balanced across moods.')}",
        "",
        "## 5. Energy profile",
        f"Average energy {_g(profile, 'energy_level', 0.5):.2f}/1.0 "
        f"(repetition pattern: {_g(profile, 'repetition_pattern', 'varied')}).",
        "",
        "## 6. Novelty tolerance",
        f"{_g(profile, 'novelty_tolerance', 'moderate')} "
        f"(taste drift: {_g(profile, 'taste_drift', 'stable')}).",
        "",
        "## 7. Current source quality",
        f"Source: **{source_label or 'demo/local'}**. "
        f"Candidate pool: **{pool.get('size', params.get('candidate_pool_size', 0))}** "
        f"({', '.join(pool.get('sources_used', []) or ['local_catalog'])}); "
        f"genre metadata: **{pool.get('genre_metadata_quality', 'n/a')}**; "
        f"profile confidence: **{pq.get('confidence', 'n/a')}**.",
        "",
        "## 8. Recommendation strengths",
        _bullets(strengths, "Run a recommendation to populate this."),
        "",
        "## 9. Weaknesses / blind spots",
        _bullets(weaknesses, "No major gaps detected."),
        "",
        "## 10. Suggested exploration directions",
        _bullets([f"Explore more around: {e}" for e in explore], "Try a preset to get started."),
        "",
        "## 11. Favorite presets",
        _bullets(presets[:12], "No presets available."),
        "",
        "## 12. Recent favorite recommendations",
        _bullets([f"{r.get('artist', '?')} — {r.get('track_title', '?')}" for r in favorites],
                 "No favorites saved yet. Use the Favorite button on a result."),
        "",
        "## 13. Rejected styles / blocked directions",
        _bullets((rejects_styles or []) +
                 [f"blocked: {b.get('artist', '?')} — {b.get('track_title', '?')}"
                  for b in memory.get("blocked_tracks", [])[:10]],
                 "Nothing rejected yet."),
        "",
        "## 14. Suggested next listening sessions",
        _bullets([
            "Strict mode on a top genre when you know exactly what you want.",
            "Adjacent discovery on a favorite family for fresh-but-familiar finds.",
            "Wild Discovery preset with Last.fm similar tracks for a stretch.",
        ]),
        "",
    ]
    if branding:
        lines.append(f"_Report by {branding}._")
    return "\n".join(lines)


def write_report(profile, recs=None, store=None, source_label="", branding=None, path=None):
    md = build_report(profile, recs, store, source_label, branding)
    path = Path(path) if path else (OUTPUTS / "music_dna_report.md")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(md, encoding="utf-8")
    return path


if __name__ == "__main__":
    import sys
    prof = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8")) if len(sys.argv) > 1 else {}
    print(build_report(prof))
