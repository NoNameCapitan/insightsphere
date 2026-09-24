#!/usr/bin/env python3
"""
export_portable_dna.py
======================
Build a portable, multi-source Music DNA package you can keep, share,
or paste into any AI assistant. Includes the taste profile, source
coverage, profile confidence, avoid-list derived from your local
feedback, and the run settings.

Outputs:
    outputs/portable_music_dna.json
    outputs/portable_music_dna.md
    outputs/portable_music_dna_prompt.md

Usage (defaults read the latest local run from outputs/):
    python scripts/export_portable_dna.py \
        [--profile outputs/local_taste_profile.json] \
        [--coverage outputs/source_coverage.json] \
        [--recs outputs/local_recommendations.json] \
        [--feedback outputs/feedback.jsonl]
"""

import argparse
import json
import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
ROOT = SCRIPTS.parents[0]
sys.path.insert(0, str(SCRIPTS))

from source_common import OUTPUTS, now_iso  # noqa: E402


def load_json(path):
    path = Path(path)
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def build_avoid_list(feedback_path):
    """Artists/genres the user marked 'not for me' (2+ times for genres)."""
    path = Path(feedback_path)
    avoid_artists, genre_hits = set(), {}
    if not path.exists():
        return {"artists": [], "genres": []}
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            record = json.loads(line)
        except json.JSONDecodeError:
            continue
        if record.get("action") != "not_for_me":
            continue
        if record.get("artist"):
            avoid_artists.add(str(record["artist"]))
        for genre in record.get("genres", []) or []:
            genre_hits[str(genre).lower()] = genre_hits.get(str(genre).lower(), 0) + 1
    return {
        "artists": sorted(avoid_artists),
        "genres": sorted(g for g, n in genre_hits.items() if n >= 2),
    }


def build_portable(profile, coverage=None, recs=None, feedback_path=None):
    params = (recs or {}).get("parameters", {})
    portable = {
        "format": "portable_music_dna",
        "format_version": "1.1",
        "generated_at": now_iso(),
        "music_dna_summary": (recs or {}).get("music_dna_summary")
        or f"Emotional tone: {profile.get('emotional_tone', 'balanced')}.",
        "profile": {
            "emotional_tone": profile.get("emotional_tone"),
            "energy_level": profile.get("energy_level"),
            "mood_profile": profile.get("mood_profile", {}),
            "core_genres": profile.get("core_genres", [])[:10],
            "recurring_artists": profile.get("recurring_artists", [])[:10],
            "taste_drift": profile.get("taste_drift", {}),
        },
        "sources": {
            "sources_used": (coverage or {}).get("sources_used", []),
            "contribution_percent": (coverage or {}).get("contribution_percent", {}),
            "total_tracks": (coverage or {}).get("total_tracks"),
            "unique_artists": (coverage or {}).get("unique_artists"),
            "unique_genres": (coverage or {}).get("unique_genres"),
            "confidence_level": (coverage or {}).get("confidence_level", "Unknown"),
            "confidence_reasons": (coverage or {}).get("confidence_reasons", []),
        },
        "avoid_list": build_avoid_list(feedback_path or OUTPUTS / "feedback.jsonl"),
        "last_run_settings": {
            "mood_score": params.get("mood_score"),
            "mood_label": params.get("mood_label"),
            "task": params.get("task"),
            "novelty_level": params.get("novelty_level"),
            "novelty_label": params.get("novelty_label"),
        } if params else {},
        "notes": "Generated locally by Music DNA Copilot. No cloud involved.",
    }
    return portable


def to_markdown(portable):
    p, s = portable["profile"], portable["sources"]
    lines = [
        "# Portable Music DNA",
        "",
        f"Generated: {portable['generated_at']}",
        "",
        f"**Summary:** {portable['music_dna_summary']}",
        "",
        "## Profile",
        f"- Emotional tone: {p.get('emotional_tone')}",
        f"- Energy: {p.get('energy_level')}",
        f"- Core genres: {', '.join(g.get('genre', '') for g in p.get('core_genres', [])) or '-'}",
        f"- Recurring artists: {', '.join(a.get('artist_name', '') for a in p.get('recurring_artists', [])) or '-'}",
        "",
        "## Sources & coverage",
    ]
    for source, pct in (s.get("contribution_percent") or {}).items():
        lines.append(f"- {source}: {pct}%")
    lines += [
        f"- Tracks analyzed: {s.get('total_tracks')}",
        f"- Unique artists: {s.get('unique_artists')} · unique genres: {s.get('unique_genres')}",
        f"- **Profile confidence: {s.get('confidence_level')}**"
        + (f" ({', '.join(s.get('confidence_reasons', []))})" if s.get("confidence_reasons") else ""),
        "",
    ]
    avoid = portable.get("avoid_list", {})
    if avoid.get("artists") or avoid.get("genres"):
        lines += ["## Avoid list (from local feedback)",
                  f"- Artists: {', '.join(avoid.get('artists', [])) or '-'}",
                  f"- Genres: {', '.join(avoid.get('genres', [])) or '-'}", ""]
    settings = portable.get("last_run_settings", {})
    if settings:
        lines += ["## Last run settings",
                  f"- Mood: {settings.get('mood_label')} · Task: {settings.get('task')} · "
                  f"Experimentality: {settings.get('novelty_label')}", ""]
    return "\n".join(lines)


def to_prompt(portable):
    return (
        "You are a music recommendation expert. Below is my portable Music DNA "
        "profile, generated locally from my real listening data across several "
        "sources. Use it to recommend music that fits me.\n\n"
        "Rules:\n"
        "- Respect the profile confidence: if it is Medium or Low, ask me 1-2 "
        "clarifying questions before going deep.\n"
        "- Never recommend artists or genres from the avoid list.\n"
        "- Group recommendations into Safe Match / Adjacent Discovery / Wildcard.\n"
        "- For every pick explain briefly why it fits my profile (genres, tone, "
        "energy) and name one possible mismatch.\n\n"
        "MY MUSIC DNA:\n```json\n"
        + json.dumps(portable, indent=2, ensure_ascii=False)
        + "\n```\n"
    )


def export_portable(profile_path, coverage_path, recs_path, feedback_path, out_dir=None):
    profile = load_json(profile_path)
    if not profile:
        raise FileNotFoundError(f"Taste profile not found: {profile_path}. Run an analysis first.")
    portable = build_portable(profile, load_json(coverage_path), load_json(recs_path), feedback_path)
    out_dir = Path(out_dir) if out_dir else OUTPUTS
    out_dir.mkdir(exist_ok=True)
    paths = {
        "json": out_dir / "portable_music_dna.json",
        "md": out_dir / "portable_music_dna.md",
        "prompt": out_dir / "portable_music_dna_prompt.md",
    }
    paths["json"].write_text(json.dumps(portable, indent=2, ensure_ascii=False), encoding="utf-8")
    paths["md"].write_text(to_markdown(portable), encoding="utf-8")
    paths["prompt"].write_text(to_prompt(portable), encoding="utf-8")
    return portable, paths


def main():
    parser = argparse.ArgumentParser(description="Export a portable multi-source Music DNA package.")
    parser.add_argument("--profile", default=str(OUTPUTS / "local_taste_profile.json"))
    parser.add_argument("--coverage", default=str(OUTPUTS / "source_coverage.json"))
    parser.add_argument("--recs", default=str(OUTPUTS / "local_recommendations.json"))
    parser.add_argument("--feedback", default=str(OUTPUTS / "feedback.jsonl"))
    args = parser.parse_args()
    try:
        portable, paths = export_portable(args.profile, args.coverage, args.recs, args.feedback)
    except FileNotFoundError as exc:
        print(f"Error: {exc}")
        sys.exit(1)
    print(f"Portable Music DNA written ({portable['sources'].get('confidence_level')} confidence):")
    for path in paths.values():
        print(f"  {path}")


if __name__ == "__main__":
    main()
