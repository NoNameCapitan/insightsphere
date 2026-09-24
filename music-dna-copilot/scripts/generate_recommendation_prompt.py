#!/usr/bin/env python3
"""
generate_recommendation_prompt.py
==================================
Converts a taste profile and user settings into a clean LLM prompt
for generating music recommendations.

Usage:
    python generate_recommendation_prompt.py <taste_profile.json> --mood <score> --task <task> --novelty <level>

This script does NOT call an LLM directly. It outputs a ready-to-use prompt
that can be sent to any LLM (GPT-4, Claude, Gemini, etc.) for recommendation generation.

The prompt is designed to:
    - Provide full context about the user's taste
    - Specify the mood, task, and novelty constraints
    - Request structured, explainable output
    - Enforce the Safe Match / Adjacent Discovery / Wildcard grouping
"""

import json
import sys
import argparse


def build_taste_summary(taste_profile: dict) -> str:
    """Build a concise summary of the user's taste for the LLM prompt."""
    sections = []

    # Core genres
    genres = taste_profile.get("core_genres", [])
    if genres:
        top_genres = [f"{g['genre']} ({g['affinity_score']:.0%})" for g in genres[:7]]
        sections.append(f"Core Genres: {', '.join(top_genres)}")

    # Recurring artists
    artists = taste_profile.get("recurring_artists", [])
    if artists:
        top_artists = [a["artist_name"] for a in artists[:10]]
        sections.append(f"Recurring Artists: {', '.join(top_artists)}")

    # Mood profile
    mood = taste_profile.get("mood_profile", {})
    if mood:
        sections.append(
            f"Mood Profile: average valence {mood.get('average_valence', 0.5):.2f}, "
            f"average energy {mood.get('average_energy', 0.5):.2f}, "
            f"dominant moods: {', '.join(mood.get('dominant_moods', ['balanced']))}"
        )

    # Energy level
    energy = taste_profile.get("energy_level", 0.5)
    sections.append(f"Energy Level: {energy:.2f}/1.0")

    # Novelty tolerance
    novelty = taste_profile.get("novelty_tolerance", 0.5)
    sections.append(f"Novelty Tolerance: {novelty:.2f}/1.0 ({'adventurous' if novelty > 0.6 else 'conservative' if novelty < 0.4 else 'moderate'})")

    # Emotional tone
    tone = taste_profile.get("emotional_tone", "balanced")
    sections.append(f"Emotional Tone: {tone}")

    # Taste drift
    drift = taste_profile.get("taste_drift", {})
    if drift:
        new_patterns = drift.get("new_patterns", [])
        stable = drift.get("stable_patterns", [])
        if new_patterns:
            sections.append(f"Recent New Interests: {', '.join(new_patterns[:5])}")
        if stable:
            sections.append(f"Stable Long-term Taste: {', '.join(stable[:5])}")

    return "\n".join(sections)


def map_mood_to_description(mood_score: float) -> str:
    """Convert mood score to a human-readable description."""
    if mood_score <= -1.5:
        return "very dark, melancholic, heavy, introspective"
    elif mood_score <= -0.5:
        return "calm, sad, reflective"
    elif mood_score <= 0.5:
        return "neutral, balanced"
    elif mood_score <= 1.5:
        return "energetic, bright, motivating"
    else:
        return "euphoric, danceable, uplifting"


def map_novelty_to_description(novelty_level: int) -> str:
    """Convert novelty level to a human-readable description."""
    descriptions = {
        1: "Only recommend music very similar to what the user already listens to.",
        2: "Recommend mostly familiar music with slight variations.",
        3: "Balance between familiar and new discoveries.",
        4: "Lean towards experimental and less obvious choices.",
        5: "Surprise the user with unexpected but potentially enjoyable music."
    }
    return descriptions.get(novelty_level, descriptions[3])


def build_prompt(taste_profile: dict, mood_score: float, task: str, novelty_level: int,
                 max_recommendations: int = 15, language: str = "en") -> str:
    """
    Build the complete LLM prompt for music recommendation generation.
    """
    taste_summary = build_taste_summary(taste_profile)
    mood_description = map_mood_to_description(mood_score)
    novelty_description = map_novelty_to_description(novelty_level)
    novelty_distance = 0.1 + (novelty_level - 1) * 0.225

    prompt = f"""You are an expert music recommendation engine. Based on the user's Music DNA profile and current parameters, generate {max_recommendations} track recommendations.

## User's Music DNA Profile
{taste_summary}

## Current Parameters
- **Mood**: {mood_score}/2 ({mood_description})
- **Task**: {task.replace('_', ' ').title()}
- **Novelty Level**: {novelty_level}/5 — {novelty_description}
- **Novelty Distance**: {novelty_distance:.2f} (0.1 = very familiar, 1.0 = very experimental)

## Output Requirements
Group recommendations into exactly three categories:

### 1. Safe Match (approximately 40% of recommendations)
Tracks very close to the user's existing taste. High genre affinity, possibly known artists.

### 2. Adjacent Discovery (approximately 40% of recommendations)
Tracks that are new but clearly connected to the user's taste. Different artists in similar genres, or same artists in different styles.

### 3. Wildcard (approximately 20% of recommendations)
More experimental picks that still have an explainable connection to the user's taste.

## For Each Recommendation, Provide:
1. **Track Title** and **Artist**
2. **Group** (safe_match / adjacent_discovery / wildcard)
3. **Confidence Score** (0-100): How confident you are the user will enjoy this
4. **Why they may like it**: One sentence explaining the positive match
5. **Why they may not like it**: One sentence about potential mismatch
6. **Mood Match** (0-1): How well it matches the requested mood
7. **Task Match** (0-1): How well it fits the requested task
8. **Novelty Level** (0-1): How novel this is relative to user's taste
9. **Short Explanation**: A brief, plain-language reason for this recommendation

## Important Rules
- Do NOT recommend tracks the user clearly already knows (from recurring artists) unless they are in Safe Match.
- Ensure variety across the recommendation set.
- Prioritize tracks that genuinely fit the mood "{mood_description}" and the task "{task.replace('_', ' ')}".
- Explain your reasoning transparently. No black-box logic.
- Output in {"the user's preferred language" if language != "en" else "English"}.

## Output Format
Return a valid JSON array of recommendation objects following this structure:
```json
[
  {{
    "track_title": "...",
    "artist": "...",
    "group": "safe_match|adjacent_discovery|wildcard",
    "confidence_score": 0-100,
    "why_like": "...",
    "why_not_like": "...",
    "mood_match": 0.0-1.0,
    "task_match": 0.0-1.0,
    "novelty_level": 0.0-1.0,
    "explanation": "..."
  }}
]
```
"""
    return prompt


def main():
    parser = argparse.ArgumentParser(
        description="Generate an LLM prompt for music recommendations."
    )
    parser.add_argument("taste_profile", help="Path to taste profile JSON file.")
    parser.add_argument("--mood", type=float, required=True, help="Mood score from -2 to +2.")
    parser.add_argument("--task", type=str, required=True, help="Task/use-case.")
    parser.add_argument("--novelty", type=int, required=True, help="Novelty level from 1 to 5.")
    parser.add_argument("--max", type=int, default=15, help="Max recommendations (default: 15).")
    parser.add_argument("--language", type=str, default="en", help="Output language (en/ru/uk/es/de).")
    parser.add_argument("--output", type=str, default=None, help="Save prompt to file.")

    args = parser.parse_args()

    # Read taste profile
    with open(args.taste_profile, "r", encoding="utf-8") as f:
        taste_profile = json.load(f)

    # Build prompt
    prompt = build_prompt(
        taste_profile=taste_profile,
        mood_score=args.mood,
        task=args.task,
        novelty_level=args.novelty,
        max_recommendations=args.max,
        language=args.language
    )

    # Output
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(prompt)
        print(f"Prompt saved to: {args.output}")
        print(f"Prompt length: {len(prompt)} characters")
    else:
        print(prompt)


if __name__ == "__main__":
    main()
