#!/usr/bin/env python3
"""
quality.py
==========
Small, pure helpers for recommendation-quality UX. No I/O, no network.
"""


def suggest_next_action(profile, recs, personal_memory, pool_summary):
    """Return one practical next step: {label, explanation, action}.

    `action` is a short key the UI can map to a button (or None).
    Pure function of its inputs so it is trivially testable offline.
    """
    profile = profile or {}
    recs = recs or {}
    pm = personal_memory or {}
    pool = pool_summary or {}
    params = recs.get("parameters", {})
    items = recs.get("recommendations", [])
    constraints = params.get("genre_constraints") or {}
    strict = constraints.get("strictness") == "strict"
    warnings = set(pool.get("warnings", []))
    pq = params.get("profile_quality") or {}
    tracks_analyzed = pq.get("tracks_analyzed", profile.get("tracks_analyzed", 99))

    # 1. History too small to personalize well.
    if tracks_analyzed and tracks_analyzed < 5:
        return {"label": "Add more history",
                "explanation": "Your listening history is small — upload more tracks or connect "
                               "a source so the profile is reliable.",
                "action": "source"}

    # 2. Few results under constraints.
    if items is not None and len(items) < 3 and constraints:
        if strict:
            return {"label": "Broaden genre",
                    "explanation": "Strict mode returned few results — try Broaden genre.",
                    "action": "broaden"}
        return {"label": "Increase novelty",
                "explanation": "Few results — raise novelty or allow adjacent discovery.",
                "action": "adventurous"}

    # 3. Last.fm not configured but the pool is thin.
    if "lastfm_unavailable" in warnings:
        return {"label": "Configure Last.fm",
                "explanation": "Last.fm isn't configured — add a key + username to expand the "
                               "candidate pool with similar tracks.",
                "action": "lastfm"}

    # 4. Small candidate pool.
    if "small_pool" in warnings or (pool.get("size", 99) < 60):
        return {"label": "Enable Last.fm similar",
                "explanation": "Candidate pool is small — enable Last.fm similar tracks to expand it.",
                "action": "lastfm"}

    # 5. Many candidates lack genre tags.
    size = pool.get("size") or 0
    tagless = pool.get("tagless_candidate_count", 0)
    if "tag_enrichment_failed" in warnings or (size and tagless and tagless > size * 0.6):
        return {"label": "Broaden subgenre",
                "explanation": "Many candidates have no genre tags — try a broader subgenre or "
                               "enable Last.fm tag enrichment.",
                "action": "broaden"}

    # 6. Sparse genre metadata generally.
    if "sparse_genres" in warnings or pool.get("genre_metadata_quality") == "low":
        return {"label": "Use a broader subgenre",
                "explanation": "Genre metadata is sparse — use a broader subgenre or family.",
                "action": "broaden"}

    # 7. No favorites saved yet.
    if pm.get("favorites_count", 0) < 3:
        return {"label": "Save favorites",
                "explanation": "Save 3 good tracks to Favorites so future runs improve.",
                "action": "favorite"}

    # 8. Repeatedly rejecting this direction.
    if len(pm.get("reduced_genres", []) or []) >= 3 or pm.get("rejects_count", 0) >= 8:
        return {"label": "Try another preset",
                "explanation": "You often reject this direction — try a different preset.",
                "action": "preset"}

    # 9. Broad mode but generic-looking results (all safe matches).
    if items and not constraints:
        safe = sum(1 for it in items if it.get("group") == "safe_match")
        if len(items) >= 4 and safe == len(items):
            return {"label": "Add genre direction",
                    "explanation": "Results look generic — add a genre direction or raise novelty "
                                   "for more discovery.",
                    "action": "adventurous"}

    return {"label": "Save what you like",
            "explanation": "Looks solid — save good tracks and rerun to refine the profile.",
            "action": "favorite"}
