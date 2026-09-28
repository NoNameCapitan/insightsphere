#!/usr/bin/env python3
"""
candidate_engine.py
===================
Build a candidate pool for the recommender from multiple sources instead of
only the small local demo catalog.

This sprint implements:
  * local curated catalog (default),
  * known-history awareness (do not recommend already-known tracks unless
    include_familiar is set),
  * optional, injectable provider hooks for Spotify Search and Last.fm similar
    tracks. These hooks are NOT live API clients — a caller (or a test) injects a
    fetch function. With no function injected, the source is simply inactive
    (no fake connector, no misleading behavior).

Every candidate preserves the original scoring fields (valence/energy/tempo/
instrumentalness/popularity) so the existing recommender can score the pool
directly. Stdlib only.
"""

import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CATALOG_PATH = ROOT / "examples" / "sample_candidate_catalog.json"

SMALL_POOL_THRESHOLD = 60          # below this we warn the pool is small
SPARSE_GENRE_FRACTION = 0.30       # above this fraction of tagless tracks -> warn

SOURCE_CONFIDENCE = {
    "local_catalog": 0.9,
    "user_upload": 0.85,
    "spotify_search": 0.7,
    "lastfm_similar": 0.6,
    "unknown": 0.5,
}


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _norm(s):
    return str(s or "").strip().lower()


def track_key(artist, title):
    return (_norm(artist), _norm(title))


def _as_genre_list(genres):
    if isinstance(genres, str):
        sep = ";" if ";" in genres else ","
        return [g.strip().lower() for g in genres.split(sep) if g.strip()]
    return [str(g).strip().lower() for g in (genres or []) if str(g).strip()]


def _num(raw, af, key, default):
    val = raw.get(key, af.get(key, default))
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def candidate_from_raw(raw, source, discovered_from=None):
    """Build a normalized candidate object from a raw track dict, preserving the
    audio-feature fields the recommender needs."""
    title = raw.get("track_title") or raw.get("track_name") or raw.get("name") or "Unknown track"
    artist = raw.get("artist") or raw.get("artist_name") or raw.get("artists") or "Unknown artist"
    if isinstance(artist, list):
        artist = ", ".join(str(a) for a in artist)
    album = raw.get("album") or raw.get("album_name")
    af = raw.get("audio_features") or {}
    genres = _as_genre_list(raw.get("genres"))
    return {
        "title": str(title),
        "artist": str(artist),
        "album": album,
        "genres": genres,
        "source": source,
        "source_url": raw.get("source_url"),
        "source_confidence": None,           # filled by attach_candidate_confidence
        "discovered_from": discovered_from,
        "is_known_to_user": False,
        "normalized_genres": [],             # filled by normalize_candidate_genres
        "matched_taxonomy_paths": [],
        "tag_source": raw.get("tag_source"),
        "tag_confidence": raw.get("tag_confidence"),
        "tag_warning": raw.get("tag_warning"),
        # passthrough so generate_recommendations can score the pool directly:
        "track_title": str(title),
        "valence": _num(raw, af, "valence", 0.5),
        "energy": _num(raw, af, "energy", 0.5),
        "tempo": _num(raw, af, "tempo", 100.0),
        "instrumentalness": _num(raw, af, "instrumentalness", 0.0),
        "popularity": _num(raw, af, "popularity", 0.5),
    }


# ---------------------------------------------------------------------------
# providers (factories returning provider(profile, history, request) -> [raw])
# ---------------------------------------------------------------------------

def make_local_provider(catalog_path=None):
    catalog_path = Path(catalog_path) if catalog_path else DEFAULT_CATALOG_PATH

    def provider(profile, history, request):
        data = json.loads(Path(catalog_path).read_text(encoding="utf-8"))
        tracks = data.get("tracks", data) if isinstance(data, dict) else data
        return list(tracks) if isinstance(tracks, list) else []
    return provider


def make_spotify_search_provider(search_fn=None):
    """search_fn(profile, history, request) -> list[raw] (or None). When no
    function is injected the source is inactive (not configured)."""
    def provider(profile, history, request):
        if search_fn is None:
            return []
        try:
            return list(search_fn(profile, history, request) or [])
        except Exception:
            return []
    return provider


def make_lastfm_similar_provider(fetch_fn=None, client=None):
    """Last.fm similar-tracks candidate provider.

    - If fetch_fn is given, use it: fetch_fn(profile, history, request) -> [raw].
      (Keeps tests fully offline.)
    - Else if a configured Last.fm client is given, seed from the user's recent
      history tracks and fetch track.getSimilar for each seed (bounded).
    - Else return [] (not configured). Never fabricates results.

    Request controls: use_lastfm_candidates (bool), lastfm_seed_limit (int),
    lastfm_candidate_limit (int).
    """
    def provider(profile, history, request):
        request = request or {}
        if fetch_fn is not None:
            try:
                return list(fetch_fn(profile, history, request) or [])
            except Exception:
                return []
        if client is None:
            return []
        try:
            if not client.config_status().get("ready"):
                return []
        except Exception:
            return []
        seed_limit = int(request.get("lastfm_seed_limit", 5))
        cand_limit = int(request.get("lastfm_candidate_limit", 60))
        tracks = history.get("tracks", []) if isinstance(history, dict) else (history or [])
        seeds = []
        for tr in tracks:
            artist = tr.get("artist_name") or tr.get("artist")
            title = tr.get("track_name") or tr.get("track_title") or tr.get("name")
            if artist and title:
                seeds.append((artist, title))
            if len(seeds) >= seed_limit:
                break
        out = []
        for artist, title in seeds:
            try:
                out += client.get_similar_tracks(artist, title, limit=25)
            except Exception:
                continue
            if len(out) >= cand_limit:
                break
        out = out[:cand_limit]
        # Enrich sparse Last.fm candidates with track/artist tags (bounded, cached).
        if request.get("enrich_lastfm_tags", True) and hasattr(client, "batch_enrich_candidates"):
            try:
                client.batch_enrich_candidates(out, limit=cand_limit)
            except Exception:
                pass
        return out
    return provider


# ---------------------------------------------------------------------------
# pool operations
# ---------------------------------------------------------------------------

def normalize_candidate_genres(candidates, taxonomy=None):
    for c in candidates:
        if taxonomy is None:
            c["normalized_genres"] = list(c["genres"])
            c["matched_taxonomy_paths"] = []
            continue
        normalized, paths = [], []
        for g in c["genres"]:
            token = taxonomy.normalize(g)
            if token:
                normalized.append(token)
                fam = taxonomy.token_to_family.get(token)
                paths.append(f"{fam} > {token}" if fam and fam != token else token)
        c["normalized_genres"] = normalized
        c["matched_taxonomy_paths"] = sorted(set(paths))
    return candidates


def attach_candidate_confidence(candidates):
    for c in candidates:
        base = SOURCE_CONFIDENCE.get(c["source"], SOURCE_CONFIDENCE["unknown"])
        ts = c.get("tag_source")
        if not c["genres"]:
            base *= 0.7            # tagless: usable but clearly lower
        elif ts == "track":
            base *= 1.0            # track-level tags: most specific
        elif ts == "artist":
            base *= 0.85           # artist-level tags: useful but broader
        c["source_confidence"] = round(min(1.0, base), 3)
    return candidates


def deduplicate_candidates(candidates):
    """Dedup by (artist, title); keep the highest source_confidence variant."""
    best = {}
    for c in candidates:
        key = track_key(c["artist"], c["title"])
        cur = best.get(key)
        if cur is None or (c.get("source_confidence") or 0) > (cur.get("source_confidence") or 0):
            best[key] = c
    # preserve first-seen order
    seen, ordered = set(), []
    for c in candidates:
        key = track_key(c["artist"], c["title"])
        if key in seen:
            continue
        seen.add(key)
        ordered.append(best[key])
    return ordered


def _history_keys(history):
    tracks = history.get("tracks", []) if isinstance(history, dict) else (history or [])
    keys = set()
    for t in tracks:
        artist = t.get("artist_name") or t.get("artist") or ""
        title = t.get("track_name") or t.get("track_title") or t.get("name") or ""
        keys.add(track_key(artist, title))
    return keys


def remove_known_tracks(candidates, history):
    known = _history_keys(history)
    kept = []
    for c in candidates:
        if track_key(c["artist"], c["title"]) in known:
            c["is_known_to_user"] = True
            continue
        kept.append(c)
    return kept


def explain_candidate_pool(candidates, extra_warnings=None):
    size = len(candidates)
    sources = Counter(c["source"] for c in candidates)
    sparse = sum(1 for c in candidates if not c["genres"])
    track_tagged = sum(1 for c in candidates if c.get("tag_source") == "track")
    artist_tagged = sum(1 for c in candidates if c.get("tag_source") == "artist")
    enriched = track_tagged + artist_tagged
    warnings = []
    if size < SMALL_POOL_THRESHOLD:
        warnings.append("small_pool")
    sparse_fraction = (sparse / size) if size else 1.0
    if sparse_fraction > SPARSE_GENRE_FRACTION:
        warnings.append("sparse_genres")
    for w in (extra_warnings or []):
        if w not in warnings:
            warnings.append(w)

    if size == 0:
        quality = "low"
    elif sparse_fraction <= 0.2:
        quality = "high"
    elif sparse_fraction <= 0.5:
        quality = "medium"
    else:
        quality = "low"

    return {
        "size": size,
        "sources": dict(sources),
        "sources_used": sorted(sources),
        "sparse_genre_count": sparse,
        "enriched_candidate_count": enriched,
        "tagless_candidate_count": sparse,
        "tag_sources": {"track": track_tagged, "artist": artist_tagged, "none": sparse},
        "genre_metadata_quality": quality,
        "warnings": warnings,
        "summary_line": (
            f"Candidate pool: {size} tracks from " + ", ".join(sorted(sources))
            if size else "Candidate pool: empty"
        ),
    }


def build_candidate_pool(profile, history, request, enabled_sources=None, taxonomy=None):
    """Assemble, normalize, dedupe, and (optionally) prune the candidate pool.

    enabled_sources: list of {"name": str, "provider": callable}. Defaults to the
    local catalog. request may contain {"include_familiar": bool}.
    Returns {"candidates": [...], "summary": {...}}.
    """
    request = request or {}
    if enabled_sources is None:
        enabled_sources = [{"name": "local_catalog", "provider": make_local_provider()}]

    candidates = []
    source_counts = {}
    lastfm_requested = bool(request.get("use_lastfm_candidates"))
    for src in enabled_sources:
        name = src.get("name", "unknown")
        if name == "lastfm_similar":
            lastfm_requested = True
        provider = src.get("provider")
        if provider is None:
            continue
        try:
            raws = provider(profile, history, request) or []
        except Exception:
            raws = []
        source_counts[name] = source_counts.get(name, 0) + len(raws)
        for raw in raws:
            candidates.append(candidate_from_raw(raw, source=name,
                                                 discovered_from=raw.get("discovered_from")))

    normalize_candidate_genres(candidates, taxonomy)
    attach_candidate_confidence(candidates)
    candidates = deduplicate_candidates(candidates)

    # mark known regardless, then prune unless include_familiar
    known = _history_keys(history)
    for c in candidates:
        c["is_known_to_user"] = track_key(c["artist"], c["title"]) in known
    if not request.get("include_familiar"):
        candidates = [c for c in candidates if not c["is_known_to_user"]]

    extra_warnings = []
    if lastfm_requested and source_counts.get("lastfm_similar", 0) == 0:
        extra_warnings.append("lastfm_unavailable")
    if any((c.get("tag_warning") or "").lower().startswith("tag enrichment failed")
           for c in candidates):
        extra_warnings.append("tag_enrichment_failed")

    return {"candidates": candidates,
            "summary": explain_candidate_pool(candidates, extra_warnings=extra_warnings)}


def write_pool_catalog(pool, path):
    """Write the pool as a catalog file consumable by generate_recommendations."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"tracks": pool["candidates"]}, indent=2, ensure_ascii=False),
                    encoding="utf-8")
    return path


if __name__ == "__main__":
    pool = build_candidate_pool(None, {"tracks": []}, {})
    print(pool["summary"]["summary_line"])
    print("warnings:", pool["summary"]["warnings"])
