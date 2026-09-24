#!/usr/bin/env python3
"""
normalize_spotify_export.py
===========================
Normalizes Spotify extended streaming history or API export data
into the common listening_history schema.

Usage:
    python normalize_spotify_export.py <input_file.json> <output_file.json>

Input format:
    Spotify extended streaming history JSON (from privacy data download)
    or Spotify API response (top tracks / recently played).

Output:
    A JSON file conforming to schemas/listening_history.schema.json.

Notes:
    - Does NOT hardcode credentials.
    - Uses placeholders for API-based data.
    - For real OAuth integration, see V2 roadmap.
"""

import json
import sys
from datetime import datetime, timezone


def normalize_extended_streaming_history(raw_data: list) -> dict:
    """
    Normalize Spotify's extended streaming history format.

    Spotify extended history fields typically include:
    - ts: timestamp
    - master_metadata_track_name: track name
    - master_metadata_album_artist_name: artist name
    - master_metadata_album_album_name: album name
    - ms_played: duration played in ms
    """
    tracks = []

    for entry in raw_data:
        # Skip entries with no track name (e.g., podcasts or null entries)
        track_name = entry.get("master_metadata_track_name")
        if not track_name:
            continue

        artist_name = entry.get("master_metadata_album_artist_name", "Unknown Artist")
        album_name = entry.get("master_metadata_album_album_name", "")

        # Parse timestamp
        played_at = entry.get("ts", "")

        # Duration played
        duration_ms = entry.get("ms_played", 0)

        track = {
            "track_name": track_name,
            "artist_name": artist_name,
            "album_name": album_name,
            "played_at": played_at,
            "duration_ms": duration_ms
        }

        tracks.append(track)

    return {
        "source": "spotify",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "tracks": tracks
    }


def normalize_api_top_tracks(raw_data: dict) -> dict:
    """
    Normalize Spotify API /me/top/tracks response.

    Expected structure:
    {
        "items": [
            {
                "name": "Track Name",
                "artists": [{"name": "Artist"}],
                "album": {"name": "Album"},
                "duration_ms": 240000
            }
        ],
        "time_range": "medium_term"
    }
    """
    tracks = []
    time_range = raw_data.get("time_range", "medium_term")

    for item in raw_data.get("items", []):
        track_name = item.get("name", "Unknown Track")
        artists = item.get("artists", [])
        artist_name = artists[0]["name"] if artists else "Unknown Artist"
        album_name = item.get("album", {}).get("name", "")
        duration_ms = item.get("duration_ms", 0)

        track = {
            "track_name": track_name,
            "artist_name": artist_name,
            "album_name": album_name,
            "duration_ms": duration_ms,
            "time_range": time_range
        }

        # Include audio features if present
        if "audio_features" in item:
            af = item["audio_features"]
            track["audio_features"] = {
                "energy": af.get("energy", 0),
                "valence": af.get("valence", 0),
                "danceability": af.get("danceability", 0),
                "tempo": af.get("tempo", 0),
                "acousticness": af.get("acousticness", 0),
                "instrumentalness": af.get("instrumentalness", 0)
            }

        tracks.append(track)

    return {
        "source": "spotify",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "tracks": tracks
    }


def detect_format(data) -> str:
    """Detect whether the input is extended streaming history or API response."""
    if isinstance(data, list):
        # Extended streaming history is a list of objects
        if data and "master_metadata_track_name" in data[0]:
            return "extended_history"
        return "extended_history"  # Default assumption for lists
    elif isinstance(data, dict):
        if "items" in data:
            return "api_top_tracks"
    return "unknown"


def main():
    if len(sys.argv) < 3:
        print("Usage: python normalize_spotify_export.py <input.json> <output.json>")
        print("\nSupported input formats:")
        print("  - Spotify Extended Streaming History (list of play events)")
        print("  - Spotify API /me/top/tracks response (dict with 'items')")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    # Read input file with error handling
    try:
        with open(input_path, "r", encoding="utf-8") as f:
            raw_data = json.load(f)
    except FileNotFoundError:
        print(f"Error: Input file not found: {input_path}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in input file: {e}")
        sys.exit(1)
    except PermissionError:
        print(f"Error: Permission denied reading: {input_path}")
        sys.exit(1)

    # Detect format and normalize
    fmt = detect_format(raw_data)

    if fmt == "extended_history":
        normalized = normalize_extended_streaming_history(raw_data)
        print(f"Normalized {len(normalized['tracks'])} tracks from Spotify extended history.")
    elif fmt == "api_top_tracks":
        normalized = normalize_api_top_tracks(raw_data)
        print(f"Normalized {len(normalized['tracks'])} tracks from Spotify API response.")
    else:
        print("Error: Unrecognized input format. Expected Spotify extended history (list) or API response (dict with 'items').")
        sys.exit(1)

    if not normalized["tracks"]:
        print("Warning: No valid tracks found in the input data.")

    # Write output with error handling
    try:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(normalized, f, indent=2, ensure_ascii=False)
    except PermissionError:
        print(f"Error: Permission denied writing to: {output_path}")
        sys.exit(1)
    except OSError as e:
        print(f"Error: Could not write output file: {e}")
        sys.exit(1)

    print(f"Output written to: {output_path}")


if __name__ == "__main__":
    main()
