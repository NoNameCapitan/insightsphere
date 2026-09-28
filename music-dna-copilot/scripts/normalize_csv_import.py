#!/usr/bin/env python3
"""
normalize_csv_import.py
=======================
Generic CSV importer for local/manual listening history.

Usage:
    python scripts/normalize_csv_import.py examples/sample_csv_import.csv outputs/normalized_csv.json

Required columns:
    - track_name
    - artist_name

Optional columns:
    - album_name
    - played_at
    - play_count
    - genres                   (semicolon or comma separated)
    - duration_ms
    - energy
    - valence
    - danceability
    - tempo
    - acousticness
    - instrumentalness
    - time_range               (short_term, medium_term, long_term)
"""

import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

AUDIO_FEATURES = ["energy", "valence", "danceability", "tempo", "acousticness", "instrumentalness"]


def parse_float(value):
    if value is None or str(value).strip() == "":
        return None
    try:
        return float(value)
    except ValueError:
        return None


def parse_int(value):
    if value is None or str(value).strip() == "":
        return None
    try:
        return int(float(value))
    except ValueError:
        return None


def parse_genres(value: str) -> list[str]:
    if not value:
        return []
    separator = ";" if ";" in value else ","
    return [g.strip().lower() for g in value.split(separator) if g.strip()]


def normalize_csv(input_path: Path) -> dict:
    tracks = []
    with input_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            raise ValueError("CSV has no header row.")

        required = {"track_name", "artist_name"}
        missing = required - set(reader.fieldnames)
        if missing:
            raise ValueError(f"Missing required columns: {', '.join(sorted(missing))}")

        for row_number, row in enumerate(reader, start=2):
            track_name = (row.get("track_name") or "").strip()
            artist_name = (row.get("artist_name") or "").strip()
            if not track_name or not artist_name:
                print(f"Warning: skipping row {row_number}; track_name or artist_name is empty.")
                continue

            track = {
                "track_name": track_name,
                "artist_name": artist_name,
            }

            for key in ["album_name", "played_at", "time_range"]:
                value = (row.get(key) or "").strip()
                if value:
                    track[key] = value

            play_count = parse_int(row.get("play_count"))
            if play_count is not None and play_count > 0:
                track["play_count"] = play_count

            duration_ms = parse_int(row.get("duration_ms"))
            if duration_ms is not None and duration_ms >= 0:
                track["duration_ms"] = duration_ms

            genres = parse_genres(row.get("genres", ""))
            if genres:
                track["genres"] = genres

            audio_features = {}
            for feature in AUDIO_FEATURES:
                parsed = parse_float(row.get(feature))
                if parsed is not None:
                    audio_features[feature] = parsed
            if audio_features:
                track["audio_features"] = audio_features

            tracks.append(track)

    return {
        "source": "csv",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "tracks": tracks,
    }


def main() -> None:
    if len(sys.argv) != 3:
        print("Usage: python scripts/normalize_csv_import.py <input.csv> <output.json>")
        sys.exit(1)

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])

    try:
        normalized = normalize_csv(input_path)
    except Exception as exc:
        print(f"Error: {exc}")
        sys.exit(1)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(normalized, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Normalized {len(normalized['tracks'])} tracks from CSV.")
    print(f"Output written to: {output_path}")


if __name__ == "__main__":
    main()
