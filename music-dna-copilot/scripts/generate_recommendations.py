#!/usr/bin/env python3
"""
generate_recommendations.py
===========================
Generate explainable music recommendations from a Music DNA taste profile.

This script is intentionally transparent: it uses simple scoring heuristics
instead of a black-box model. In local/demo mode it can recommend from a static
candidate catalog. In a future connector mode, the candidate catalog can be
replaced with Spotify/Last.fm/Apple Music search results.

Usage:
    python scripts/generate_recommendations.py outputs/taste_profile_generated.json \
        --mood 1 --task night_drive --novelty 3 --max 9 \
        --catalog examples/sample_candidate_catalog.json \
        --output outputs/recommendations_generated.json
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote_plus

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CATALOG_PATH = ROOT / "examples" / "sample_candidate_catalog.json"
DEFAULT_FEEDBACK_PATH = ROOT / "outputs" / "feedback.jsonl"

# ---------------------------------------------------------------------------
# Feedback-aware scoring (V2.1)
# ---------------------------------------------------------------------------
# Transparent rules (documented in ux/product_logic.md):
#   like           -> +1.0 weight to the track's genres and artist
#   more_like_this -> +1.5 weight to the track's genres and artist
#   not_for_me     -> -1.0 weight to the track's genres and artist
#   too_similar    -> +0.05 shift to novelty distance (wants more new)
#   too_strange    -> -0.05 shift to novelty distance (wants more familiar)
# Aggregated weights are scaled and capped so feedback can nudge, never
# dominate: per-genre cap +/-0.30, per-artist cap +/-0.40, novelty shift
# cap +/-0.15, final confidence impact cap +/-6 points.

FEEDBACK_ACTION_WEIGHTS = {"like": 1.0, "more_like_this": 1.5, "not_for_me": -1.0}
FEEDBACK_NOVELTY_SHIFTS = {"too_similar": 0.05, "too_strange": -0.05}


# ---------------------------------------------------------------------------
# Deep genre constraints (V4): optional taxonomy-aware genre direction
# ---------------------------------------------------------------------------
sys.path.insert(0, str(ROOT / "scripts"))
try:
    from music_dna_brain import build_adaptive_dna, track_learning_adjustment, explain_changes
except Exception:
    build_adaptive_dna = track_learning_adjustment = explain_changes = None

try:
    from genre_taxonomy import load_taxonomy
except Exception:  # pragma: no cover - taxonomy is optional
    load_taxonomy = None

GENRE_STRICTNESS = {"soft", "balanced", "strict"}
GENRE_DISCOVERY = {"inside", "adjacent", "cross_genre"}
_PREF_KEYS = ("prefer_obscure", "prefer_popular", "prefer_instrumental",
              "prefer_vocal", "prefer_ukrainian")


def normalize_constraints(constraints):
    """Fill defaults; return None if the constraints are inactive (no selection,
    no exclusions, no preferences) so scoring stays backward-compatible."""
    if not constraints:
        return None
    def clean(key):
        return [str(s).strip() for s in (constraints.get(key) or []) if str(s).strip()]
    c = {
        "selected_families": clean("selected_families"),
        "selected_subgenres": clean("selected_subgenres"),
        "selected_microgenres": clean("selected_microgenres"),
        "exclude_genres": clean("exclude_genres"),
        "strictness": constraints.get("strictness") if constraints.get("strictness") in GENRE_STRICTNESS else "balanced",
        "discovery_direction": constraints.get("discovery_direction") if constraints.get("discovery_direction") in GENRE_DISCOVERY else "adjacent",
    }
    for k in _PREF_KEYS:
        c[k] = bool(constraints.get(k))
    c["_selected"] = c["selected_families"] + c["selected_subgenres"] + c["selected_microgenres"]
    c["_has_selection"] = bool(c["_selected"])
    c["_active"] = bool(c["_has_selection"] or c["exclude_genres"] or any(c[k] for k in _PREF_KEYS))
    return c if c["_active"] else None


def get_taxonomy():
    if load_taxonomy is None:
        return None
    try:
        return load_taxonomy()
    except Exception:
        return None


def assess_genre(track_genres, constraints, taxonomy):
    """Compute genre match/exclusion/scope for a track against the constraints.
    Returns a dict used for both scoring and the genre_reasoning output."""
    result = {
        "distance": None,
        "requested_genre_match_score": 0.0,
        "taxonomy_distance_score": None,
        "excluded": False,
        "matched_selected_genres": [],
        "matched_subgenres": [],
        "matched_aliases": [],
        "in_scope": True,
        "kept": True,
    }
    if not constraints or taxonomy is None:
        return result

    # exclusions always filter the track out (it must never appear)
    if constraints["exclude_genres"] and taxonomy.is_excluded(track_genres, constraints["exclude_genres"]):
        result["excluded"] = True
        result["kept"] = False
        return result

    if not constraints["_has_selection"]:
        return result  # only exclusions/prefs active

    selected = constraints["_selected"]
    target = taxonomy.expand_selection(selected)
    d = taxonomy.distance(track_genres, selected)
    result["distance"] = round(d, 3)
    result["requested_genre_match_score"] = round(1.0 - d, 3)
    result["taxonomy_distance_score"] = round(1.0 - d, 3)

    for g in track_genres:
        token = taxonomy.normalize(g)
        if token and token in target:
            result["matched_selected_genres"].append(token)
            if taxonomy.token_kind.get(token) in ("subgenre", "microgenre"):
                result["matched_subgenres"].append(token)
            if taxonomy.normalize(g) and (str(g).strip().lower() != token):
                result["matched_aliases"].append(str(g).strip().lower())

    direction = constraints["discovery_direction"]
    if direction == "inside":
        result["in_scope"] = (d == 0.0)
    elif direction == "adjacent":
        result["in_scope"] = (d <= 0.5)
    else:  # cross_genre
        result["in_scope"] = True

    if constraints["strictness"] == "strict":
        result["kept"] = result["in_scope"]
    else:
        result["kept"] = True  # balanced/soft keep, scoring handles preference
    return result


def preference_delta(track, constraints, taxonomy):
    """Net preference nudge in roughly [-1, 1] from the prefer_* toggles."""
    contribs = []
    pop = track.get("popularity", 0.5)
    instr = track.get("instrumentalness", 0.0)
    if constraints["prefer_popular"]:
        contribs.append((pop - 0.5) * 2)
    if constraints["prefer_obscure"]:
        contribs.append((0.5 - pop) * 2)
    if constraints["prefer_instrumental"]:
        contribs.append((instr - 0.5) * 2)
    if constraints["prefer_vocal"]:
        contribs.append((0.5 - instr) * 2)
    if constraints["prefer_ukrainian"]:
        fam = taxonomy.family_of(" ".join(track.get("genres", []))) if taxonomy else None
        is_uk = taxonomy is not None and any(taxonomy.family_of(g) == "ukrainian" for g in track.get("genres", []))
        contribs.append(1.0 if is_uk else -0.3)
    if not contribs:
        return 0.0
    return max(-1.0, min(1.0, sum(contribs) / len(contribs)))


def load_feedback_signals(path=None):
    """Read outputs/feedback.jsonl and aggregate it into scoring signals.

    Returns a dict with genre preferences, artist preferences, a novelty
    shift, and the number of records used. Missing/empty file -> neutral
    signals (the engine behaves exactly as before).
    """
    feedback_path = Path(path) if path else DEFAULT_FEEDBACK_PATH
    neutral = {"genre_pref": {}, "artist_pref": {}, "novelty_shift": 0.0, "records_used": 0}
    if not feedback_path.exists():
        return neutral

    genre_raw, artist_raw = {}, {}
    novelty_shift, used = 0.0, 0
    for line in feedback_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            record = json.loads(line)
        except json.JSONDecodeError:
            continue
        action = record.get("action") or record.get("feedback")
        if action in FEEDBACK_NOVELTY_SHIFTS:
            novelty_shift += FEEDBACK_NOVELTY_SHIFTS[action]
            used += 1
            continue
        weight = FEEDBACK_ACTION_WEIGHTS.get(action)
        if weight is None:
            continue
        used += 1
        artist = str(record.get("artist", "")).strip().lower()
        if artist:
            artist_raw[artist] = artist_raw.get(artist, 0.0) + weight
        for genre in record.get("genres", []) or []:
            g = str(genre).strip().lower()
            if g:
                genre_raw[g] = genre_raw.get(g, 0.0) + weight

    return {
        "genre_pref": {g: clamp(w * 0.08, -0.30, 0.30) for g, w in genre_raw.items()},
        "artist_pref": {a: clamp(w * 0.12, -0.40, 0.40) for a, w in artist_raw.items()},
        "novelty_shift": clamp(novelty_shift, -0.15, 0.15),
        "records_used": used,
    }


def feedback_adjustment_for(track, signals):
    """Per-track adjustment in [-0.5, 0.5] derived from saved feedback."""
    if not signals or not signals.get("records_used"):
        return 0.0
    genre_pref = signals["genre_pref"]
    hits = [genre_pref[g] for g in track.get("genres", []) if g in genre_pref]
    genre_part = sum(hits) / len(hits) if hits else 0.0
    artist_part = signals["artist_pref"].get(track.get("artist", "").lower(), 0.0)
    return clamp(genre_part + artist_part, -0.5, 0.5)


TASK_PROFILES = {
    "work_focus": {"ideal_energy": 0.3, "ideal_valence": 0.5, "prefer_instrumental": True, "ideal_tempo_range": (60, 110)},
    "walking": {"ideal_energy": 0.5, "ideal_valence": 0.6, "prefer_instrumental": False, "ideal_tempo_range": (90, 130)},
    "workout": {"ideal_energy": 0.85, "ideal_valence": 0.6, "prefer_instrumental": False, "ideal_tempo_range": (120, 180)},
    "night_drive": {"ideal_energy": 0.5, "ideal_valence": 0.4, "prefer_instrumental": False, "ideal_tempo_range": (80, 120)},
    "sad_mood": {"ideal_energy": 0.3, "ideal_valence": 0.3, "prefer_instrumental": False, "ideal_tempo_range": (60, 100)},
    "romantic_mood": {"ideal_energy": 0.4, "ideal_valence": 0.7, "prefer_instrumental": False, "ideal_tempo_range": (70, 110)},
    "party": {"ideal_energy": 0.85, "ideal_valence": 0.8, "prefer_instrumental": False, "ideal_tempo_range": (110, 140)},
    "relaxation": {"ideal_energy": 0.2, "ideal_valence": 0.5, "prefer_instrumental": True, "ideal_tempo_range": (50, 90)},
    "tiktok_reels": {"ideal_energy": 0.7, "ideal_valence": 0.7, "prefer_instrumental": False, "ideal_tempo_range": (95, 135)},
    "ai_video": {"ideal_energy": 0.5, "ideal_valence": 0.5, "prefer_instrumental": True, "ideal_tempo_range": (80, 120)},
    "playlist_creation": {"ideal_energy": 0.5, "ideal_valence": 0.5, "prefer_instrumental": False, "ideal_tempo_range": (60, 180)},
    "discovering_new_artists": {"ideal_energy": 0.5, "ideal_valence": 0.5, "prefer_instrumental": False, "ideal_tempo_range": (60, 180)},
    "surprise_me": {"ideal_energy": 0.5, "ideal_valence": 0.5, "prefer_instrumental": False, "ideal_tempo_range": (60, 180)},
}

MOOD_LABELS = {
    -2: "very negative / dark / introspective",
    -1: "calm / sad / reflective",
    0: "neutral / balanced",
    1: "energetic / bright / motivating",
    2: "euphoric / uplifting / danceable",
}

NOVELTY_LABELS = {
    1: "Only similar music",
    2: "Slightly new",
    3: "Balanced",
    4: "More experimental",
    5: "Surprise me",
}


def clamp(value, minimum=0.0, maximum=1.0):
    return max(minimum, min(maximum, value))


def map_mood_to_valence_energy(mood_score):
    """Map mood score (-2..+2) to target valence and energy (0..1)."""
    target_valence = (mood_score + 2) / 4.0
    target_energy = 0.30 + (mood_score + 2) * 0.15
    return clamp(target_valence), clamp(target_energy)


def map_novelty_to_distance(novelty_level):
    """Map novelty slider (1..5) to an experimental distance (0.1..1.0)."""
    return round(0.1 + (novelty_level - 1) * 0.225, 3)


def normalize_candidate(raw):
    """Normalize a candidate track from several possible field conventions."""
    title = raw.get("track_title") or raw.get("track_name") or raw.get("name") or "Unknown track"
    artist = raw.get("artist") or raw.get("artist_name") or raw.get("artists") or "Unknown artist"
    if isinstance(artist, list):
        artist = ", ".join(str(a) for a in artist)

    audio = raw.get("audio_features") or {}
    genres = raw.get("genres") or []
    if isinstance(genres, str):
        separator = ";" if ";" in genres else ","
        genres = [g.strip().lower() for g in genres.split(separator) if g.strip()]

    def f(key, default):
        value = raw.get(key, audio.get(key, default))
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    return {
        "track_title": str(title),
        "artist": str(artist),
        "genres": [str(g).lower() for g in genres],
        "valence": clamp(f("valence", 0.5)),
        "energy": clamp(f("energy", 0.5)),
        "tempo": f("tempo", 100.0),
        "instrumentalness": clamp(f("instrumentalness", 0.0)),
        "popularity": clamp(f("popularity", 0.5)),
    }


def load_candidate_catalog(path):
    """Load candidate recommendations from JSON file."""
    catalog_path = Path(path) if path else DEFAULT_CATALOG_PATH
    if not catalog_path.exists():
        raise FileNotFoundError(f"Candidate catalog not found: {catalog_path}")
    data = json.loads(catalog_path.read_text(encoding="utf-8"))
    raw_tracks = data.get("tracks", data) if isinstance(data, dict) else data
    if not isinstance(raw_tracks, list):
        raise ValueError("Candidate catalog must be a list or an object with a 'tracks' list.")
    tracks = [normalize_candidate(t) for t in raw_tracks]
    if not tracks:
        raise ValueError("Candidate catalog is empty.")
    return tracks


def score_track(track, taste_profile, mood_score, task, novelty_distance, feedback_signals=None,
                constraints=None, taxonomy=None, assess=None, adaptive_dna=None):
    user_genres = {g.get("genre", "").lower(): float(g.get("affinity_score", 0)) for g in taste_profile.get("core_genres", [])}
    track_genres = track.get("genres", [])
    genre_matches = [user_genres.get(g.lower(), 0.0) for g in track_genres]
    genre_affinity_score = sum(genre_matches) / len(genre_matches) if genre_matches else 0.0

    user_artists = {a.get("artist_name", "").lower(): float(a.get("recurrence_score", 0)) for a in taste_profile.get("recurring_artists", [])}
    artist_recurrence_score = user_artists.get(track["artist"].lower(), 0.0)

    target_valence, target_energy = map_mood_to_valence_energy(mood_score)
    valence_diff = abs(track.get("valence", 0.5) - target_valence)
    energy_diff = abs(track.get("energy", 0.5) - target_energy)
    mood_match_score = 1.0 - (valence_diff + energy_diff) / 2.0

    task_profile = TASK_PROFILES.get(task, TASK_PROFILES["playlist_creation"])
    task_energy_diff = abs(track.get("energy", 0.5) - task_profile["ideal_energy"])
    task_valence_diff = abs(track.get("valence", 0.5) - task_profile["ideal_valence"])
    tempo = track.get("tempo", 100.0)
    tempo_min, tempo_max = task_profile["ideal_tempo_range"]
    tempo_center = (tempo_min + tempo_max) / 2.0
    tempo_in_range = 1.0 if tempo_min <= tempo <= tempo_max else clamp(1.0 - abs(tempo - tempo_center) / 100.0)
    instrumental_bonus = 0.2 if task_profile["prefer_instrumental"] and track.get("instrumentalness", 0.0) > 0.5 else 0.0
    task_match_score = clamp((1.0 - (task_energy_diff + task_valence_diff) / 2.0) * 0.6 + tempo_in_range * 0.3 + instrumental_bonus)

    track_familiarity = (genre_affinity_score + artist_recurrence_score) / 2.0
    track_novelty = 1.0 - track_familiarity
    novelty_distance_score = 1.0 - abs(track_novelty - novelty_distance)

    recency_score = track.get("popularity", 0.5)
    stable_genres = set(str(g).lower() for g in taste_profile.get("taste_drift", {}).get("stable_patterns", []))
    long_term_consistency_score = 0.75 if any(g in stable_genres for g in track_genres) else 0.35

    weights = {
        "genre_affinity": 0.24,
        "artist_recurrence": 0.10,
        "mood_match": 0.22,
        "task_match": 0.18,
        "novelty_distance": 0.14,
        "recency": 0.04,
        "long_term_consistency": 0.08,
    }
    confidence = (
        genre_affinity_score * weights["genre_affinity"]
        + artist_recurrence_score * weights["artist_recurrence"]
        + mood_match_score * weights["mood_match"]
        + task_match_score * weights["task_match"]
        + novelty_distance_score * weights["novelty_distance"]
        + recency_score * weights["recency"]
        + long_term_consistency_score * weights["long_term_consistency"]
    )

    # --- Deep genre direction (V4): blend requested-genre match into score ---
    base_confidence = confidence
    requested_genre_match_score = 0.0
    taxonomy_distance_score = None
    excluded_genre_penalty = 0.0
    if constraints is not None:
        if assess is None:
            assess = assess_genre(track.get("genres", []), constraints, taxonomy)
        requested_genre_match_score = assess["requested_genre_match_score"]
        taxonomy_distance_score = assess["taxonomy_distance_score"]
        if constraints["_has_selection"]:
            blend = {"soft": 0.15, "balanced": 0.40, "strict": 0.55}[constraints["strictness"]]
            confidence = (1.0 - blend) * base_confidence + blend * requested_genre_match_score
        if assess["excluded"]:
            excluded_genre_penalty = -0.9
            confidence = clamp(confidence + excluded_genre_penalty)
        pref = preference_delta(track, constraints, taxonomy)
        if pref:
            confidence = clamp(confidence + pref * 0.06)

    # Feedback nudge (V2.1): bounded to +/-0.5 -> at most +/-6 confidence points.
    feedback_adjustment = feedback_adjustment_for(track, feedback_signals)
    confidence = clamp(confidence + feedback_adjustment * 0.12)

    learning_adjustment = track_learning_adjustment(track, adaptive_dna, task) if track_learning_adjustment else 0.0
    confidence = clamp(confidence + learning_adjustment)
    source_confidence_score = clamp(float(track.get("source_confidence", 1.0)))

    return {
        "genre_affinity_score": round(clamp(genre_affinity_score), 3),
        "user_genre_affinity_score": round(clamp(genre_affinity_score), 3),
        "requested_genre_match_score": round(clamp(requested_genre_match_score), 3),
        "taxonomy_distance_score": (round(clamp(taxonomy_distance_score), 3)
                                    if taxonomy_distance_score is not None else None),
        "excluded_genre_penalty": round(excluded_genre_penalty, 3),
        "artist_recurrence_score": round(clamp(artist_recurrence_score), 3),
        "mood_match_score": round(clamp(mood_match_score), 3),
        "task_match_score": round(clamp(task_match_score), 3),
        "novelty_distance_score": round(clamp(novelty_distance_score), 3),
        "recency_score": round(clamp(recency_score), 3),
        "long_term_consistency_score": round(clamp(long_term_consistency_score), 3),
        "source_confidence_score": round(source_confidence_score, 3),
        "diversity_score": 1.0,
        "track_familiarity": round(clamp(track_familiarity), 3),
        "track_novelty": round(clamp(track_novelty), 3),
        "feedback_adjustment": round(feedback_adjustment, 3),
        "adaptive_learning_adjustment": round(learning_adjustment, 3),
        "total_score": round(clamp(confidence), 3),
        "confidence_score": int(round(clamp(confidence) * 100)),
    }


def assign_group(scoring, novelty_distance):
    familiarity = scoring["track_familiarity"]
    safe_threshold = 0.20 + novelty_distance * 0.40
    wildcard_threshold = 0.05 + novelty_distance * 0.25
    if familiarity >= safe_threshold:
        return "safe_match"
    if familiarity >= wildcard_threshold:
        return "adjacent_discovery"
    return "wildcard"


def generate_explanation(track, scoring, group, task, mood_score, novelty_level):
    reasons_like = []
    if scoring["genre_affinity_score"] > 0.45:
        reasons_like.append("it overlaps with your strongest genre patterns")
    if scoring["mood_match_score"] > 0.72:
        reasons_like.append("it fits the mood you selected")
    if scoring["task_match_score"] > 0.72:
        reasons_like.append(f"it should work well for {task.replace('_', ' ')}")
    if scoring["artist_recurrence_score"] > 0.25:
        reasons_like.append(f"you already return to {track['artist']}")
    if scoring["novelty_distance_score"] > 0.72:
        reasons_like.append("its experimental distance matches your novelty slider")
    if not reasons_like:
        reasons_like.append("it gives you a controlled step outside your usual taste")

    reasons_not_like = []
    if scoring["mood_match_score"] < 0.55:
        reasons_not_like.append("the emotional tone may not match your current mood")
    if scoring["task_match_score"] < 0.55:
        reasons_not_like.append(f"it may not be ideal for {task.replace('_', ' ')}")
    if novelty_level <= 2 and scoring["track_novelty"] > 0.75:
        reasons_not_like.append("it may feel too far from your usual taste")
    if novelty_level >= 4 and scoring["track_familiarity"] > 0.65:
        reasons_not_like.append("it may feel too familiar for your current experimental setting")
    if not reasons_not_like:
        reasons_not_like.append("no major mismatch was detected")

    if group == "safe_match":
        short = "Safe match: close to your established taste and current context."
    elif group == "adjacent_discovery":
        short = "Adjacent discovery: new enough to be interesting, but still connected to your profile."
    else:
        short = "Wildcard: intentionally more experimental, selected because the novelty slider allows a wider range."

    return {
        "why_like": "You may like this because " + "; ".join(reasons_like) + ".",
        "why_not_like": "You may not like this because " + "; ".join(reasons_not_like) + ".",
        "explanation": short,
    }


def build_genre_reasoning(assess, constraints):
    """Human-readable genre reasoning for one recommendation."""
    if constraints is None:
        return None
    strictness = constraints["strictness"]
    direction = constraints["discovery_direction"]
    matched = assess["matched_selected_genres"]
    d = assess["distance"]

    if not constraints["_has_selection"]:
        result_label = "no_genre_selection"
        why_match = "No specific genre direction was set; only exclusions/preferences applied."
    elif matched:
        result_label = {"strict": "passed_strict", "balanced": "preferred", "soft": "hint"}[strictness]
        why_match = (f"Matches your selected direction ({', '.join(sorted(set(matched)))}) "
                     f"under {strictness} mode with {direction.replace('_', ' ')} discovery.")
    elif assess["in_scope"] and d is not None and d <= 0.5:
        result_label = "adjacent"
        why_match = "Adjacent discovery: a taxonomy-related genre, not an exact match to your selection."
    elif direction == "cross_genre":
        result_label = "cross_genre"
        why_match = "Cross-genre pick allowed by your discovery setting; chosen on overall taste fit."
    else:
        result_label = "out_of_scope"
        why_match = "Loosely related to your selected genres."

    why_not = ""
    if d is not None and d >= 0.85:
        why_not = f"Genre is distant from your selection (taxonomy distance {d})."
    elif d is not None and d > 0.5:
        why_not = f"Only loosely related to your selection (taxonomy distance {d})."
    elif not assess["matched_selected_genres"] and d is None:
        why_not = "Candidate has sparse genre metadata, so the genre match is uncertain."

    return {
        "matched_selected_genres": sorted(set(assess["matched_selected_genres"])),
        "matched_subgenres": sorted(set(assess["matched_subgenres"])),
        "matched_aliases": sorted(set(assess["matched_aliases"])),
        "taxonomy_distance": d,
        "strictness_result": result_label,
        "why_it_matches_genre_request": why_match,
        "why_it_may_not_match": why_not,
    }


def build_search_links(track):
    query = quote_plus(f"{track['artist']} {track['track_title']}")
    spotify_query = quote_plus(f"track:{track['track_title']} artist:{track['artist']}")
    return {
        "spotify_search": f"https://open.spotify.com/search/{spotify_query}",
        "youtube_search": f"https://www.youtube.com/results?search_query={query}",
        "youtube_music_search": f"https://music.youtube.com/search?q={query}",
    }


def select_diverse_recommendations(scored_tracks, max_items, novelty_level):
    if max_items <= 0:
        return []
    if novelty_level <= 2:
        ratios = {"safe_match": 0.60, "adjacent_discovery": 0.30, "wildcard": 0.10}
    elif novelty_level == 3:
        ratios = {"safe_match": 0.40, "adjacent_discovery": 0.40, "wildcard": 0.20}
    else:
        ratios = {"safe_match": 0.25, "adjacent_discovery": 0.40, "wildcard": 0.35}

    buckets = {"safe_match": [], "adjacent_discovery": [], "wildcard": []}
    for item in scored_tracks:
        buckets[item["group"]].append(item)
    for group in buckets:
        buckets[group].sort(key=lambda x: x["confidence_score"], reverse=True)

    quotas = {group: int(round(max_items * ratio)) for group, ratio in ratios.items()}
    while sum(quotas.values()) < max_items:
        quotas["adjacent_discovery"] += 1
    while sum(quotas.values()) > max_items:
        largest = max(quotas, key=quotas.get)
        quotas[largest] -= 1

    selected, used = [], set()
    def key(item):
        return (item["track_title"].lower(), item["artist"].lower())

    for group in ["safe_match", "adjacent_discovery", "wildcard"]:
        for item in buckets[group][:quotas[group]]:
            if key(item) not in used:
                selected.append(item)
                used.add(key(item))

    for item in scored_tracks:
        if len(selected) >= max_items:
            break
        if key(item) not in used:
            selected.append(item)
            used.add(key(item))

    group_order = {"safe_match": 0, "adjacent_discovery": 1, "wildcard": 2}
    selected.sort(key=lambda x: (group_order.get(x["group"], 9), -x["confidence_score"]))
    return selected[:max_items]


def _personal_setup(personal_memory):
    """Return (blocked_keys, boost_genres, reduce_genres, boost_artists, reduce_artists)."""
    pm = personal_memory or {}
    blocked = set()
    for b in pm.get("blocked_tracks", []):
        blocked.add((str(b.get("artist", "")).strip().lower(),
                     str(b.get("track_title", "")).strip().lower()))
    lower = lambda xs: {str(x).strip().lower() for x in (xs or [])}
    return (blocked, lower(pm.get("boosted_genres")), lower(pm.get("reduced_genres")),
            lower(pm.get("boosted_artists")), lower(pm.get("reduced_artists")))


def _personal_delta(track, boost_g, reduce_g, boost_a, reduce_a):
    genres = {str(g).strip().lower() for g in track.get("genres", [])}
    artist = str(track.get("artist", "")).strip().lower()
    delta = 0.0
    if genres & boost_g:
        delta += min(0.10, 0.05 * len(genres & boost_g))
    if genres & reduce_g:
        delta -= min(0.10, 0.05 * len(genres & reduce_g))
    if artist in boost_a:
        delta += 0.06
    if artist in reduce_a:
        delta -= 0.06
    return max(-0.15, min(0.15, delta))


def generate_recommendations(taste_profile, mood, task, novelty, max_items=9, catalog_path=None,
                             feedback_path=None, use_feedback=True, genre_constraints=None,
                             personal_memory=None):
    novelty_distance = map_novelty_to_distance(novelty)
    feedback_signals = load_feedback_signals(feedback_path) if use_feedback else None
    feedback_records = feedback_signals["records_used"] if feedback_signals else 0
    feedback_shift = feedback_signals["novelty_shift"] if feedback_signals else 0.0
    adaptive_dna = build_adaptive_dna([], feedback_path or DEFAULT_FEEDBACK_PATH) if (use_feedback and build_adaptive_dna) else None
    if adaptive_dna:
        feedback_shift = clamp(feedback_shift + adaptive_dna.get("novelty_shift", 0.0), -0.20, 0.20)
    if feedback_shift:
        novelty_distance = clamp(novelty_distance + feedback_shift, 0.05, 1.0)
    candidates = load_candidate_catalog(catalog_path)

    blocked, boost_g, reduce_g, boost_a, reduce_a = _personal_setup(personal_memory)
    personal_blocked = 0
    personal_adjusted = 0

    constraints = normalize_constraints(genre_constraints)
    taxonomy = get_taxonomy() if constraints is not None else None
    filtered_out = 0
    scored_tracks = []

    for track in candidates:
        if blocked and (str(track.get("artist", "")).strip().lower(),
                        str(track.get("track_title", "")).strip().lower()) in blocked:
            personal_blocked += 1
            continue
        assess = assess_genre(track.get("genres", []), constraints, taxonomy) if constraints else None
        if assess is not None and not assess["kept"]:
            filtered_out += 1
            continue
        scoring = score_track(track, taste_profile, mood, task, novelty_distance, feedback_signals,
                              constraints=constraints, taxonomy=taxonomy, assess=assess, adaptive_dna=adaptive_dna)
        if personal_memory:
            pd = _personal_delta(track, boost_g, reduce_g, boost_a, reduce_a)
            if pd:
                personal_adjusted += 1
                scoring["personal_adjustment"] = round(pd, 3)
                scoring["total_score"] = round(clamp(scoring.get("total_score", 0) + pd), 3)
                scoring["confidence_score"] = int(max(0, min(100, scoring["confidence_score"] + round(pd * 100))))
        group = assign_group(scoring, novelty_distance)
        explanations = generate_explanation(track, scoring, group, task, mood, novelty)
        entry = {
            "track_title": track["track_title"],
            "artist": track["artist"],
            "genres": track.get("genres", []),
            "group": group,
            "confidence_score": scoring["confidence_score"],
            "why_like": explanations["why_like"],
            "why_not_like": explanations["why_not_like"],
            "mood_match": scoring["mood_match_score"],
            "task_match": scoring["task_match_score"],
            "novelty_level": scoring["track_novelty"],
            "experimental_distance": novelty_distance,
            "explanation": explanations["explanation"],
            "search_links": build_search_links(track),
            "scoring_breakdown": scoring,
        }
        if constraints is not None:
            entry["genre_reasoning"] = build_genre_reasoning(assess, constraints)
        scored_tracks.append(entry)

    scored_tracks.sort(key=lambda x: x["confidence_score"], reverse=True)
    recommendations = select_diverse_recommendations(scored_tracks, max_items, novelty)

    # V2.6 quality instrumentation: evaluation is observational only and never
    # changes ranking, preserving backward compatibility.
    quality_report = None
    try:
        from recommendation_quality import evaluate as evaluate_quality
        quality_report = evaluate_quality(recommendations, candidates, label="top_k")
    except Exception:
        quality_report = None

    top_genres = ", ".join(g.get("genre", "") for g in taste_profile.get("core_genres", [])[:3]) or "not enough genre data"
    parameters = {
        "mood_score": mood,
        "mood_label": MOOD_LABELS.get(int(round(mood)), "custom mood"),
        "task": task,
        "novelty_level": novelty,
        "novelty_label": NOVELTY_LABELS.get(novelty, "custom novelty"),
        "novelty_distance": novelty_distance,
        "candidate_catalog": str(catalog_path or DEFAULT_CATALOG_PATH),
        "candidate_pool_size": len(candidates),
        "candidates_after_genre_filter": len(scored_tracks),
        "feedback_records_used": feedback_records,
        "feedback_novelty_shift": round(feedback_shift, 3),
        "adaptive_learning": {"version": adaptive_dna.get("version"), "evidence_count": adaptive_dna.get("evidence_count"), "confidence": adaptive_dna.get("confidence")} if adaptive_dna else None,
    }
    if personal_memory:
        parameters["personal_memory_applied"] = {
            "blocked_tracks_removed": personal_blocked,
            "tracks_adjusted": personal_adjusted,
            "boosted_genres": sorted(boost_g)[:8],
            "reduced_genres": sorted(reduce_g)[:8],
        }
    if constraints is not None:
        parameters["genre_constraints"] = {
            k: constraints[k] for k in (
                "selected_families", "selected_subgenres", "selected_microgenres",
                "exclude_genres", "strictness", "discovery_direction", *_PREF_KEYS)
        }
        parameters["genre_filtered_out"] = filtered_out
    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "parameters": parameters,
        "music_dna_summary": (
            f"Your Music DNA is {taste_profile.get('emotional_tone', 'balanced')} with "
            f"energy {taste_profile.get('energy_level', 0.5):.2f}/1.0. "
            f"Top genre signals: {top_genres}."
        ),
        "recommendations": recommendations,
        "feedback_options": ["like", "save", "replay", "completed", "skip", "not_for_me", "too_similar", "too_strange", "more_like_this"],
        "dna_change_explanations": explain_changes(adaptive_dna) if (adaptive_dna and explain_changes) else [],
        "quality_lab": quality_report,
    }
    return output


def main():
    parser = argparse.ArgumentParser(description="Generate explainable music recommendations from taste profile.")
    parser.add_argument("taste_profile", help="Path to taste profile JSON file.")
    parser.add_argument("--mood", type=float, required=True, help="Mood score from -2 to +2.")
    parser.add_argument("--task", type=str, required=True, help="Task/use-case, e.g. workout, night_drive.")
    parser.add_argument("--novelty", type=int, required=True, help="Novelty level from 1 to 5.")
    parser.add_argument("--max", type=int, default=9, help="Maximum recommendations.")
    parser.add_argument("--catalog", type=str, default=str(DEFAULT_CATALOG_PATH), help="Candidate catalog JSON file.")
    parser.add_argument("--output", type=str, default=None, help="Output JSON file path.")
    parser.add_argument("--feedback", type=str, default=None,
                        help=f"Feedback JSONL path (default: {DEFAULT_FEEDBACK_PATH} when it exists).")
    parser.add_argument("--no-feedback", action="store_true", help="Ignore saved feedback entirely.")
    # Deep genre direction (V4). All optional; omitting them keeps legacy behavior.
    parser.add_argument("--genre-families", type=str, default="",
                        help="Comma-separated genre families, e.g. 'metal,ambient'.")
    parser.add_argument("--genre-subgenres", type=str, default="",
                        help="Comma-separated subgenres, e.g. 'atmospheric black metal,dark ambient'.")
    parser.add_argument("--genre-microgenres", type=str, default="",
                        help="Comma-separated microgenres/free tags.")
    parser.add_argument("--exclude-genres", type=str, default="",
                        help="Comma-separated genres to exclude, e.g. 'metalcore,deathcore'.")
    parser.add_argument("--strictness", choices=sorted(GENRE_STRICTNESS), default=None,
                        help="soft | balanced | strict (default balanced when any genre constraint is set).")
    parser.add_argument("--discovery", choices=sorted(GENRE_DISCOVERY), default=None,
                        help="inside | adjacent | cross_genre (default adjacent).")
    parser.add_argument("--prefer-obscure", action="store_true")
    parser.add_argument("--prefer-popular", action="store_true")
    parser.add_argument("--prefer-instrumental", action="store_true")
    parser.add_argument("--prefer-vocal", action="store_true")
    parser.add_argument("--prefer-ukrainian", action="store_true")
    parser.add_argument("--request-json", type=str, default=None,
                        help="Path to a JSON file with a 'genre_constraints' object (overrides the flags).")
    parser.add_argument("--personal-memory", type=str, default=None,
                        help="Path to a personal-memory JSON (blocked_tracks, boosted/reduced genres+artists).")
    args = parser.parse_args()

    if not (-2 <= args.mood <= 2):
        print("Error: mood must be between -2 and +2.")
        sys.exit(1)
    if not (1 <= args.novelty <= 5):
        print("Error: novelty must be between 1 and 5.")
        sys.exit(1)

    taste_profile = json.loads(Path(args.taste_profile).read_text(encoding="utf-8"))

    # Assemble deep-genre constraints from --request-json and/or the CLI flags.
    def _split(s):
        return [p.strip() for p in str(s).replace(";", ",").split(",") if p.strip()]

    genre_constraints = None
    if args.request_json:
        req = json.loads(Path(args.request_json).read_text(encoding="utf-8"))
        genre_constraints = req.get("genre_constraints", req) if isinstance(req, dict) else None
    cli_constraints = {
        "selected_families": _split(args.genre_families),
        "selected_subgenres": _split(args.genre_subgenres),
        "selected_microgenres": _split(args.genre_microgenres),
        "exclude_genres": _split(args.exclude_genres),
    }
    if args.strictness:
        cli_constraints["strictness"] = args.strictness
    if args.discovery:
        cli_constraints["discovery_direction"] = args.discovery
    for key in _PREF_KEYS:
        if getattr(args, key, False):
            cli_constraints[key] = True
    # Merge: request-json provides a base; explicit CLI values override non-empty.
    if genre_constraints is None:
        genre_constraints = cli_constraints
    else:
        for k, v in cli_constraints.items():
            if v:
                genre_constraints[k] = v

    personal_memory = None
    if args.personal_memory:
        try:
            personal_memory = json.loads(Path(args.personal_memory).read_text(encoding="utf-8"))
        except (OSError, ValueError):
            personal_memory = None
    output = generate_recommendations(taste_profile, args.mood, args.task, args.novelty, args.max, args.catalog,
                                      feedback_path=args.feedback, use_feedback=not args.no_feedback,
                                      genre_constraints=genre_constraints, personal_memory=personal_memory)
    if output["parameters"]["feedback_records_used"]:
        print(f"Feedback applied: {output['parameters']['feedback_records_used']} records "
              f"(novelty shift {output['parameters']['feedback_novelty_shift']:+.3f}).")

    if args.output:
        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        Path(args.output).write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Recommendations written to: {args.output}")
    else:
        print(json.dumps(output, indent=2, ensure_ascii=False))

    groups = {"safe_match": 0, "adjacent_discovery": 0, "wildcard": 0}
    for rec in output["recommendations"]:
        groups[rec["group"]] += 1
    print(f"Summary: {groups['safe_match']} Safe Match | {groups['adjacent_discovery']} Adjacent Discovery | {groups['wildcard']} Wildcard")


if __name__ == "__main__":
    main()
