#!/usr/bin/env python3
"""Music DNA Brain v2.4 — time-decayed, behavior-aware taste learning.

Pure stdlib. It converts listening history + explicit/implicit feedback into a
transparent adaptive layer consumed by the recommendation scorer.
"""
from __future__ import annotations
import json, math
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ACTION_WEIGHT = {
    "completed": 0.45, "complete": 0.45, "like": 0.8, "save": 1.25,
    "replay": 1.5, "more_like_this": 1.35,
    "skip": -0.55, "not_for_me": -1.25, "dislike": -1.25,
}
NOVELTY_DELTA = {"too_similar": 0.08, "too_strange": -0.08}

def clamp(v, lo=0.0, hi=1.0): return max(lo, min(hi, v))

def _dt(value):
    if not value: return None
    try: return datetime.fromisoformat(str(value).replace("Z", "+00:00")).astimezone(timezone.utc)
    except (ValueError, TypeError): return None

def recency_weight(timestamp, now=None, half_life_days=120.0, floor=0.12):
    t=_dt(timestamp)
    if not t: return 0.55
    now=now or datetime.now(timezone.utc)
    age=max(0.0,(now-t).total_seconds()/86400)
    return max(floor, math.pow(0.5, age/max(1.0,half_life_days)))

def _norm(s): return str(s or "").strip().lower()

def _feedback_records(path):
    p=Path(path) if path else None
    if not p or not p.exists(): return []
    out=[]
    for line in p.read_text(encoding="utf-8").splitlines():
        try:
            if line.strip(): out.append(json.loads(line))
        except json.JSONDecodeError: pass
    return out

def build_adaptive_dna(history_tracks=None, feedback_path=None, now=None):
    """Return bounded learned preferences plus auditable evidence."""
    now=now or datetime.now(timezone.utc)
    genres=defaultdict(float); artists=defaultdict(float); contexts=defaultdict(float)
    positive=negative=0.0; novelty=0.0; evidence=0

    for tr in history_tracks or []:
        # Repeated listening is positive evidence but logarithmically bounded.
        plays=max(1,int(tr.get("play_count",1) or 1))
        w=recency_weight(tr.get("played_at"),now)*min(2.5,1.0+math.log1p(plays)/2.0)
        for g in tr.get("genres",[]) or []: genres[_norm(g)] += 0.18*w
        a=_norm(tr.get("artist_name") or tr.get("artist"))
        if a: artists[a] += 0.22*w
        evidence += 1

    for r in _feedback_records(feedback_path):
        action=_norm(r.get("action") or r.get("feedback")); rw=recency_weight(r.get("timestamp"),now,90.0)
        if action in NOVELTY_DELTA:
            novelty += NOVELTY_DELTA[action]*rw; evidence += 1; continue
        base=ACTION_WEIGHT.get(action)
        if base is None: continue
        w=base*rw
        positive += max(0,w); negative += max(0,-w); evidence += 1
        for g in r.get("genres",[]) or []: genres[_norm(g)] += w
        a=_norm(r.get("artist"));
        if a: artists[a] += 1.15*w
        task=_norm(r.get("task"));
        if task: contexts[task] += 0.5*w

    # tanh prevents a long history from making preferences irreversible.
    squash=lambda x,scale: round(math.tanh(x/scale),4)
    genre_aff={k:squash(v,4.0) for k,v in genres.items() if k}
    artist_aff={k:squash(v,4.5) for k,v in artists.items() if k}
    context_aff={k:squash(v,3.0) for k,v in contexts.items() if k}
    posneg=positive+negative
    return {
        "version":"2.4", "evidence_count":evidence,
        "genre_affinity":genre_aff, "artist_affinity":artist_aff,
        "context_affinity":context_aff,
        "novelty_shift":round(max(-0.2,min(0.2,novelty)),4),
        "feedback_balance":round(positive/posneg,3) if posneg else None,
        "confidence":round(clamp(1-math.exp(-evidence/25.0)),3),
        "learning_rules":{"history_half_life_days":120,"feedback_half_life_days":90,
                          "single_skip_is_bounded":True,"affinity_squash":"tanh"},
    }

def track_learning_adjustment(track, adaptive, task=None):
    if not adaptive or not adaptive.get("evidence_count"): return 0.0
    gs=[adaptive.get("genre_affinity",{}).get(_norm(g),0.0) for g in track.get("genres",[]) or []]
    genre=sum(gs)/len(gs) if gs else 0.0
    artist=adaptive.get("artist_affinity",{}).get(_norm(track.get("artist")),0.0)
    context=adaptive.get("context_affinity",{}).get(_norm(task),0.0) if task else 0.0
    # Maximum score movement = +/- 0.18; explicit artist behavior is strongest.
    return round(max(-0.18,min(0.18,0.075*genre+0.09*artist+0.025*context)),4)

def explain_changes(adaptive, limit=5):
    if not adaptive or not adaptive.get("evidence_count"):
        return ["Not enough behavioral evidence yet; recommendations still rely on listening history."]
    items=[]
    for kind,key in (("genre","genre_affinity"),("artist","artist_affinity")):
        ranked=sorted(adaptive.get(key,{}).items(),key=lambda kv:abs(kv[1]),reverse=True)
        for name,val in ranked[:limit]:
            if abs(val)<0.08: continue
            direction="strengthened" if val>0 else "weakened"
            items.append(f"{kind.title()} affinity for {name} {direction} ({val:+.2f}) from recent/repeated behavior.")
    return items[:limit]
