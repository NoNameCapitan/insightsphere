#!/usr/bin/env python3
"""
merge_listening_sources.py
==========================
Merge normalized listening histories from several sources into one
multi-source history, with transparent deduplication and coverage.

Inputs (any subset; auto-discovered in outputs/ when run with no args):
    outputs/spotify_history.json
    outputs/youtube_takeout_normalized.json
    outputs/lastfm_normalized.json
    outputs/local_input_history.json     (CSV/JSON/manual/demo imports)
    ...or any explicit list of normalized files.

Dedup logic (simple on purpose, documented in ux/product_logic.md):
    key = ISRC when present, otherwise (normalized title, normalized artist)
    normalization = lowercase, punctuation stripped, "(...)" decorations,
    "feat./Official Video/Remastered"-style suffixes removed.
    Album is kept as a tie-breaker field but does not split matches —
    the same song on a single and an album should merge.

When the same track appears in several sources:
    - play counts are summed;
    - the earliest played_at is kept (plus a played_at list cap of 5);
    - genres are unioned;
    - per-source records are preserved in `sources`;
    - confidence becomes the maximum (the best-parsed copy wins).

Outputs:
    outputs/merged_listening_history.json
    outputs/source_coverage.json

Usage:
    python scripts/merge_listening_sources.py [file1 file2 ...] \
        [--output outputs/merged_listening_history.json] \
        [--coverage outputs/source_coverage.json]
"""

import argparse
import json
import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
ROOT = SCRIPTS.parents[0]
sys.path.insert(0, str(SCRIPTS))

from source_common import (  # noqa: E402
    KNOWN_NORMALIZED_FILES, OUTPUTS, make_history, normalize_key, now_iso, write_coverage,
)


def discover_default_inputs():
    files = []
    for kind, name in KNOWN_NORMALIZED_FILES.items():
        path = OUTPUTS / name
        if not path.exists():
            continue
        if kind == "file_import":
            # local_input_history.json holds whatever ran last (demo, Spotify
            # copy, CSV...). Only merge it when it is a genuine user import,
            # so demo data never pollutes a multi-source profile and Spotify
            # is never counted twice.
            try:
                source = json.loads(path.read_text(encoding="utf-8")).get("source")
            except (json.JSONDecodeError, OSError):
                continue
            if source not in {"csv", "json", "manual"}:
                continue
        files.append(path)
    return files


def load_history(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, dict) or not isinstance(data.get("tracks"), list):
        raise ValueError(f"{path}: not a normalized listening history")
    return data


from identity_graph import match_tracks, identity_key, provider_ids

def merge_histories(histories):
    merged = {}
    order = []
    for history in histories:
        fallback_source = history.get("source", "unknown")
        for track in history.get("tracks", []):
            title = track.get("track_name", "")
            artist = track.get("artist_name", "")
            if not title:
                continue
            isrc = str(track.get("isrc", "")).strip().upper()
            key = identity_key(track)
            # Conservative fuzzy fallback against existing entities when exact IDs are absent.
            if key not in merged and key and key[0] == "name":
                for candidate_key, candidate in merged.items():
                    verdict = match_tracks(candidate, track)
                    if verdict["match"]:
                        key = candidate_key
                        break
            source = track.get("source", fallback_source)
            entry_source = {
                "source": source,
                "confidence": float(track.get("confidence", 1.0)),
                "play_count": int(track.get("play_count", 1) or 1),
            }
            if track.get("raw_id"):
                entry_source["raw_id"] = track["raw_id"]
            if track.get("isrc"):
                entry_source["isrc"] = track["isrc"]
            if track.get("provider_uri"):
                entry_source["provider_uri"] = track["provider_uri"]
            pids = provider_ids(track)
            if pids:
                entry_source["provider_ids"] = pids

            if key not in merged:
                record = dict(track)
                record.setdefault("play_count", 1)
                record["sources"] = [entry_source]
                record["confidence"] = entry_source["confidence"]
                if record.get("played_at"):
                    record["_played_at_list"] = [record["played_at"]]
                merged[key] = record
                order.append(key)
                continue

            record = merged[key]
            existing = next((s for s in record["sources"] if s["source"] == source), None)
            if existing:
                existing["play_count"] += entry_source["play_count"]
            else:
                record["sources"].append(entry_source)
            record["play_count"] = int(record.get("play_count", 1)) + entry_source["play_count"]
            # genres union
            genres = {g.lower() for g in record.get("genres", []) or []}
            genres.update(g.lower() for g in track.get("genres", []) or [])
            if genres:
                record["genres"] = sorted(genres)
            # keep richer metadata when the new copy has it
            for field in ("album_name", "duration_ms", "audio_features"):
                if not record.get(field) and track.get(field):
                    record[field] = track[field]
            # timestamps: earliest wins, keep up to 5
            if track.get("played_at"):
                lst = record.setdefault("_played_at_list", [])
                if track["played_at"] not in lst and len(lst) < 5:
                    lst.append(track["played_at"])
                if not record.get("played_at") or str(track["played_at"]) < str(record["played_at"]):
                    record["played_at"] = track["played_at"]
            record["confidence"] = max(record.get("confidence", 1.0), entry_source["confidence"])

    tracks = []
    for key in order:
        record = merged[key]
        lst = record.pop("_played_at_list", None)
        if lst and len(lst) > 1:
            record["played_at_samples"] = lst
        # the merged record's own metadata reflects its best source
        best = max(record["sources"], key=lambda s: (s["confidence"], s["play_count"]))
        record["source"] = best["source"]
        from source_common import SOURCE_TYPES
        record["source_type"] = SOURCE_TYPES.get(best["source"], "merged")
        if len(record["sources"]) > 1:
            record.pop("raw_id", None)  # per-source ids live in `sources`
        tracks.append(record)
    return tracks


def merge_sources(input_files, output=None, coverage_path=None):
    histories = [load_history(p) for p in input_files]
    tracks = merge_histories(histories)
    if not tracks:
        raise ValueError("Nothing to merge: the input histories contain no tracks.")
    history = make_history("merged", tracks, extra={
        "merged_from": [str(Path(p).name) for p in input_files],
        "merged_at": now_iso(),
    })
    out = Path(output) if output else (OUTPUTS / "merged_listening_history.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(history, indent=2, ensure_ascii=False), encoding="utf-8")
    coverage = write_coverage(history, coverage_path)
    return history, coverage, out


def main():
    parser = argparse.ArgumentParser(description="Merge normalized listening histories from several sources.")
    parser.add_argument("inputs", nargs="*", help="Normalized history files (default: auto-discover in outputs/)")
    parser.add_argument("--output", default=str(OUTPUTS / "merged_listening_history.json"))
    parser.add_argument("--coverage", default=str(OUTPUTS / "source_coverage.json"))
    args = parser.parse_args()

    inputs = [Path(p) for p in args.inputs] or discover_default_inputs()
    if not inputs:
        print("Error: no input files given and nothing found in outputs/. "
              "Import at least one source first (Spotify, YouTube Takeout, Last.fm, CSV/JSON).")
        sys.exit(1)
    try:
        history, coverage, out = merge_sources(inputs, args.output, args.coverage)
    except (ValueError, json.JSONDecodeError, FileNotFoundError) as exc:
        print(f"Error: {exc}")
        sys.exit(1)

    print(f"Merged {len(inputs)} source file(s) -> {out}")
    print(f"  tracks: {coverage['total_tracks']} | events: {coverage['total_listening_events']} | "
          f"artists: {coverage['unique_artists']} | genres: {coverage['unique_genres']}")
    for source, pct in coverage["contribution_percent"].items():
        print(f"  {coverage['source_labels'].get(source, source)}: {pct}%")
    print(f"  Profile confidence: {coverage['confidence_level']}"
          + (f" ({', '.join(coverage['confidence_reasons'])})" if coverage["confidence_reasons"] else ""))


if __name__ == "__main__":
    main()
