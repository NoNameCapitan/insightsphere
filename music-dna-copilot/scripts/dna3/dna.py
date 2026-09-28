"""Unified Music DNA: build, dimensions, long-term vs session taste, change feed.

Honesty contract
----------------
* Every dimension either carries a value *and* the evidence it came from, or
  `status: "insufficient_data"` with the reason. Nothing is padded.
* Raw events, unique tracks, artists and sources are separate numbers and are
  never presented as interchangeable.
* The change feed is computed from recorded feedback only, with cautious
  wording ("likely", "signals suggest") because attribution is probabilistic.
"""
from __future__ import annotations

import math
import time
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

from . import VERSION
from .errors import ProductError
from .sources import label, canonical_source, load_histories
from .store import Store, now_iso, parse_dt

MIN_EVENTS_FOR_TENDENCIES = 20
SESSION_WINDOW_HOURS = 6
CHANGE_WINDOW_DAYS = 30
EXPLORATORY_GROUPS = {"wildcard"}
EXPLORATORY_TIERS = {"legendary", "mystery"}


def _taxonomy():
    try:
        from genre_taxonomy import load_taxonomy
        return load_taxonomy()
    except Exception:  # pragma: no cover - taxonomy optional
        return None


def _classify(genre, tax):
    if tax is None:
        return {"family": "other", "kind": "genre", "canonical": genre}
    try:
        canonical = tax.normalize(genre) or genre
        family = tax.family_of(genre) or "other"
        kind = tax.kind_of(genre) or "genre"
    except Exception:
        return {"family": "other", "kind": "genre", "canonical": genre}
    return {"family": family, "kind": kind if kind in ("family", "subgenre", "microgenre") else "genre",
            "canonical": canonical}


def _plays(t):
    try:
        return max(1, int(t.get("play_count", 1) or 1))
    except (TypeError, ValueError):
        return 1


# ---------------------------------------------------------------------------
# Build (streamed as real steps)
# ---------------------------------------------------------------------------

def build_steps(store: Store, *, demo=False):
    """Generator of progress steps. The last item is {"step": "done", "dna": {...}}.

    Each step reports what actually happened and how long it took; the UI shows
    these as they stream in. No artificial delays."""
    import analyze_taste as analyzer
    from merge_listening_sources import merge_histories
    from source_common import compute_coverage, make_history

    def step(sid, text, detail, t0, **extra):
        return {"step": sid, "label": text, "detail": detail, "ms": int((time.perf_counter() - t0) * 1000), **extra}

    t0 = time.perf_counter()
    histories = load_histories(store, demo=demo)
    if not histories:
        raise ProductError("NO_SOURCES", "No sources connected",
                           "Connect or import at least one music source to build your DNA.")
    per_source = {}
    all_times = []
    raw_rows = 0
    for pid, h in histories:
        cid = canonical_source(pid)
        s = per_source.setdefault(cid, {"id": cid, "label": label(cid), "rows": 0, "events": 0})
        for t in h["tracks"]:
            s["rows"] += 1
            s["events"] += _plays(t)
            for ts in [t.get("played_at")] + list(t.get("played_at_samples") or []):
                d = parse_dt(ts)
                if d:
                    all_times.append(d)
        raw_rows += len(h["tracks"])
    raw_events = sum(s["events"] for s in per_source.values())
    yield step("read", "Reading listening history",
               f"{raw_rows:,} rows · {raw_events:,} listening events from {len(per_source)} source(s)", t0)

    t0 = time.perf_counter()
    merged = merge_histories([h for _pid, h in histories])
    cross = [t for t in merged if len(t.get("sources") or []) > 1]
    yield step("dedupe", "Resolving duplicate tracks",
               f"{raw_rows:,} rows → {len(merged):,} unique tracks"
               + (f" · {len(cross):,} matched across services" if cross else ""), t0)

    t0 = time.perf_counter()
    artist_plays = Counter()
    artist_names = {}
    for t in merged:
        key = str(t.get("artist_name", "")).strip().lower()
        if key:
            artist_plays[key] += _plays(t)
            artist_names.setdefault(key, t.get("artist_name"))
    yield step("artists", "Matching artists", f"{len(artist_plays):,} distinct artists", t0)

    t0 = time.perf_counter()
    history = make_history("merged" if not demo else "demo", merged)
    enrich = {"filled": 0, "missing": 0}
    try:
        import enrich_genres
        history, enrich = enrich_genres.enrich_history(history, lastfm_client=None)
    except Exception:
        pass
    tracks = history["tracks"]
    with_genres = sum(1 for t in tracks if t.get("genres"))
    yield step("genres", "Mapping genres",
               f"{with_genres:,} of {len(tracks):,} tracks have genres"
               + (f" ({enrich.get('filled', 0):,} inferred from artist data)" if enrich.get("filled") else ""), t0)

    t0 = time.perf_counter()
    genre_affinity = analyzer.calculate_genre_affinity(tracks)
    recurring = analyzer.calculate_artist_recurrence(tracks)
    mood = analyzer.calculate_mood_profile(tracks, genre_affinity)
    repetition = analyzer.calculate_repetition_pattern(tracks)
    drift = analyzer.calculate_taste_drift(tracks)
    yield step("affinities", "Calculating affinities",
               f"{len(genre_affinity)} genre and {len(recurring)} artist affinities", t0)

    t0 = time.perf_counter()
    novelty_tolerance = analyzer.calculate_novelty_tolerance(repetition)
    adaptive = None
    try:
        from music_dna_brain import build_adaptive_dna
        adaptive = build_adaptive_dna([], store.feedback_path if store.feedback_path.exists() else None)
    except Exception:
        adaptive = None
    yield step("discovery", "Building discovery profile",
               f"{(adaptive or {}).get('evidence_count', 0)} feedback signals learned so far", t0)

    t0 = time.perf_counter()
    coverage = compute_coverage(history)
    tax = _taxonomy()
    dna = _compose(tracks, per_source, raw_rows, raw_events, all_times, cross, artist_plays, artist_names,
                   genre_affinity, recurring, mood, repetition, drift, novelty_tolerance, adaptive,
                   coverage, tax, demo, enrich)
    previous = None
    try:
        previous = store.read_json(store.dna_path, None)
    except Exception:
        previous = None
    dna["history_changes"] = _history_diff(previous, dna)
    store.write_json(store.dna_path, dna)
    # 2.x compatibility: keep the merged history + coverage files the classic
    # workspace and Portable DNA export read.
    if not demo:
        store.write_json(store.path("merged_listening_history.json"), history)
        store.write_json(store.path("source_coverage.json"), coverage)
    store.write_json(store.path("local_taste_profile.json"), dna["taste_profile"])
    yield step("dna", "Building Music DNA",
               f"Coverage {coverage['confidence_level'].lower()} · {len(dna['genres'])} genres mapped", t0)
    yield {"step": "done", "dna": dna}


def build(store: Store, *, demo=False):
    steps = []
    dna = None
    for s in build_steps(store, demo=demo):
        if s["step"] == "done":
            dna = s["dna"]
        else:
            steps.append(s)
    return dna, steps


def _history_span(times):
    if not times:
        return None
    first, last = min(times), max(times)
    days = max(0, (last - first).days)
    if days >= 365:
        text = f"{days / 365.25:.1f} years".replace(".0 ", " ")
    elif days >= 60:
        text = f"{round(days / 30.4)} months"
    else:
        text = f"{days} days"
    return {"first": first.isoformat(), "last": last.isoformat(), "days": days, "text": text}


def _state_words(families, mood, novelty_value, has_audio):
    """Three short, evidence-derived words describing the current state."""
    words = []
    for f in families[:2]:
        words.append(f["label"])
    moods = [m for m in (mood.get("dominant_moods") or []) if m]
    if moods:
        words.append(moods[0].title())
    if has_audio:
        e = mood.get("average_energy", 0.5)
        words.append("High-energy" if e >= 0.66 else "Low-energy" if e <= 0.33 else "Mid-energy")
    if novelty_value is not None:
        words.append("Exploratory" if novelty_value >= 0.55 else "Loyal" if novelty_value <= 0.3 else "Balanced")
    seen, out = set(), []
    for w in words:
        if w.lower() not in seen:
            seen.add(w.lower())
            out.append(w)
    return out[:3]


def _compose(tracks, per_source, raw_rows, raw_events, all_times, cross, artist_plays, artist_names,
             genre_affinity, recurring, mood, repetition, drift, novelty_tolerance, adaptive,
             coverage, tax, demo, enrich):
    # --- genres with taxonomy placement -------------------------------------
    genre_weight = Counter()
    genre_tracks = Counter()
    genre_inferred = Counter()
    artist_genres = defaultdict(Counter)
    for t in tracks:
        w = _plays(t)
        a = str(t.get("artist_name", "")).strip().lower()
        for g in t.get("genres") or []:
            g = str(g).strip().lower()
            if not g:
                continue
            genre_weight[g] += w
            genre_tracks[g] += 1
            if t.get("genres_inferred"):
                genre_inferred[g] += 1
            if a:
                artist_genres[a][g] += w
    top = genre_weight.most_common(1)[0][1] if genre_weight else 1
    genres = []
    for g, w in genre_weight.most_common(40):
        c = _classify(g, tax)
        genres.append({"name": g, "affinity": round(w / top, 3), "weight": w, "tracks": genre_tracks[g],
                       "family": c["family"], "kind": c["kind"],
                       "inferred_share": round(genre_inferred[g] / max(1, genre_tracks[g]), 2)})
    fam_weight = Counter()
    for g in genres:
        fam_weight[g["family"]] += g["weight"]
    ftop = fam_weight.most_common(1)[0][1] if fam_weight else 1
    families = [{"id": f, "label": f.replace("-", " ").title() if f != "r&b" else "R&B",
                 "affinity": round(w / ftop, 3),
                 "genres": [g["name"] for g in genres if g["family"] == f][:8]}
                for f, w in fam_weight.most_common(8)]
    microgenres = [g for g in genres if g["kind"] == "microgenre"][:12]

    # --- artists -------------------------------------------------------------
    atop = artist_plays.most_common(1)[0][1] if artist_plays else 1
    artists = []
    for a, plays in artist_plays.most_common(30):
        gs = [g for g, _ in artist_genres[a].most_common(3)]
        fam = _classify(gs[0], tax)["family"] if gs else "other"
        artists.append({"name": artist_names.get(a) or a, "plays": plays, "affinity": round(plays / atop, 3),
                        "genres": gs, "family": fam})

    has_audio = any(t.get("audio_features") for t in tracks)
    enough = raw_events >= MIN_EVENTS_FOR_TENDENCIES
    learned_shift = (adaptive or {}).get("novelty_shift") or 0.0
    discovery_value = round(max(0.0, min(1.0, novelty_tolerance + learned_shift)), 3) if enough else None

    # --- dimensions ------------------------------------------------------------
    def insufficient(reason):
        return {"status": "insufficient_data", "reason": reason}

    dims = {}
    dims["genre_affinity"] = ({"status": "ok", "top": [g["name"] for g in genres[:5]],
                               "basis": f"{sum(genre_tracks.values()):,} genre tags across {len(tracks):,} tracks"}
                              if genres else insufficient("None of your tracks carry genre information yet."))
    dims["microgenre_affinity"] = ({"status": "ok", "top": [g["name"] for g in microgenres[:5]],
                                    "basis": "Genres the taxonomy classifies as microgenres"}
                                   if microgenres else insufficient("No microgenre-level tags found in your history."))
    dims["artist_affinity"] = ({"status": "ok", "top": [a["name"] for a in artists[:5]],
                                "basis": f"Play counts across {len(artist_plays):,} artists"}
                               if artists else insufficient("No artist information found."))
    if enough:
        repeat = repetition.get("repeat_ratio", 0.0)
        dims["familiarity"] = {"status": "ok", "value": round(repeat, 3),
                               "basis": f"{round(repeat * 100)}% of your listening events are repeat plays"}
        dims["novelty"] = {"status": "ok", "value": round(novelty_tolerance, 3),
                           "basis": f"{round(repetition.get('unique_track_ratio', 0) * 100)}% of events are distinct tracks"}
        dims["discovery_tolerance"] = {"status": "ok", "value": discovery_value,
                                       "basis": "Share of distinct tracks, adjusted by your 'too similar' / 'too strange' feedback"
                                       + (f" ({learned_shift:+.2f})" if learned_shift else "")}
    else:
        msg = f"Needs at least {MIN_EVENTS_FOR_TENDENCIES} listening events (you have {raw_events})."
        dims["familiarity"] = insufficient(msg)
        dims["novelty"] = insufficient(msg)
        dims["discovery_tolerance"] = insufficient(msg)
    pops = [float(t["popularity"]) for t in tracks if isinstance(t.get("popularity"), (int, float))]
    if len(pops) >= max(10, 0.3 * len(tracks)):
        avg = sum(pops) / len(pops)
        avg = avg / 100.0 if avg > 1 else avg
        dims["mainstream_niche"] = {"status": "ok", "value": round(1 - avg, 3),
                                    "basis": f"Average popularity of {len(pops):,} tracks that report it (1 = niche)"}
    else:
        dims["mainstream_niche"] = insufficient("Your sources don't report track popularity for enough tracks.")
    timestamped = sum(1 for t in tracks if t.get("played_at"))
    has_ranges = any(t.get("time_range") for t in tracks)
    if (timestamped >= 20 and timestamped >= 0.3 * len(tracks)) or has_ranges:
        dims["recent_shift"] = {"status": "ok", "rising": drift.get("new_patterns", [])[:5],
                                "fading": drift.get("disappeared_patterns", [])[:5],
                                "stable": drift.get("stable_patterns", [])[:5],
                                "basis": "Newest third of dated plays vs oldest third" if not has_ranges
                                else "Spotify short-term vs long-term top tracks"}
    else:
        dims["recent_shift"] = insufficient("Not enough timestamped plays to compare recent vs older listening.")
    ctx = (adaptive or {}).get("context_affinity") or {}
    dims["context_affinity"] = ({"status": "ok", "values": dict(sorted(ctx.items(), key=lambda kv: -kv[1])[:6]),
                                 "basis": "Learned from feedback given inside each context"}
                                if ctx else insufficient("Open a few capsules in different moods to learn this."))

    novelty_for_label = discovery_value if discovery_value is not None else None
    taste_profile = {
        "generated_at": now_iso(),
        "core_genres": genre_affinity,
        "recurring_artists": recurring,
        "mood_profile": mood,
        "energy_level": round(mood.get("average_energy", 0.5), 3),
        "mainstream_vs_niche": dims["mainstream_niche"].get("value", 0.5),
        "repetition_pattern": repetition,
        "novelty_tolerance": round(novelty_tolerance, 3),
        "taste_drift": drift,
    }
    try:
        import analyze_taste as analyzer
        taste_profile["emotional_tone"] = analyzer.determine_emotional_tone(mood)
        taste_profile["possible_use_cases"] = analyzer.suggest_use_cases(mood, mood.get("average_energy", 0.5))
    except Exception:
        pass

    learned = {
        "evidence_count": (adaptive or {}).get("evidence_count", 0),
        "confidence": (adaptive or {}).get("confidence", 0.0),
        "novelty_shift": learned_shift,
        "genres": dict(sorted(((adaptive or {}).get("genre_affinity") or {}).items(), key=lambda kv: -abs(kv[1]))[:10]),
        "artists": dict(sorted(((adaptive or {}).get("artist_affinity") or {}).items(), key=lambda kv: -abs(kv[1]))[:10]),
    }
    return {
        "kind": "music_dna", "version": VERSION, "generated_at": now_iso(), "demo": bool(demo),
        "stats": {
            "raw_events": raw_events, "raw_rows": raw_rows, "unique_tracks": len(tracks),
            "artists": len(artist_plays), "genres": len(genre_weight),
            "source_count": len(per_source), "sources": sorted(per_source.values(), key=lambda s: -s["events"]),
            "cross_service_matches": len(cross), "history_span": _history_span(all_times),
            "timestamped_share": round(timestamped / max(1, len(tracks)), 3),
            "genre_coverage": round(sum(1 for t in tracks if t.get("genres")) / max(1, len(tracks)), 3),
            "inferred_genres": enrich.get("filled", 0),
        },
        "coverage": {"level": coverage.get("confidence_level"), "score": coverage.get("confidence_score"),
                     "reasons": coverage.get("confidence_reasons", [])},
        "state_words": _state_words(families, mood, novelty_for_label, has_audio),
        "families": families, "genres": genres, "microgenres": microgenres, "artists": artists,
        "dimensions": dims, "mood": mood, "learned": learned, "taste_profile": taste_profile,
        "known_artists": sorted(artist_plays.keys())[:5000],
    }


def _history_diff(previous, current):
    """What changed between two builds (e.g. after a new import). Factual only."""
    if not previous:
        return []
    out = []
    ps, cs = previous.get("stats", {}), current.get("stats", {})
    if cs.get("raw_events", 0) != ps.get("raw_events", 0):
        delta = cs.get("raw_events", 0) - ps.get("raw_events", 0)
        out.append({"kind": "history", "text": f"{abs(delta):,} listening events {'added' if delta > 0 else 'removed'} since your last build."})
    prev_top = [g["name"] for g in previous.get("genres", [])[:8]]
    cur_top = [g["name"] for g in current.get("genres", [])[:8]]
    new = [g for g in cur_top if g not in prev_top]
    gone = [g for g in prev_top if g not in cur_top]
    if new:
        out.append({"kind": "history", "text": "New in your core genres: " + ", ".join(new[:4]) + "."})
    if gone:
        out.append({"kind": "history", "text": "No longer in your top genres: " + ", ".join(gone[:4]) + "."})
    return out


def load(store: Store):
    return store.read_json(store.dna_path, None)


def summary(dna):
    """Compact DNA view for the home screen."""
    if not dna:
        return None
    return {k: dna[k] for k in ("generated_at", "demo", "stats", "coverage", "state_words", "families")} | {
        "top_genres": [g["name"] for g in dna.get("genres", [])[:6]],
        "top_artists": [a["name"] for a in dna.get("artists", [])[:6]],
        "microgenres": [g["name"] for g in dna.get("microgenres", [])[:6]],
        "discovery": dna.get("dimensions", {}).get("discovery_tolerance"),
        "familiarity": dna.get("dimensions", {}).get("familiarity"),
    }


# ---------------------------------------------------------------------------
# Session taste (short-term) — can rerank, never mutates durable DNA
# ---------------------------------------------------------------------------

def session_events(store: Store, settings, now=None):
    now = now or datetime.now(timezone.utc)
    since = now - timedelta(hours=SESSION_WINDOW_HOURS)
    reset = parse_dt(settings.get("session_reset_at"))
    if reset and reset > since:
        since = reset
    rows = []
    for r in store.read_jsonl(store.feedback_path):
        ts = parse_dt(r.get("timestamp"))
        if ts and ts >= since and r.get("origin") == "capsule":
            rows.append(r)
    return rows


def session_taste(store: Store, settings, dna=None):
    rows = session_events(store, settings)
    try:
        from recommendation_quality import blend_session_preferences
        vec = blend_session_preferences((dna or {}).get("learned"), rows)
    except Exception:
        vec = {"genre": {}, "artist": {}, "cap": 0.12, "durable_dna_mutated": False}
    rising = [g for g, v in sorted(vec["genre"].items(), key=lambda kv: -kv[1]) if v > 0.01][:5]
    cooling = [g for g, v in sorted(vec["genre"].items(), key=lambda kv: kv[1]) if v < -0.01][:5]
    intents = Counter(r.get("intent") for r in rows if r.get("intent"))
    return {"events": len(rows), "window_hours": SESSION_WINDOW_HOURS, "rising": rising, "cooling": cooling,
            "intent": intents.most_common(1)[0][0] if intents else None,
            "vector": vec, "durable_dna_mutated": False,
            "explanation": ("Short-term context from this listening session. It nudges the next capsule "
                            "(at most ±12%) and fades after a few hours; it never rewrites your core DNA.")}


# ---------------------------------------------------------------------------
# "Why did my DNA change?" — evidence-based change feed
# ---------------------------------------------------------------------------

_VERBS = [("completed", "listened through {n} related track{s}"), ("love", "loved {n}"), ("save", "saved {n}"),
          ("replay", "replayed {n}"), ("more_like_this", "asked for more like {n}"),
          ("skip", "skipped {n}"), ("not_for_me", "marked {n} as not for you")]


def _why(counts):
    parts = []
    for action, tpl in _VERBS:
        n = counts.get(action, 0)
        if n:
            parts.append(tpl.format(n=n, s="" if n == 1 else "s"))
    if not parts:
        return ""
    return parts[0] if len(parts) == 1 else ", ".join(parts[:-1]) + " and " + parts[-1]


def change_feed(store: Store, dna=None, window_days=CHANGE_WINDOW_DAYS, now=None):
    from music_dna_brain import ACTION_WEIGHT, EXPLORATORY_NEGATIVE_FACTOR
    now = now or datetime.now(timezone.utc)
    since = now - timedelta(days=window_days)
    rows = [r for r in store.read_jsonl(store.feedback_path)
            if (parse_dt(r.get("timestamp")) or now) >= since]
    items = []
    by_genre = defaultdict(Counter)
    net_genre = Counter()
    for r in rows:
        a = str(r.get("action") or r.get("feedback") or "").lower()
        w = ACTION_WEIGHT.get(a)
        if w is None:
            continue
        if w < 0 and str(r.get("capsule_rarity", "")).lower() in EXPLORATORY_TIERS:
            w *= EXPLORATORY_NEGATIVE_FACTOR
        for g in r.get("genres") or []:
            g = str(g).lower()
            by_genre[g][a] += 1
            net_genre[g] += w
    for g, net in sorted(net_genre.items(), key=lambda kv: -abs(kv[1])):
        n = sum(by_genre[g].values())
        if n < 2 or abs(net) < 0.9:
            continue
        up = net > 0
        size = "" if abs(net) >= 2.0 else " slightly"
        items.append({
            "kind": "genre", "subject": g, "direction": "up" if up else "down",
            "title": f"Your {g} affinity {'increased' if up else 'decreased'}{size}.",
            "why": f"You {_why(by_genre[g])} during the last {window_days} days.",
            "evidence": n, "confidence": "likely" if n >= 4 else "early signal",
        })
        if len(items) >= 5:
            break

    # Discovery tolerance: explicit novelty feedback + skips on far picks vs baseline.
    sim = sum(1 for r in rows if r.get("action") == "too_similar")
    strange = sum(1 for r in rows if r.get("action") == "too_strange")
    far = [r for r in rows if r.get("group") in EXPLORATORY_GROUPS and r.get("action") in ("skip", "not_for_me", "save", "love", "replay", "completed")]
    near = [r for r in rows if r.get("group") and r.get("group") not in EXPLORATORY_GROUPS and r.get("action") in ("skip", "not_for_me", "save", "love", "replay", "completed")]
    neg = lambda rs: sum(1 for r in rs if r.get("action") in ("skip", "not_for_me")) / max(1, len(rs))
    reasons = []
    direction = 0
    if sim or strange:
        direction += sim - strange
        if sim:
            reasons.append(f"you marked {sim} track{'s' if sim != 1 else ''} as too similar")
        if strange:
            reasons.append(f"you marked {strange} track{'s' if strange != 1 else ''} as too strange")
    if len(far) >= 3 and len(near) >= 3:
        fr, nr = neg(far), neg(near)
        if fr - nr >= 0.2:
            direction -= 1
            reasons.append(f"experimental picks were skipped more often than your baseline ({round(fr * 100)}% vs {round(nr * 100)}%)")
        elif nr - fr >= 0.2:
            direction += 1
            reasons.append(f"you kept experimental picks more often than familiar ones ({round((1 - fr) * 100)}% vs {round((1 - nr) * 100)}%)")
    if direction and reasons:
        up = direction > 0
        items.append({"kind": "discovery", "subject": "discovery tolerance", "direction": "up" if up else "down",
                      "title": f"Your discovery tolerance {'increased' if up else 'decreased'} slightly.",
                      "why": "Signals suggest this because " + "; ".join(reasons) + ".",
                      "evidence": sim + strange + len(far), "confidence": "early signal"})

    # Artist network expansion: positive reactions to artists outside your history.
    known = set((dna or {}).get("known_artists") or [])
    new_artists = []
    for r in rows:
        if r.get("action") in ("love", "save", "replay", "more_like_this"):
            a = str(r.get("artist") or "").strip()
            if a and a.lower() not in known and a not in new_artists:
                new_artists.append(a)
    if new_artists and dna:
        items.append({"kind": "artists", "subject": "artist network", "direction": "up",
                      "title": "Your artist network expanded.",
                      "why": "You reacted positively to artists that weren't in your history: " + ", ".join(new_artists[:4])
                      + ("…" if len(new_artists) > 4 else "") + ".",
                      "evidence": len(new_artists), "confidence": "observed"})
    for h in (dna or {}).get("history_changes", []):
        items.append({"kind": "history", "subject": "listening history", "direction": "neutral",
                      "title": h["text"], "why": "From your latest DNA build.", "evidence": None, "confidence": "observed"})
    return {"window_days": window_days, "feedback_events": len(rows), "items": items,
            "note": ("Changes come from your recorded reactions. A single skip is bounded, reactions inside "
                     "Legendary/Mystery capsules count half when negative, and one capsule can only move a "
                     "genre so far — so one evening never rewrites years of listening.")}
