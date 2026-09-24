#!/usr/bin/env python3
"""
enrich_genres.py
================
Fill missing genres for tracks that arrive without tags (YouTube Takeout,
manual input, many CSVs) so the deep genre engine, Music DNA and Card work
on merged, multi-source profiles too. Python stdlib only.

Why this exists
---------------
The multi-source importers (v1.4 branch) bring *listening events* but often
no genres; the deep genre engine (V4 branch) needs genres to reason. This is
the bridge between the two.

Resolution order (first hit wins, per artist):

    1. same_artist   another row in the SAME history has genres for this
                     artist (e.g. Spotify knows Kavinsky, Takeout doesn't);
    2. offline_map   artist → genres learned from the bundled example
                     catalogs/histories + data/artist_genre_seed.json
                     (fully offline, deterministic, editable);
    3. lastfm_tags   optional: Last.fm artist.getTopTags, normalized through
                     the genre taxonomy, cached locally. Only used when a
                     client with an API key is passed in. Never required.

Honesty rules:
    - only tracks with NO genres are touched; existing genres are never changed;
    - enriched tracks get `genres_inferred: true` and `genre_source`;
    - a stats dict reports exactly how many tracks were filled and from where.

CLI:
    python scripts/enrich_genres.py outputs/youtube_takeout_normalized.json \
        outputs/enriched.json [--lastfm]
"""

import argparse
import json
import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
ROOT = SCRIPTS.parent
EXAMPLES = ROOT / "examples"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

OFFLINE_SOURCES = [
    "sample_candidate_catalog.json",
    "sample_listening_history.json",
    "demo_owner_taste.json",
    "sample_merged_listening_history.json",
]
SEED_PATH = ROOT / "data" / "artist_genre_seed.json"
MAX_GENRES = 4
DEFAULT_LASTFM_LOOKUPS = 40  # cap network calls per run (cache makes reruns free)


def _artist_key(name):
    return " ".join(str(name or "").lower().split())


def _genres_of(track):
    return [g for g in (track.get("genres") or []) if isinstance(g, str) and g.strip()]


def _collect(tracks, into):
    for tr in tracks:
        genres = _genres_of(tr)
        if tr.get("genres_inferred") or not genres:
            continue
        key = _artist_key(tr.get("artist_name"))
        if not key:
            continue
        bucket = into.setdefault(key, [])
        for g in genres:
            g = g.strip().lower()
            if g not in bucket:
                bucket.append(g)


def load_offline_map(paths=None):
    """artist → genres from bundled example data (no network)."""
    mapping = {}
    for path in paths or [EXAMPLES / name for name in OFFLINE_SOURCES]:
        try:
            data = json.loads(Path(path).read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        tracks = data.get("tracks", data if isinstance(data, list) else [])
        _collect(tracks, mapping)
    if paths is None:
        try:
            seed = json.loads(SEED_PATH.read_text(encoding="utf-8")).get("artists", {})
        except (OSError, json.JSONDecodeError):
            seed = {}
        for artist, genres in seed.items():
            mapping.setdefault(_artist_key(artist), [g.lower() for g in genres])
    return mapping


def _taxonomy():
    try:
        import genre_taxonomy
        return genre_taxonomy.load_taxonomy()
    except Exception:
        return None


def tags_to_genres(tags, taxonomy=None):
    """Keep only tags the taxonomy recognizes as genres (drops 'seen live', years...)."""
    out = []
    for tag in tags or []:
        tag = str(tag).strip().lower()
        if not tag:
            continue
        if taxonomy is not None:
            token = taxonomy.normalize(tag)
            if not token:
                continue
            tag = token
        if tag not in out:
            out.append(tag)
        if len(out) >= MAX_GENRES:
            break
    return out


def enrich_history(history, lastfm_client=None, offline_map=None,
                   max_lastfm_lookups=DEFAULT_LASTFM_LOOKUPS):
    """Enrich tagless tracks in place. Returns (history, stats)."""
    tracks = history.get("tracks", [])
    missing = [tr for tr in tracks if not _genres_of(tr)]
    stats = {"total_tracks": len(tracks), "missing": len(missing), "filled": 0,
             "same_artist": 0, "offline_map": 0, "lastfm_tags": 0,
             "lastfm_lookups": 0, "unresolved_artists": []}
    if not missing:
        return history, stats

    same = {}
    _collect(tracks, same)
    offline = offline_map if offline_map is not None else load_offline_map()
    taxonomy = _taxonomy() if lastfm_client is not None else None
    lastfm_cache = {}
    unresolved = set()

    for tr in missing:
        key = _artist_key(tr.get("artist_name"))
        if not key:
            continue
        genres, origin = None, None
        if same.get(key):
            genres, origin = same[key], "same_artist"
        elif offline.get(key):
            genres, origin = offline[key], "offline_map"
        elif lastfm_client is not None:
            if key not in lastfm_cache and stats["lastfm_lookups"] < max_lastfm_lookups:
                stats["lastfm_lookups"] += 1
                try:
                    tags = lastfm_client.get_artist_top_tags(tr.get("artist_name"))
                except Exception:
                    tags = []
                lastfm_cache[key] = tags_to_genres(tags, taxonomy)
            if lastfm_cache.get(key):
                genres, origin = lastfm_cache[key], "lastfm_tags"
        if genres:
            tr["genres"] = list(genres[:MAX_GENRES])
            tr["genres_inferred"] = True
            tr["genre_source"] = origin
            stats["filled"] += 1
            stats[origin] += 1
        else:
            unresolved.add(tr.get("artist_name") or key)

    stats["unresolved_artists"] = sorted(unresolved)[:20]
    history.setdefault("enrichment", {})["genres"] = {
        k: v for k, v in stats.items() if k != "unresolved_artists"}
    return history, stats


def maybe_lastfm_client():
    """A Last.fm client only when an API key is configured; else None."""
    try:
        import lastfm_client
        client = lastfm_client.LastfmClient()
        return client if client.config_status().get("api_key_present") else None
    except Exception:
        return None


def main():
    ap = argparse.ArgumentParser(description="Fill missing genres (offline first, optional Last.fm).")
    ap.add_argument("input")
    ap.add_argument("output")
    ap.add_argument("--lastfm", action="store_true", help="also use Last.fm artist tags if LASTFM_API_KEY is set")
    args = ap.parse_args()
    history = json.loads(Path(args.input).read_text(encoding="utf-8"))
    client = maybe_lastfm_client() if args.lastfm else None
    history, stats = enrich_history(history, lastfm_client=client)
    Path(args.output).write_text(json.dumps(history, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Filled {stats['filled']} of {stats['missing']} tagless tracks "
          f"(same artist {stats['same_artist']}, offline map {stats['offline_map']}, "
          f"Last.fm {stats['lastfm_tags']}).")
    if stats["unresolved_artists"]:
        print("Unresolved artists:", ", ".join(stats["unresolved_artists"]))


if __name__ == "__main__":
    main()
