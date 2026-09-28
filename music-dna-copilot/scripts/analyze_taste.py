#!/usr/bin/env python3
"""
analyze_taste.py
================
Reads normalized listening history and generates a Music DNA taste profile.

Usage:
    python analyze_taste.py <normalized_history.json> <output_taste_profile.json>

This script calculates:
    - Genre affinity (based on genre tags)
    - Artist recurrence (most listened artists)
    - Track repetition patterns
    - Mood profile (based on audio features or genre heuristics)
    - Novelty tolerance (ratio of unique vs repeated tracks)
    - Mainstream vs niche tendency (if popularity data exists)
    - Short-term vs long-term taste comparison (taste drift)
    - Energy level
    - Emotional tone
    - Possible content use cases

Output:
    A JSON file conforming to schemas/taste_profile.schema.json.
"""

import json
import sys
from collections import Counter
from datetime import datetime, timezone


# ============================================================
# LISTENING WEIGHT
# Each history row represents one or more listening events. When a
# source provides `play_count` (Last.fm, CSV, manual aggregates), one
# row can stand for many plays, so the analysis must weight by it
# instead of treating every row as a single play. Rows without
# play_count count as a single listening event.
# ============================================================

def play_weight(track: dict) -> int:
    """Number of listening events a row represents (>= 1)."""
    raw = track.get("play_count", 1)
    try:
        weight = int(raw)
    except (TypeError, ValueError):
        return 1
    return weight if weight >= 1 else 1


def total_listening_events(tracks: list) -> int:
    return sum(play_weight(t) for t in tracks)


# ============================================================
# GENRE HEURISTICS
# Maps genre keywords to mood/energy characteristics.
# Used when audio features are not available.
# ============================================================
GENRE_MOOD_MAP = {
    "metal": {"valence": 0.3, "energy": 0.9},
    "death metal": {"valence": 0.2, "energy": 0.95},
    "black metal": {"valence": 0.15, "energy": 0.9},
    "punk": {"valence": 0.4, "energy": 0.85},
    "rock": {"valence": 0.5, "energy": 0.7},
    "indie": {"valence": 0.5, "energy": 0.5},
    "pop": {"valence": 0.7, "energy": 0.6},
    "dance": {"valence": 0.8, "energy": 0.85},
    "electronic": {"valence": 0.6, "energy": 0.75},
    "hip hop": {"valence": 0.55, "energy": 0.7},
    "rap": {"valence": 0.5, "energy": 0.75},
    "r&b": {"valence": 0.6, "energy": 0.5},
    "soul": {"valence": 0.6, "energy": 0.45},
    "jazz": {"valence": 0.55, "energy": 0.4},
    "classical": {"valence": 0.5, "energy": 0.3},
    "ambient": {"valence": 0.5, "energy": 0.2},
    "folk": {"valence": 0.55, "energy": 0.35},
    "country": {"valence": 0.6, "energy": 0.5},
    "blues": {"valence": 0.4, "energy": 0.45},
    "reggae": {"valence": 0.7, "energy": 0.5},
    "lo-fi": {"valence": 0.5, "energy": 0.3},
    "synthwave": {"valence": 0.6, "energy": 0.65},
    "shoegaze": {"valence": 0.4, "energy": 0.5},
    "post-punk": {"valence": 0.35, "energy": 0.6},
}

# Task-to-characteristics mapping for use-case suggestions
TASK_CHARACTERISTICS = {
    "work_focus": {"energy_range": (0.2, 0.5), "valence_range": (0.4, 0.7)},
    "workout": {"energy_range": (0.7, 1.0), "valence_range": (0.5, 1.0)},
    "night_drive": {"energy_range": (0.4, 0.7), "valence_range": (0.3, 0.6)},
    "relaxation": {"energy_range": (0.1, 0.4), "valence_range": (0.4, 0.8)},
    "party": {"energy_range": (0.7, 1.0), "valence_range": (0.7, 1.0)},
}


def calculate_genre_affinity(tracks: list) -> list:
    """
    Calculate genre affinity scores, weighted by listening events.

    Each track contributes `play_count` (default 1) to every genre it
    carries, so a track played 40 times counts far more than one played
    once. Scores are normalized to 0-1 relative to the strongest genre.

    Returns a sorted list of {genre, affinity_score} dicts.
    """
    genre_counter = Counter()

    for track in tracks:
        weight = play_weight(track)
        for genre in track.get("genres", []):
            genre_counter[genre.lower()] += weight

    total = sum(genre_counter.values())
    if total == 0:
        return []

    # Normalize to 0-1 scale relative to the top genre
    max_count = genre_counter.most_common(1)[0][1] if genre_counter else 1

    result = []
    for genre, count in genre_counter.most_common(20):
        result.append({
            "genre": genre,
            "affinity_score": round(count / max_count, 3)
        })

    return result


def calculate_artist_recurrence(tracks: list) -> list:
    """
    Calculate artist recurrence scores, weighted by listening events.

    An artist's weight is the sum of `play_count` across their tracks
    (default 1 per row), so frequently replayed artists rank highest.
    `play_count` in the result is that summed listening total.

    Returns top 15 recurring artists.
    """
    artist_counter = Counter()

    for track in tracks:
        artist = track.get("artist_name", "Unknown")
        artist_counter[artist] += play_weight(track)

    if not artist_counter:
        return []

    max_count = artist_counter.most_common(1)[0][1]

    result = []
    for artist, count in artist_counter.most_common(15):
        result.append({
            "artist_name": artist,
            "recurrence_score": round(count / max_count, 3),
            "play_count": count
        })

    return result


def calculate_mood_profile(tracks: list, genre_affinity: list) -> dict:
    """
    Calculate mood profile from audio features or genre heuristics.

    If audio features are available, use average valence and energy.
    Otherwise, estimate from genre-mood mapping.
    """
    valences = []
    energies = []

    # Try audio features first, weighted by how often the track was played.
    for track in tracks:
        af = track.get("audio_features")
        if af:
            weight = play_weight(track)
            if "valence" in af:
                valences.extend([af["valence"]] * weight)
            if "energy" in af:
                energies.extend([af["energy"]] * weight)

    # If no audio features, use genre heuristics
    if not valences:
        for ga in genre_affinity:
            genre = ga["genre"]
            score = ga["affinity_score"]
            if genre in GENRE_MOOD_MAP:
                valences.append(GENRE_MOOD_MAP[genre]["valence"] * score)
                energies.append(GENRE_MOOD_MAP[genre]["energy"] * score)

    avg_valence = sum(valences) / len(valences) if valences else 0.5
    avg_energy = sum(energies) / len(energies) if energies else 0.5

    # Determine dominant moods based on valence/energy quadrants
    dominant_moods = []
    if avg_valence < 0.4 and avg_energy > 0.6:
        dominant_moods.append("angry")
        dominant_moods.append("intense")
    elif avg_valence < 0.4 and avg_energy <= 0.6:
        dominant_moods.append("melancholic")
        dominant_moods.append("reflective")
    elif avg_valence >= 0.6 and avg_energy > 0.6:
        dominant_moods.append("energetic")
        dominant_moods.append("happy")
    elif avg_valence >= 0.6 and avg_energy <= 0.6:
        dominant_moods.append("calm")
        dominant_moods.append("positive")
    else:
        dominant_moods.append("balanced")

    return {
        "average_valence": round(avg_valence, 3),
        "average_energy": round(avg_energy, 3),
        "dominant_moods": dominant_moods
    }


def calculate_repetition_pattern(tracks: list) -> dict:
    """
    Calculate repetition patterns from listening events.

    Uses `play_count` so an aggregated history (e.g. Last.fm: one row
    with play_count 50) reflects true repetition rather than appearing
    as a single play.

    Formula:
        total_plays  = sum(play_count)
        unique_tracks = distinct (track, artist) rows
        repeat_ratio = 1 - (unique_tracks / total_plays)
        unique_track_ratio = unique_tracks / total_plays
    """
    total_plays = total_listening_events(tracks)
    unique_tracks = len(set(
        (t.get("track_name", ""), t.get("artist_name", ""))
        for t in tracks
    ))

    if total_plays == 0:
        return {"repeat_ratio": 0, "unique_track_ratio": 1}

    unique_ratio = min(1.0, unique_tracks / total_plays)
    repeat_ratio = max(0.0, 1 - unique_ratio)

    return {
        "repeat_ratio": round(repeat_ratio, 3),
        "unique_track_ratio": round(unique_ratio, 3)
    }


def calculate_novelty_tolerance(repetition: dict) -> float:
    """
    Estimate novelty tolerance from repetition patterns.

    Formula:
        novelty_tolerance = unique_track_ratio
        (Higher unique ratio = more open to new music)
    """
    return repetition.get("unique_track_ratio", 0.5)


def calculate_taste_drift(tracks: list) -> dict:
    """
    Compare short-term vs long-term listening behavior.

    Strategy:
        1. If tracks have a `time_range` field (from Spotify API), use it directly.
        2. If tracks have `played_at` timestamps, split into thirds relative to
           the data's own time range (not wall-clock time). This ensures the
           analysis works correctly regardless of when the data was exported.
        3. Fallback: treat the first half as long-term and second half as short-term
           based on list order.

    Identifies:
        - New patterns (genres appearing only in short-term)
        - Disappeared patterns (genres only in long-term)
        - Stable patterns (genres in both)
    """
    short_term_genres = Counter()
    long_term_genres = Counter()

    # First pass: check if time_range field is available
    has_time_range = any(t.get("time_range") for t in tracks)

    if has_time_range:
        # Use Spotify's time_range classification directly
        for track in tracks:
            genres = track.get("genres", [])
            time_range = track.get("time_range", "medium_term")
            weight = play_weight(track)
            for g in genres:
                if time_range == "short_term":
                    short_term_genres[g.lower()] += weight
                elif time_range == "long_term":
                    long_term_genres[g.lower()] += weight
                else:  # medium_term goes to both
                    short_term_genres[g.lower()] += weight
                    long_term_genres[g.lower()] += weight
    else:
        # Use relative date splitting based on the data's own time range
        dated_tracks = []
        undated_tracks = []

        for track in tracks:
            played_at = track.get("played_at", "")
            if played_at:
                try:
                    play_time = datetime.fromisoformat(played_at.replace("Z", "+00:00"))
                    dated_tracks.append((play_time, track))
                except (ValueError, TypeError):
                    undated_tracks.append(track)
            else:
                undated_tracks.append(track)

        if dated_tracks:
            # Sort by date and split into thirds
            dated_tracks.sort(key=lambda x: x[0])
            n = len(dated_tracks)
            third = max(1, n // 3)

            # Oldest third = long-term
            for _, track in dated_tracks[:third]:
                weight = play_weight(track)
                for g in track.get("genres", []):
                    long_term_genres[g.lower()] += weight

            # Newest third = short-term
            for _, track in dated_tracks[-third:]:
                weight = play_weight(track)
                for g in track.get("genres", []):
                    short_term_genres[g.lower()] += weight
        else:
            # No dates at all: split list in half by position
            mid = len(tracks) // 2
            for track in tracks[:mid]:
                weight = play_weight(track)
                for g in track.get("genres", []):
                    long_term_genres[g.lower()] += weight
            for track in tracks[mid:]:
                weight = play_weight(track)
                for g in track.get("genres", []):
                    short_term_genres[g.lower()] += weight

    short_set = set(short_term_genres.keys())
    long_set = set(long_term_genres.keys())

    new_patterns = list(short_set - long_set)
    disappeared = list(long_set - short_set)
    stable = list(short_set & long_set)

    return {
        "short_term_genres": [g for g, _ in short_term_genres.most_common(10)],
        "long_term_genres": [g for g, _ in long_term_genres.most_common(10)],
        "new_patterns": new_patterns[:10],
        "disappeared_patterns": disappeared[:10],
        "stable_patterns": stable[:10]
    }


def determine_emotional_tone(mood_profile: dict) -> str:
    """Determine overall emotional tone from mood profile."""
    valence = mood_profile.get("average_valence", 0.5)
    energy = mood_profile.get("average_energy", 0.5)

    tone_parts = []

    if valence < 0.4:
        tone_parts.append("melancholic")
    elif valence > 0.6:
        tone_parts.append("positive")
    else:
        tone_parts.append("balanced")

    if energy > 0.6:
        tone_parts.append("energetic")
    elif energy < 0.4:
        tone_parts.append("calm")

    return "-".join(tone_parts) if tone_parts else "neutral"


def suggest_use_cases(mood_profile: dict, energy_level: float) -> list:
    """Suggest possible content use cases based on taste characteristics."""
    suggestions = []
    energy = energy_level
    valence = mood_profile.get("average_valence", 0.5)

    if energy > 0.7:
        suggestions.append("Workout playlists")
        suggestions.append("Party music")
    if energy < 0.4:
        suggestions.append("Focus/study music")
        suggestions.append("Relaxation playlists")
    if 0.4 <= energy <= 0.7 and valence < 0.5:
        suggestions.append("Night drive playlists")
    if valence > 0.6:
        suggestions.append("Morning routines")
    if valence < 0.4:
        suggestions.append("Introspective/journaling music")

    suggestions.append("Playlist creation")
    return suggestions


def main():
    if len(sys.argv) < 3:
        print("Usage: python analyze_taste.py <normalized_history.json> <output_taste_profile.json>")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    # Read normalized listening history
    with open(input_path, "r", encoding="utf-8") as f:
        history = json.load(f)

    tracks = history.get("tracks", [])

    if not tracks:
        print("Error: No tracks found in the listening history.")
        sys.exit(1)

    print(f"Analyzing {len(tracks)} track rows ({total_listening_events(tracks)} listening events)...")

    # 1. Genre affinity
    genre_affinity = calculate_genre_affinity(tracks)
    print(f"  - Found {len(genre_affinity)} genres.")

    # 2. Artist recurrence
    recurring_artists = calculate_artist_recurrence(tracks)
    print(f"  - Found {len(recurring_artists)} recurring artists.")

    # 3. Mood profile
    mood_profile = calculate_mood_profile(tracks, genre_affinity)
    print(f"  - Mood: valence={mood_profile['average_valence']}, energy={mood_profile['average_energy']}")

    # 4. Energy level (from mood profile)
    energy_level = mood_profile["average_energy"]

    # 5. Repetition pattern
    repetition = calculate_repetition_pattern(tracks)
    print(f"  - Repeat ratio: {repetition['repeat_ratio']}")

    # 6. Novelty tolerance
    novelty_tolerance = calculate_novelty_tolerance(repetition)
    print(f"  - Novelty tolerance: {novelty_tolerance}")

    # 7. Taste drift
    taste_drift = calculate_taste_drift(tracks)
    print(f"  - New patterns: {len(taste_drift['new_patterns'])}, Disappeared: {len(taste_drift['disappeared_patterns'])}")

    # 8. Emotional tone
    emotional_tone = determine_emotional_tone(mood_profile)

    # 9. Use cases
    use_cases = suggest_use_cases(mood_profile, energy_level)

    # Build taste profile
    taste_profile = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "core_genres": genre_affinity,
        "recurring_artists": recurring_artists,
        "mood_profile": mood_profile,
        "energy_level": round(energy_level, 3),
        "mainstream_vs_niche": 0.5,  # Placeholder; requires popularity data
        "repetition_pattern": repetition,
        "novelty_tolerance": round(novelty_tolerance, 3),
        "taste_drift": taste_drift,
        "emotional_tone": emotional_tone,
        "possible_use_cases": use_cases
    }

    # Write output
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(taste_profile, f, indent=2, ensure_ascii=False)

    print(f"\nMusic DNA profile written to: {output_path}")


if __name__ == "__main__":
    main()
