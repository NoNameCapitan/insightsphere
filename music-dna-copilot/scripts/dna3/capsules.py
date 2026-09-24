"""Capsules: the recurring interaction of the 3.0 product loop.

Pipeline (never bypassed):

    Candidate Retrieval  candidate_engine.build_candidate_pool (known tracks removed)
    → Ranking            generate_recommendations.generate_recommendations
                         (long-term DNA, mood/task, novelty, feedback + adaptive brain)
    → Reranking          session taste (bounded), tier identity, recent-capsule and
                         recent-rejection avoidance, diversity (artist cap / MMR)
    → Packaging          music_capsules.build_capsule (lifecycle, resolver routing)

A/B: the anonymous local user gets a stable variant (beta_instrumentation.
assign_variant). `control` = score order + artist-cap diversity;
`challenger` = MMR genre-diversity rerank. Both identifiers are stored on the
capsule and on every event.
"""
from __future__ import annotations

import json
import math
import uuid
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

from . import VERSION, dna as dna_mod
from .errors import ProductError, bad_request, no_dna, not_found
from .sources import DEMO_HISTORY, label
from .store import Store, now_iso, parse_dt

ROOT = Path(__file__).resolve().parents[2]
STARTER_CATALOG = ROOT / "examples" / "sample_candidate_catalog.json"
EXTENDED_CATALOG = ROOT / "data" / "starter_catalog_3_0.json"
CATALOG_LABELS = {"spotify_search": "Spotify search results",
                  "starter_catalog": "Built-in starter catalog (2.x sample)",
                  "starter_catalog_3": "Built-in 3.0 starter catalog (estimated audio features)"}
ALGORITHM_VERSION = "3.0-rerank-1"

TIERS = {
    "common": {"size": 5, "novelty": 2, "label": "Common", "tagline": "High confidence. Comfort plus a small discovery.",
               "bonus": {"safe_match": 0.08, "adjacent_discovery": 0.03, "wildcard": -0.10}},
    "rare": {"size": 10, "novelty": 3, "label": "Rare", "tagline": "Balanced. Known taste plus meaningful exploration.",
             "bonus": {"safe_match": 0.03, "adjacent_discovery": 0.06, "wildcard": 0.0}},
    "legendary": {"size": 15, "novelty": 5, "label": "Legendary", "tagline": "Deep discovery. Further out, still explainable.",
                  "bonus": {"safe_match": -0.08, "adjacent_discovery": 0.05, "wildcard": 0.08}},
    "mystery": {"size": 10, "novelty": 4, "label": "Mystery", "tagline": "Trust the algorithm. Identities stay hidden until you reveal them.",
                "bonus": {"safe_match": 0.0, "adjacent_discovery": 0.05, "wildcard": 0.03}},
}

INTENTS = {
    "focus": {"label": "Focus", "task": "work_focus", "mood": 0, "novelty_bias": 0},
    "energy": {"label": "Energy", "task": "party", "mood": 2, "novelty_bias": 0},
    "chill": {"label": "Chill", "task": "relaxation", "mood": 1, "novelty_bias": 0},
    "night_drive": {"label": "Night drive", "task": "night_drive", "mood": -1, "novelty_bias": 0},
    "workout": {"label": "Workout", "task": "workout", "mood": 2, "novelty_bias": 0},
    "deep_listen": {"label": "Deep listen", "task": "playlist_creation", "mood": -1, "novelty_bias": 0},
    "discover": {"label": "Discover", "task": "discovering_new_artists", "mood": 0, "novelty_bias": 1},
    "surprise": {"label": "Surprise me", "task": "surprise_me", "mood": 0, "novelty_bias": 1},
}
MOOD_WORDS = {"dark": -2, "melanch": -2, "sad": -2, "moody": -1, "calm": 1, "happy": 2, "upbeat": 2, "bright": 2}

EVENT_TO_BETA = {"save": "track_saved", "replay": "track_replayed", "not_for_me": "track_rejected",
                 "skip": "track_skipped", "completed": "track_completed", "love": "track_loved"}
DISTANCE = {"safe_match": "Close", "adjacent_discovery": "Moderate", "wildcard": "Far"}
RECENT_CAPSULES = 5


# ---------------------------------------------------------------------------
# Beta instrumentation (local only, respects the Privacy setting)
# ---------------------------------------------------------------------------

_SESSION = {"id": str(uuid.uuid4()), "started": False}


def beta(store: Store, event, **fields):
    settings = store.settings()
    if not settings.get("analytics_enabled", True):
        return None
    try:
        import beta_instrumentation as bi
        uid = bi.anonymous_id(settings["anonymous_seed"])
        if not _SESSION["started"] and event != "session_started":
            _SESSION["started"] = True
            bi.append_event(store.beta_path, bi.make_event("session_started", session_id=_SESSION["id"], anonymous_user_id=uid))
        if event == "session_started":
            _SESSION["started"] = True
        fields.setdefault("algorithm_variant", variant(store))
        fields.setdefault("algorithm_version", ALGORITHM_VERSION)
        return bi.append_event(store.beta_path, bi.make_event(event, session_id=_SESSION["id"], anonymous_user_id=uid, **fields))
    except Exception as exc:  # analytics must never break the product
        store.log_diagnostic("analytics_error", exc)
        return None


def variant(store: Store):
    try:
        import beta_instrumentation as bi
        return bi.assign_variant(bi.anonymous_id(store.settings()["anonymous_seed"]))
    except Exception:
        return "control"


# ---------------------------------------------------------------------------
# Storage helpers
# ---------------------------------------------------------------------------

def _path(store: Store, cid):
    if not cid or not all(c.isalnum() or c == "-" for c in str(cid)):
        raise not_found("That capsule")
    return store.capsules_dir / f"{cid}.json"


def load(store: Store, cid):
    p = _path(store, cid)
    cap = store.read_json(p, None)
    if not cap:
        raise not_found("That capsule")
    return cap


def save(store: Store, cap):
    store.write_json(_path(store, cap["capsule_id"]), cap)
    return cap


def all_capsules(store: Store):
    out = []
    if store.capsules_dir.is_dir():
        for p in store.capsules_dir.glob("*.json"):
            try:
                out.append(json.loads(p.read_text(encoding="utf-8")))
            except (OSError, ValueError):
                store.log_diagnostic("corrupted_data", f"Capsule file {p.name} is unreadable; skipped.")
    out.sort(key=lambda c: c.get("generated_at", ""), reverse=True)
    return out


def active_capsule(store: Store):
    for c in all_capsules(store):
        if c.get("state") in ("opened", "started"):
            return c
    return None


# ---------------------------------------------------------------------------
# Generation
# ---------------------------------------------------------------------------

def _custom_intent(text):
    text = (text or "").strip()[:80]
    mood = 0
    for word, m in MOOD_WORDS.items():
        if word in text.lower():
            mood = m
            break
    return {"label": text or "Custom", "task": "playlist_creation", "mood": mood, "novelty_bias": 0, "custom": True}


def _key(title, artist):
    return (str(title or "").strip().lower(), str(artist or "").strip().lower())


def _catalogs(store: Store):
    cats = []
    spotify_cat = store.path("spotify_candidate_catalog.json")
    if spotify_cat.exists():
        cats.append(("spotify_search", spotify_cat))
    if EXTENDED_CATALOG.exists():
        cats.append(("starter_catalog_3", EXTENDED_CATALOG))
    cats.append(("starter_catalog", STARTER_CATALOG))
    return cats


def _history_for_retrieval(store: Store, demo):
    if demo:
        return json.loads(DEMO_HISTORY.read_text(encoding="utf-8"))
    return store.read_json(store.path("merged_listening_history.json"), {"tracks": []}, quarantine=False) or {"tracks": []}


def _identity_fields(raw):
    """Provider identity carried from retrieval to the resolver."""
    out = {}
    for k in ("isrc", "provider_ids", "provider_uri", "external_urls", "musicbrainz_recording_id"):
        if raw.get(k):
            out[k] = raw[k]
    url = raw.get("source_url") or ""
    if "open.spotify.com/track/" in url:
        out.setdefault("external_urls", {})["spotify"] = url
    if raw.get("spotify_id"):
        out.setdefault("provider_ids", {})["spotify"] = raw["spotify_id"]
    return out


def _recent(store: Store, now):
    caps = all_capsules(store)[:RECENT_CAPSULES]
    recent_ids = {t.get("track_id") for c in caps for t in c.get("tracks", [])}
    since = now - timedelta(days=30)
    rejected_artists, rejected_tracks = Counter(), set()
    for r in store.read_jsonl(store.feedback_path):
        if (parse_dt(r.get("timestamp")) or now) < since:
            continue
        if r.get("action") in ("not_for_me", "dislike"):
            if r.get("artist"):
                rejected_artists[str(r["artist"]).lower()] += 1
            if r.get("track_id"):
                rejected_tracks.add(r["track_id"])
    return recent_ids, rejected_artists, rejected_tracks


def _jaccard(a, b):
    a, b = set(a or []), set(b or [])
    return len(a & b) / len(a | b) if (a | b) else 0.0


def rerank(items, tier, session_vec, recent_ids, rejected_artists, rejected_tracks, algo):
    from music_capsules import _track_id
    cfg = TIERS[tier]
    out = []
    for it in items:
        base = it.get("confidence_score", 0) / 100.0
        genres = [str(g).lower() for g in it.get("genres") or []]
        artist = str(it.get("artist", "")).lower()
        gs = [session_vec.get("genre", {}).get(g, 0.0) for g in genres]
        s_adj = (sum(gs) / len(gs) if gs else 0.0) + session_vec.get("artist", {}).get(artist, 0.0)
        s_adj = max(-0.12, min(0.12, s_adj))
        tier_adj = cfg["bonus"].get(it.get("group"), 0.0)
        tid = _track_id(it)
        avoid = 0.0
        if tid in rejected_tracks:
            continue  # never re-serve a track the user rejected
        if tid in recent_ids:
            avoid -= 0.25
        if rejected_artists.get(artist):
            avoid -= min(0.3, 0.12 * rejected_artists[artist])
        x = dict(it)
        x["rerank"] = {"base": round(base, 3), "session": round(s_adj, 3), "tier": round(tier_adj, 3),
                       "avoidance": round(avoid, 3), "final": round(base + s_adj + tier_adj + avoid, 4)}
        out.append(x)
    out.sort(key=lambda x: -x["rerank"]["final"])
    if algo == "challenger":
        # MMR: trade a little score for genre diversity against what is already picked.
        picked, pool = [], list(out)
        while pool and len(picked) < len(out):
            best = max(pool, key=lambda c: c["rerank"]["final"] - 0.15 * max(
                [_jaccard(c.get("genres"), p.get("genres")) for p in picked] or [0.0]))
            picked.append(best)
            pool.remove(best)
        out = picked
    return out


def generate(store: Store, tier="common", intent="surprise", custom_intent=None):
    tier = str(tier or "").lower()
    if tier not in TIERS:
        raise bad_request(f"Unknown capsule type '{tier}'.")
    if custom_intent:
        ctx = _custom_intent(custom_intent)
        intent = "custom"
    else:
        intent = str(intent or "surprise").lower()
        if intent not in INTENTS:
            raise bad_request(f"Unknown intent '{intent}'.")
        ctx = dict(INTENTS[intent])
    dna = dna_mod.load(store)
    if not dna:
        raise no_dna()
    settings = store.settings()
    now = datetime.now(timezone.utc)
    cfg = TIERS[tier]
    novelty = max(1, min(5, cfg["novelty"] + ctx.get("novelty_bias", 0)))
    algo = variant(store)

    # Abandon a still-open capsule rather than leaving it dangling.
    prev = active_capsule(store)
    if prev:
        finish(store, prev["capsule_id"], abandon_if_untouched=True)

    # 1. Candidate retrieval -------------------------------------------------
    import candidate_engine
    history = _history_for_retrieval(store, dna.get("demo"))
    sources = [{"name": name, "provider": candidate_engine.make_local_provider(path)} for name, path in _catalogs(store)]
    pool = candidate_engine.build_candidate_pool(dna["taste_profile"], history, {"include_familiar": False},
                                                 enabled_sources=sources)
    candidates = pool["candidates"]
    widened = False
    if len(candidates) < cfg["size"] * 2:
        pool = candidate_engine.build_candidate_pool(dna["taste_profile"], history, {"include_familiar": True},
                                                     enabled_sources=sources)
        candidates = pool["candidates"]
        widened = True
    if not candidates:
        raise ProductError("NOT_ENOUGH_DATA", "No candidates available",
                           "There are no tracks to recommend from yet. Connect Spotify for a larger catalog.")
    pool_path = store.v3 / "candidate_pool.json"
    candidate_engine.write_pool_catalog(pool, pool_path)
    identity = {_key(c.get("title") or c.get("track_title"), c.get("artist")): c for c in candidates}
    raw_by_key = {}
    for _name, cat_path in _catalogs(store):
        try:
            data = json.loads(Path(cat_path).read_text(encoding="utf-8"))
            for r in (data.get("tracks", data) if isinstance(data, dict) else data):
                raw_by_key.setdefault(_key(r.get("track_title") or r.get("track_name") or r.get("name"),
                                           r.get("artist") or r.get("artist_name")), r)
        except (OSError, ValueError, AttributeError):
            continue

    # 2. Ranking --------------------------------------------------------------
    import generate_recommendations as ranker
    ranked = ranker.generate_recommendations(
        dna["taste_profile"], ctx["mood"], ctx["task"], novelty, max_items=len(candidates),
        catalog_path=pool_path, feedback_path=store.feedback_path if store.feedback_path.exists() else None,
        use_feedback=store.feedback_path.exists())

    # 3. Reranking ------------------------------------------------------------
    session = dna_mod.session_taste(store, settings, dna)
    recent_ids, rejected_artists, rejected_tracks = _recent(store, now)
    reranked = rerank(ranked["recommendations"], tier, session["vector"], recent_ids, rejected_artists,
                      rejected_tracks, algo)
    for it in reranked:
        k = _key(it.get("track_title"), it.get("artist"))
        it.update(_identity_fields(raw_by_key.get(k, {})))
        src = identity.get(k, {})
        it["candidate_source"] = src.get("source")
        it["genres_inferred"] = bool(src.get("tag_source"))

    # 4. Packaging --------------------------------------------------------------
    from music_capsules import build_capsule
    context = {"intent": intent, "intent_label": ctx["label"], "task": ctx["task"], "mood": ctx["mood"],
               "novelty": novelty, "custom": bool(ctx.get("custom"))}
    cap = build_capsule({"recommendations": reranked}, tier, context,
                        preferred_provider=settings["preferred_provider"],
                        fallback_order=settings["fallback_order"], recent_track_ids=recent_ids,
                        recent_artists=[a for a in rejected_artists])
    groups = Counter(t.get("group") for t in cap["tracks"])
    cap.update({
        "version": VERSION, "tier_label": cfg["label"], "tagline": cfg["tagline"],
        "algorithm": {"variant": algo, "version": ALGORITHM_VERSION,
                      "stages": ["candidate_retrieval", "ranking", "reranking", "packaging"]},
        "retrieval": {"pool_size": len(candidates), "widened_to_familiar": widened,
                      "catalogs": [{"id": n, "label": CATALOG_LABELS.get(n, n)} for n, _ in _catalogs(store)],
                      "warnings": pool["summary"].get("warnings", [])},
        "composition": {"close": groups.get("safe_match", 0), "moderate": groups.get("adjacent_discovery", 0),
                        "far": groups.get("wildcard", 0)},
        "session_taste_used": session["events"] > 0,
        "demo": bool(dna.get("demo")),
        "revealed": [],
        "opened_tracks": [],
    })
    if cap["actual_size"] < cap["requested_size"]:
        cap["retrieval"]["warnings"] = list(cap["retrieval"]["warnings"]) + ["pool_smaller_than_capsule"]
    save(store, cap)
    beta(store, "capsule_opened", capsule_id=cap["capsule_id"], capsule_rarity=tier, context=intent)
    return cap


# ---------------------------------------------------------------------------
# Presentation (with Mystery redaction)
# ---------------------------------------------------------------------------

def _real(track):
    rv = track.get("mystery_reveal") or {}
    return {"title": rv.get("track_title") or track.get("track_title"),
            "artist": rv.get("artist") or track.get("artist")}


def explain(track, dna, tier, context):
    sb = track.get("scoring_breakdown") or {}
    top = {g["name"]: g["affinity"] for g in (dna or {}).get("genres", [])[:15]}
    genres = [str(g).lower() for g in track.get("genres") or []]
    shared = [g for g in genres if top.get(g, 0) >= 0.2]
    reasons = []
    if shared:
        reasons.append({"kind": "genres", "text": "You frequently return to", "items": shared[:3]})
    if sb.get("artist_recurrence_score", 0) > 0.25:
        reasons.append({"kind": "artist", "text": f"You already listen to {_real(track)['artist']}."})
    elif sb.get("track_familiarity", 1) < 0.35:
        reasons.append({"kind": "distance", "text": "This track sits outside your usual artist network."})
    if sb.get("task_match_score", 0) >= 0.72 or sb.get("mood_match_score", 0) >= 0.72:
        reasons.append({"kind": "context", "text": f"It fits your {context.get('intent_label', 'current').lower()} context."})
    if sb.get("adaptive_learning_adjustment", 0) >= 0.02 or sb.get("feedback_adjustment", 0) >= 0.05:
        reasons.append({"kind": "learning", "text": "Your recent reactions nudged it up."})
    rr = track.get("rerank") or {}
    if rr.get("session", 0) >= 0.02:
        reasons.append({"kind": "session", "text": "It's close to what you liked earlier this session."})
    if track.get("group") == "wildcard" and tier in ("legendary", "mystery"):
        reasons.append({"kind": "tier", "text": f"This pick is experimental because you opened a {TIERS[tier]['label']} capsule."})
    if not reasons:
        reasons.append({"kind": "fallback", "text": "A controlled step from your profile; evidence for this pick is thin."})
    caution = None
    wn = track.get("why_not_like") or ""
    if wn and "no major mismatch" not in wn:
        caution = wn.replace("You may not like this because ", "Possible mismatch: ")
    return {
        "match": int(track.get("confidence_score", 0)),
        "match_note": "Blend of genre and artist affinity, mood and context fit, and your feedback. Not a probability.",
        "distance": DISTANCE.get(track.get("group"), "Unknown"),
        "context_fit": round(((sb.get("mood_match_score", 0.5)) + (sb.get("task_match_score", 0.5))) / 2 * 100),
        "reasons": reasons, "caution": caution,
        "genres_inferred": bool(track.get("genres_inferred")),
    }


def _route_view(route, provider_links):
    """Translate a resolver route into honest user actions."""
    if not route:
        return {"status": "unresolved", "actions": []}
    from track_resolver import PROVIDER_LABELS, search_url
    preferred = route.get("preferred_provider")
    status, prov, method = route.get("status"), route.get("provider"), route.get("method")
    actions = []
    note = None
    if status == "resolved":
        actions.append({"kind": "open", "provider": prov, "label": f"Open in {PROVIDER_LABELS.get(prov, prov)}",
                        "url": route.get("url"), "method": method, "exact": method != "fuzzy_metadata"})
        if prov != preferred:
            note = f"Not found directly on {PROVIDER_LABELS.get(preferred, preferred)}. Available on {PROVIDER_LABELS.get(prov, prov)}."
            actions.append({"kind": "search", "provider": preferred,
                            "label": f"Search {PROVIDER_LABELS.get(preferred, preferred)}",
                            "url": provider_links.get(preferred)})
    elif status == "search_fallback":
        actions.append({"kind": "search", "provider": prov, "label": f"Search {PROVIDER_LABELS.get(prov, prov)}",
                        "url": route.get("url"), "method": "provider_search", "exact": False})
        note = "No exact match known yet — this opens a search, not the exact track."
    for a in route.get("attempts", []):
        p = a.get("provider")
        if p and p not in {x["provider"] for x in actions}:
            actions.append({"kind": "search", "provider": p, "label": f"Search {PROVIDER_LABELS.get(p, p)}",
                            "url": provider_links.get(p) or a.get("url"), "secondary": True})
    return {"status": status, "provider": prov, "method": method, "note": note, "actions": actions,
            "confidence": route.get("confidence")}


def _feedback_for(cap, track_id):
    return [e["action"] for e in cap.get("events", []) if e.get("track_id") == track_id]


def track_view(cap, track, dna):
    tid = track["track_id"]
    hidden = cap.get("rarity") == "mystery" and tid not in (cap.get("revealed") or [])
    ex = explain(track, dna, cap.get("rarity"), cap.get("context") or {})
    base = {"track_id": tid, "rank": track.get("capsule_rank"), "feedback": _feedback_for(cap, tid),
            "opened": tid in (cap.get("opened_tracks") or [])}
    if hidden:
        # Nothing identifying leaves the server: no title/artist/genres/links/reasons.
        return base | {"hidden": True, "title": None, "artist": None,
                       "explain": {"match": ex["match"], "distance": ex["distance"], "context_fit": ex["context_fit"],
                                   "match_note": ex["match_note"], "reasons": [], "caution": None}}
    real = _real(track)
    return base | {"hidden": False, "title": real["title"], "artist": real["artist"],
                   "genres": track.get("genres", [])[:4], "group": track.get("group"), "explain": ex,
                   "playback": _route_view(track.get("playback_route"), track.get("provider_links") or {})}


def view(store: Store, cap, dna=None):
    dna = dna if dna is not None else dna_mod.load(store)
    from music_capsules import capsule_metrics
    out = {k: cap.get(k) for k in ("capsule_id", "rarity", "tier_label", "tagline", "state", "generated_at",
                                   "started_at", "ended_at", "context", "preferred_provider", "requested_size",
                                   "actual_size", "algorithm", "retrieval", "composition", "demo",
                                   "session_taste_used")}
    out["tracks"] = [track_view(cap, t, dna) for t in cap.get("tracks", [])]
    out["metrics"] = capsule_metrics(cap)
    done = {e["track_id"] for e in cap.get("events", []) if e.get("action") in _terminal()}
    out["progress"] = {"done": len(done), "total": len(cap.get("tracks", []))}
    if cap.get("state") in ("completed", "abandoned"):
        out["summary"] = completion_summary(cap, dna)
    return out


def _terminal():
    from music_capsules import TERMINAL_EVENTS
    return TERMINAL_EVENTS


# ---------------------------------------------------------------------------
# Interaction
# ---------------------------------------------------------------------------

def _find(cap, track_id):
    for t in cap.get("tracks", []):
        if t.get("track_id") == track_id:
            return t
    raise not_found("That track")


def _start(store, cap):
    if cap["state"] == "opened":
        from music_capsules import transition
        cap = transition(cap, "started")
        beta(store, "capsule_started", capsule_id=cap["capsule_id"], capsule_rarity=cap["rarity"],
             context=(cap.get("context") or {}).get("intent"))
    return cap


def record_feedback(store: Store, cid, track_id, action):
    from music_capsules import SIGNAL_KIND, TRACK_EVENTS, record_track_event
    if action not in TRACK_EVENTS:
        raise bad_request(f"Unknown reaction '{action}'.")
    cap = load(store, cid)
    if cap["state"] in ("completed", "abandoned"):
        raise ProductError("CONFLICT", "This capsule is closed", "Open a new capsule to keep reacting.")
    track = _find(cap, track_id)
    cap = _start(store, cap)
    cap = record_track_event(cap, track_id, action)
    real = _real(track)
    ctx = cap.get("context") or {}
    # Full identity is kept internally (even for Mystery) so learning works.
    store.append_jsonl(store.feedback_path, {
        "timestamp": now_iso(), "origin": "capsule", "action": action,
        "signal_kind": SIGNAL_KIND.get(action, "explicit"),
        "track_title": real["title"], "artist": real["artist"], "genres": track.get("genres", []),
        "track_id": track_id, "capsule_id": cid, "capsule_rarity": cap["rarity"], "group": track.get("group"),
        "task": ctx.get("task"), "intent": ctx.get("intent"),
        "algorithm_variant": (cap.get("algorithm") or {}).get("variant"),
        "algorithm_version": (cap.get("algorithm") or {}).get("version"),
    })
    rarity, intent = cap["rarity"], ctx.get("intent")
    if action == "completed" and track_id not in (cap.get("opened_tracks") or []):
        beta(store, "track_played", capsule_id=cid, capsule_rarity=rarity, context=intent, value="self_reported")
    if action in EVENT_TO_BETA:
        beta(store, EVENT_TO_BETA[action], capsule_id=cid, capsule_rarity=rarity, context=intent,
             signal_kind=SIGNAL_KIND.get(action))
    else:
        beta(store, "track_feedback", capsule_id=cid, capsule_rarity=rarity, context=intent, value=action)
    # "Sufficient interaction" reveals a Mystery track.
    if cap["rarity"] == "mystery" and action in _terminal() and track_id not in cap.get("revealed", []):
        cap["revealed"] = list(cap.get("revealed", [])) + [track_id]
    touched = {e["track_id"] for e in cap["events"] if e.get("action") in _terminal()}
    if len(touched) >= len(cap.get("tracks", [])):
        cap = _complete(store, cap)
    save(store, cap)
    return view(store, cap)


def reveal(store: Store, cid, track_id):
    cap = load(store, cid)
    if cap.get("rarity") != "mystery":
        return view(store, cap)
    _find(cap, track_id)
    if track_id not in cap.get("revealed", []):
        cap["revealed"] = list(cap.get("revealed", [])) + [track_id]
        cap = _start(store, cap)
        beta(store, "capsule_revealed", capsule_id=cid, capsule_rarity="mystery",
             context=(cap.get("context") or {}).get("intent"))
        save(store, cap)
    return view(store, cap)


def open_track(store: Store, cid, track_id, provider=None):
    """Record that the user opened a track in a service (the only playback we can observe)."""
    cap = load(store, cid)
    track = _find(cap, track_id)
    if cap.get("rarity") == "mystery" and track_id not in cap.get("revealed", []):
        raise ProductError("CONFLICT", "Reveal first", "Reveal this Mystery track before opening it.")
    route = track.get("playback_route") or {}
    cap = _start(store, cap)
    first = track_id not in cap.get("opened_tracks", [])
    if first:
        cap["opened_tracks"] = list(cap.get("opened_tracks", [])) + [track_id]
        ctx = (cap.get("context") or {}).get("intent")
        beta(store, "track_played", capsule_id=cid, capsule_rarity=cap["rarity"], context=ctx,
             provider=provider or route.get("provider"), value="link_opened")
        beta(store, "resolver_result", capsule_id=cid, capsule_rarity=cap["rarity"],
             provider=route.get("provider"), resolver_status=route.get("method") if route.get("status") == "resolved"
             else route.get("status") or "unresolved")
    save(store, cap)
    return {"ok": True, "first_open": first}


def _complete(store, cap):
    from music_capsules import append_history, transition
    cap = transition(cap, "completed")
    append_history(store.capsule_history_path, cap)
    beta(store, "capsule_completed", capsule_id=cap["capsule_id"], capsule_rarity=cap["rarity"],
         context=(cap.get("context") or {}).get("intent"))
    return cap


def finish(store: Store, cid, abandon_if_untouched=False):
    from music_capsules import transition
    cap = load(store, cid)
    if cap["state"] in ("completed", "abandoned"):
        return view(store, cap)
    if cap["state"] == "opened" or (abandon_if_untouched and not cap.get("events")):
        cap = transition(cap, "abandoned")
        beta(store, "capsule_abandoned", capsule_id=cid, capsule_rarity=cap["rarity"],
             context=(cap.get("context") or {}).get("intent"))
    else:
        cap = _complete(store, cap)
    save(store, cap)
    return view(store, cap)


# ---------------------------------------------------------------------------
# Completion summary + history
# ---------------------------------------------------------------------------

def completion_summary(cap, dna):
    from music_dna_brain import ACTION_WEIGHT, EXPLORATORY_NEGATIVE_FACTOR, PER_CAPSULE_GENRE_CAP
    events = cap.get("events", [])
    counts = Counter(e.get("action") for e in events)
    by_track = {}
    for e in events:
        by_track.setdefault(e["track_id"], set()).add(e["action"])
    tracks = {t["track_id"]: t for t in cap.get("tracks", [])}
    net = Counter()
    evid = Counter()
    for e in events:
        w = ACTION_WEIGHT.get(e.get("action"))
        if w is None:
            continue
        if w < 0 and cap.get("rarity") in ("legendary", "mystery"):
            w *= EXPLORATORY_NEGATIVE_FACTOR
        for g in tracks.get(e["track_id"], {}).get("genres", []) or []:
            net[g.lower()] += w
            evid[g.lower()] += 1
    learned = []
    for g, v in sorted(net.items(), key=lambda kv: -abs(kv[1])):
        if evid[g] < 2 or abs(v) < 0.8:
            continue
        v = max(-PER_CAPSULE_GENRE_CAP, min(PER_CAPSULE_GENRE_CAP, v))
        learned.append({"text": f"{g.title()} affinity", "direction": "up" if v > 0 else "down",
                        "evidence": f"{evid[g]} reactions"})
        if len(learned) >= 4:
            break
    if counts.get("too_similar") or counts.get("too_strange"):
        d = counts.get("too_similar", 0) - counts.get("too_strange", 0)
        if d:
            learned.append({"text": "Discovery tolerance", "direction": "up" if d > 0 else "down",
                            "evidence": f"{counts.get('too_similar', 0)} too similar · {counts.get('too_strange', 0)} too strange"})
    known = set((dna or {}).get("known_artists") or [])
    new_artists = sorted({_real(tracks[tid])["artist"] for tid, acts in by_track.items()
                          if tid in tracks and acts & {"love", "save", "replay", "more_like_this"}
                          and str(_real(tracks[tid])["artist"]).lower() not in known})
    if new_artists:
        learned.append({"text": "Artist cluster expanded", "direction": "up",
                        "evidence": ", ".join(new_artists[:3]) + ("…" if len(new_artists) > 3 else "")})
    completed_tracks = sum(1 for acts in by_track.values() if "completed" in acts)
    return {
        "tracks": len(cap.get("tracks", [])), "reacted": len(by_track), "completed": completed_tracks,
        "loved": counts.get("love", 0), "saved": counts.get("save", 0), "replayed": counts.get("replay", 0),
        "skipped": counts.get("skip", 0), "rejected": counts.get("not_for_me", 0),
        "learned": learned,
        "learned_empty_reason": None if learned else "Not enough reactions in this capsule to draw a conclusion yet.",
        "new_discoveries": new_artists,
        "completed_note": "“Completed” counts tracks you marked as listened; the app can't see playback inside other apps.",
    }


def history(store: Store, dna=None):
    dna = dna if dna is not None else dna_mod.load(store)
    known = set((dna or {}).get("known_artists") or [])
    rows, discoveries = [], []
    for cap in all_capsules(store):
        counts = Counter(e.get("action") for e in cap.get("events", []))
        tracks = {t["track_id"]: t for t in cap.get("tracks", [])}
        for tid in {e["track_id"] for e in cap.get("events", []) if e.get("action") in ("love", "save", "replay", "more_like_this")}:
            t = tracks.get(tid)
            if not t:
                continue
            real = _real(t)
            if str(real["artist"]).lower() not in known and not any(d["artist"] == real["artist"] and d["title"] == real["title"] for d in discoveries):
                discoveries.append({"title": real["title"], "artist": real["artist"], "capsule_id": cap["capsule_id"],
                                    "tier": cap.get("rarity"), "date": cap.get("generated_at")})
        reacted = {e["track_id"] for e in cap.get("events", []) if e.get("action") in _terminal()}
        route = next((t.get("playback_route") for t in cap.get("tracks", []) if t.get("playback_route")), {}) or {}
        rows.append({
            "capsule_id": cap["capsule_id"], "date": cap.get("generated_at"), "tier": cap.get("rarity"),
            "tier_label": cap.get("tier_label") or TIERS.get(cap.get("rarity"), {}).get("label"),
            "intent": (cap.get("context") or {}).get("intent_label"), "state": cap.get("state"),
            "tracks": len(cap.get("tracks", [])), "reacted": len(reacted),
            "completion": round(len(reacted) / max(1, len(cap.get("tracks", []))), 2),
            "saves": counts.get("save", 0) + counts.get("love", 0), "replays": counts.get("replay", 0),
            "rejections": counts.get("not_for_me", 0),
            "provider": label(cap.get("preferred_provider") or route.get("preferred_provider") or ""),
            "demo": bool(cap.get("demo")),
        })
    return {"capsules": rows, "discoveries": discoveries[:50],
            "discovery_definition": "Tracks you loved, saved, replayed or asked more of, by artists that aren't in your imported listening history."}
