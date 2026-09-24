#!/usr/bin/env python3
"""
api/_engine.py
==============
Serverless-safe, in-memory wrapper around the existing recommendation engine for
the Vercel demo mode. No HTTPServer, no writes to outputs/, no feedback files,
no provider credentials. Pure request -> JSON response.

The local self-test app (scripts/local_interface.py) is untouched and remains the
full-featured mode.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
for p in (str(SCRIPTS), str(ROOT)):
    if p not in sys.path:
        sys.path.insert(0, p)

import analyze_taste as at                      # noqa: E402
import generate_recommendations as gr           # noqa: E402
from mtr_app.validation import build_manual_history, UserInputError  # noqa: E402
import enrich_genres                            # noqa: E402  (offline only here)
import source_common                            # noqa: E402

EXAMPLES = ROOT / "examples"
CATALOG = EXAMPLES / "sample_candidate_catalog.json"
DEMO_HISTORY = EXAMPLES / "sample_listening_history.json"
OWNER_HISTORY = EXAMPLES / "demo_owner_taste.json"

TASKS = {"work_focus", "walking", "workout", "night_drive", "sad_mood", "romantic_mood",
         "party", "relaxation", "tiktok_reels", "ai_video", "playlist_creation",
         "discovering_new_artists", "surprise_me"}


def build_profile(tracks):
    """Compose a taste profile in memory (mirrors analyze_taste.main, no I/O)."""
    genre_affinity = at.calculate_genre_affinity(tracks)
    recurring_artists = at.calculate_artist_recurrence(tracks)
    mood_profile = at.calculate_mood_profile(tracks, genre_affinity)
    repetition = at.calculate_repetition_pattern(tracks)
    novelty_tolerance = at.calculate_novelty_tolerance(repetition)
    taste_drift = at.calculate_taste_drift(tracks)
    return {
        "core_genres": genre_affinity,
        "recurring_artists": recurring_artists,
        "mood_profile": mood_profile,
        "energy_level": round(mood_profile["average_energy"], 3),
        "mainstream_vs_niche": 0.5,
        "repetition_pattern": repetition,
        "novelty_tolerance": round(novelty_tolerance, 3),
        "taste_drift": taste_drift,
        "emotional_tone": at.determine_emotional_tone(mood_profile),
        "possible_use_cases": at.suggest_use_cases(mood_profile, mood_profile["average_energy"]),
    }


def _split(text):
    return [x.strip() for x in str(text or "").replace(";", ",").split(",") if x.strip()]


def dna_summary(profile, track_count):
    genres = [g["genre"] for g in profile.get("core_genres", [])[:6]]
    artists = [a["artist_name"] for a in profile.get("recurring_artists", [])[:5]]
    mood = profile.get("mood_profile", {})
    return {
        "tracks_analyzed": track_count,
        "top_genres": genres,
        "top_artists": artists,
        "emotional_tone": profile.get("emotional_tone", ""),
        "energy_level": profile.get("energy_level", 0),
        "novelty_tolerance": profile.get("novelty_tolerance", 0),
        "average_valence": mood.get("average_valence", 0),
    }


def demo_recommend(payload):
    """payload: {source: demo|owner_demo|paste, tracks_text?, mood, task, novelty,
    max?, strictness?, include?, exclude?} -> JSON-safe dict. Raises ValueError on bad input."""
    source = str(payload.get("source", "demo")).strip() or "demo"
    if source == "owner_demo":
        history = json.loads(OWNER_HISTORY.read_text(encoding="utf-8"))
        source_label = "Owner-style demo taste"
    elif source == "paste":
        text = str(payload.get("tracks_text", ""))
        if len(text) > 20000:
            raise ValueError("Pasted text is too long (max 20000 characters).")
        try:
            history = build_manual_history(text, "", "en")
        except UserInputError as exc:
            raise ValueError(str(exc))
        source_label = f"Pasted tracks ({len(history['tracks'])})"
    else:
        history = json.loads(DEMO_HISTORY.read_text(encoding="utf-8"))
        source_label = "Demo library"

    tracks = history.get("tracks", [])
    if not tracks:
        raise ValueError("No tracks to analyze.")
    if len(tracks) > 500:
        tracks = tracks[:500]
    # Offline genre enrichment (never calls Last.fm in the hosted demo): pasted
    # tracks arrive without genres, so borrow them from the bundled genre map.
    history = {"source": history.get("source", source), "tracks": tracks}
    _, enrich_stats = enrich_genres.enrich_history(history, lastfm_client=None)
    try:
        cov = source_common.compute_coverage(history)
        coverage = {k: cov.get(k) for k in ("confidence_level", "confidence_reasons",
                                             "total_tracks", "unique_artists", "unique_genres")}
    except Exception:
        coverage = None

    try:
        mood = max(-2, min(2, int(payload.get("mood", 0))))
        novelty = max(1, min(5, int(payload.get("novelty", 3))))
        max_items = max(3, min(12, int(payload.get("max", 9))))
    except (TypeError, ValueError):
        raise ValueError("mood, novelty and max must be numbers.")
    task = str(payload.get("task", "surprise_me"))
    if task not in TASKS:
        task = "surprise_me"

    constraints = None
    include = _split(payload.get("include", ""))
    exclude = _split(payload.get("exclude", ""))
    strictness = str(payload.get("strictness", "")).strip()
    if include or exclude or strictness:
        constraints = {
            "selected_families": [], "selected_subgenres": include, "selected_microgenres": [],
            "exclude_genres": exclude,
        }
        if strictness in ("soft", "balanced", "strict"):
            constraints["strictness"] = strictness

    profile = build_profile(tracks)
    output = gr.generate_recommendations(
        profile, float(mood), task, novelty, max_items, str(CATALOG),
        feedback_path=None, use_feedback=False,
        genre_constraints=constraints, personal_memory=None)

    recs = []
    for r in output.get("recommendations", []):
        recs.append({
            "track_title": r.get("track_title"), "artist": r.get("artist"),
            "genres": r.get("genres", [])[:5], "group": r.get("group"),
            "confidence": r.get("confidence_score"),
            "why": r.get("why_like") or r.get("explanation", ""),
            "risk": r.get("why_not_like", ""),
            "search_links": r.get("search_links", {}),
        })
    params = output.get("parameters", {})
    return {
        "ok": True,
        "source_label": source_label,
        "dna": dna_summary(profile, len(tracks)),
        "coverage": coverage,
        "genre_enrichment": {k: enrich_stats[k] for k in ("missing", "filled", "offline_map", "same_artist")},
        "recommendations": recs,
        "pool": {"size": params.get("candidate_pool_size"),
                 "after_genre_filter": params.get("candidates_after_genre_filter")},
        "note": ("Not enough candidates for Strict mode. Try Balanced mode, paste more "
                 "tracks, or run the full local app with Last.fm similar tracks.")
                if len(recs) < 3 and constraints else "",
    }
