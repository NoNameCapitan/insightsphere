#!/usr/bin/env python3
"""
normalize_lastfm_export.py
===========================
Normalizes Last.fm recent tracks or top tracks data
into the common listening_history schema.

Usage:
    python normalize_lastfm_export.py <input_file.json> <output_file.json>

Input format:
    Last.fm API response (user.getRecentTracks or user.getTopTracks)
    or a CSV export with columns: track_name, artist_name, [album_name], [played_at], [play_count].

Output:
    A JSON file conforming to schemas/listening_history.schema.json.

Notes:
    - Does NOT hardcode API keys.
    - Supports both JSON API responses and simplified CSV-like JSON.
"""

import json
import sys
import csv
from datetime import datetime, timezone


def normalize_recent_tracks(raw_data: dict) -> dict:
    """
    Normalize Last.fm user.getRecentTracks API response.

    Expected structure:
    {
        "recenttracks": {
            "track": [
                {
                    "name": "Track Name",
                    "artist": {"#text": "Artist Name"},
                    "album": {"#text": "Album Name"},
                    "date": {"uts": "1234567890"}
                }
            ]
        }
    }
    """
    tracks = []
    track_list = raw_data.get("recenttracks", {}).get("track", [])

    for entry in track_list:
        track_name = entry.get("name", "Unknown Track")

        # Artist can be a dict or string depending on API version
        artist_raw = entry.get("artist", {})
        if isinstance(artist_raw, dict):
            artist_name = artist_raw.get("#text", "Unknown Artist")
        else:
            artist_name = str(artist_raw)

        # Album
        album_raw = entry.get("album", {})
        if isinstance(album_raw, dict):
            album_name = album_raw.get("#text", "")
        else:
            album_name = str(album_raw)

        # Timestamp
        date_info = entry.get("date", {})
        played_at = ""
        if isinstance(date_info, dict) and "uts" in date_info:
            try:
                ts = int(date_info["uts"])
                played_at = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
            except (ValueError, OSError):
                pass

        track = {
            "track_name": track_name,
            "artist_name": artist_name,
            "album_name": album_name,
            "played_at": played_at
        }

        tracks.append(track)

    return {
        "source": "lastfm",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "tracks": tracks
    }


def normalize_top_tracks(raw_data: dict) -> dict:
    """
    Normalize Last.fm user.getTopTracks API response.

    Expected structure:
    {
        "toptracks": {
            "track": [
                {
                    "name": "Track Name",
                    "artist": {"name": "Artist Name"},
                    "playcount": "42"
                }
            ]
        }
    }
    """
    tracks = []
    track_list = raw_data.get("toptracks", {}).get("track", [])

    for entry in track_list:
        track_name = entry.get("name", "Unknown Track")

        artist_raw = entry.get("artist", {})
        if isinstance(artist_raw, dict):
            artist_name = artist_raw.get("name", "Unknown Artist")
        else:
            artist_name = str(artist_raw)

        play_count = int(entry.get("playcount", 1))

        track = {
            "track_name": track_name,
            "artist_name": artist_name,
            "play_count": play_count
        }

        tracks.append(track)

    return {
        "source": "lastfm",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "tracks": tracks
    }


def normalize_csv_file(input_path: str) -> dict:
    """
    Normalize a CSV file with columns: track_name, artist_name, [album_name], [played_at], [play_count].
    """
    tracks = []

    with open(input_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            track = {
                "track_name": row.get("track_name", "Unknown Track"),
                "artist_name": row.get("artist_name", "Unknown Artist")
            }
            if "album_name" in row and row["album_name"]:
                track["album_name"] = row["album_name"]
            if "played_at" in row and row["played_at"]:
                track["played_at"] = row["played_at"]
            if "play_count" in row and row["play_count"]:
                track["play_count"] = int(row["play_count"])

            tracks.append(track)

    return {
        "source": "csv",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "tracks": tracks
    }


def detect_format(data, input_path: str) -> str:
    """Detect the input format."""
    if input_path.endswith(".csv"):
        return "csv"
    if isinstance(data, dict):
        if "recenttracks" in data:
            return "recent_tracks"
        elif "toptracks" in data:
            return "top_tracks"
    return "unknown"


def main():
    if len(sys.argv) < 3:
        print("Usage: python normalize_lastfm_export.py <input.json|input.csv> <output.json>")
        print("\nSupported input formats:")
        print("  - Last.fm user.getRecentTracks JSON response")
        print("  - Last.fm user.getTopTracks JSON response")
        print("  - CSV file with columns: track_name, artist_name, [album_name], [played_at], [play_count]")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    # Handle CSV separately
    if input_path.endswith(".csv"):
        try:
            normalized = normalize_csv_file(input_path)
        except FileNotFoundError:
            print(f"Error: Input file not found: {input_path}")
            sys.exit(1)
        except Exception as e:
            print(f"Error: Failed to parse CSV file: {e}")
            sys.exit(1)
        print(f"Normalized {len(normalized['tracks'])} tracks from CSV file.")
    else:
        # Read JSON input with error handling
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

        fmt = detect_format(raw_data, input_path)

        if fmt == "recent_tracks":
            normalized = normalize_recent_tracks(raw_data)
            print(f"Normalized {len(normalized['tracks'])} tracks from Last.fm recent tracks.")
        elif fmt == "top_tracks":
            normalized = normalize_top_tracks(raw_data)
            print(f"Normalized {len(normalized['tracks'])} tracks from Last.fm top tracks.")
        else:
            print("Error: Unrecognized input format. Expected Last.fm API response (with 'recenttracks' or 'toptracks' key) or CSV.")
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
