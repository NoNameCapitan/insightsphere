#!/usr/bin/env python3
"""Privacy-first beta instrumentation v2.8.

Local-only product events, funnel/retention summaries, provider health,
algorithm experiment assignment and a compact beta report. No network calls,
PII, raw listening history or track titles are required by the event schema.
"""
from __future__ import annotations
import hashlib, json, uuid
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta
from pathlib import Path

EVENTS = {
    "session_started", "source_connected", "dna_generated", "capsule_opened",
    "capsule_started", "track_played", "track_completed", "track_skipped",
    "track_saved", "track_replayed", "track_rejected", "capsule_completed",
    "capsule_abandoned", "session_returned", "resolver_result",
    # 3.0 additions
    "track_loved", "track_feedback", "onboarding_completed", "capsule_revealed",
}
FUNNEL = ("session_started","dna_generated","capsule_opened","capsule_started","track_played","capsule_completed")
ALLOWED = {"event","ts","session_id","anonymous_user_id","capsule_id","capsule_rarity","provider","resolver_status","algorithm_variant","algorithm_version","context","value","signal_kind"}

def _now(): return datetime.now(timezone.utc).isoformat()
def anonymous_id(seed: str) -> str: return hashlib.sha256(str(seed).encode()).hexdigest()[:16]
def assign_variant(anonymous_user_id: str, variants=("control","challenger")) -> str:
    if not variants: raise ValueError("variants required")
    n=int(hashlib.sha256(anonymous_user_id.encode()).hexdigest()[:8],16)
    return variants[n % len(variants)]

def make_event(event, *, session_id=None, anonymous_user_id=None, **fields):
    if event not in EVENTS: raise ValueError(f"Unknown beta event: {event}")
    row={"event":event,"ts":fields.pop("ts",None) or _now(),"session_id":session_id or str(uuid.uuid4())}
    if anonymous_user_id: row["anonymous_user_id"]=anonymous_user_id
    for k,v in fields.items():
        if k in ALLOWED and v is not None: row[k]=v
    return row

def append_event(path, event):
    p=Path(path); p.parent.mkdir(parents=True,exist_ok=True)
    safe={k:v for k,v in event.items() if k in ALLOWED}
    if safe.get("event") not in EVENTS: raise ValueError("Invalid event")
    with p.open("a",encoding="utf-8") as f: f.write(json.dumps(safe,ensure_ascii=False)+"\n")
    return safe

def read_events(path):
    p=Path(path)
    if not p.exists(): return []
    out=[]
    for line in p.read_text(encoding="utf-8").splitlines():
        try:
            x=json.loads(line)
            if x.get("event") in EVENTS: out.append(x)
        except ValueError: pass
    return out

def funnel(events):
    sessions=defaultdict(set)
    for e in events: sessions[e.get("session_id")].add(e.get("event"))
    total=max(1,len(sessions)); result={}
    previous=None
    for step in FUNNEL:
        n=sum(step in seen for seen in sessions.values())
        result[step]={"sessions":n,"session_rate":round(n/total,3),"step_rate":round(n/max(1,previous),3) if previous is not None else 1.0}
        previous=n
    return result

def provider_health(events):
    by=defaultdict(Counter)
    for e in events:
        if e.get("event")=="resolver_result" and e.get("provider"):
            by[e["provider"]][e.get("resolver_status") or "unknown"]+=1
    out={}
    for provider,c in by.items():
        n=sum(c.values()); exact=c["provider_id"]+c["isrc"]+c["exact_metadata"]
        out[provider]={"attempts":n,"exact_rate":round(exact/max(1,n),3),"fuzzy_rate":round(c["fuzzy_metadata"]/max(1,n),3),"search_fallback_rate":round(c["search_fallback"]/max(1,n),3),"unresolved_rate":round(c["unresolved"]/max(1,n),3)}
    return out

def capsule_outcomes(events):
    by=defaultdict(Counter)
    for e in events:
        rarity=e.get("capsule_rarity")
        if rarity: by[rarity][e.get("event")]+=1
    out={}
    for rarity,c in by.items():
        started=max(1,c["capsule_started"]); played=max(1,c["track_played"])
        out[rarity]={"started":c["capsule_started"],"completed":c["capsule_completed"],"completion_rate":round(c["capsule_completed"]/started,3),"save_rate":round(c["track_saved"]/played,3),"replay_rate":round(c["track_replayed"]/played,3),"rejection_rate":round(c["track_rejected"]/played,3)}
    return out

def experiment_summary(events):
    by=defaultdict(Counter)
    for e in events:
        v=e.get("algorithm_variant")
        if v: by[v][e.get("event")]+=1
    return {v:{"sessions":len({e.get('session_id') for e in events if e.get('algorithm_variant')==v}),"capsules_completed":c["capsule_completed"],"tracks_saved":c["track_saved"],"tracks_replayed":c["track_replayed"],"tracks_rejected":c["track_rejected"]} for v,c in by.items()}

def retention(events, days=7):
    users=defaultdict(list)
    for e in events:
        if e.get("anonymous_user_id"):
            try: users[e["anonymous_user_id"]].append(datetime.fromisoformat(e["ts"].replace("Z","+00:00")))
            except Exception: pass
    eligible=returned=0
    for times in users.values():
        if not times: continue
        first=min(times); eligible+=1
        if any(t.date()>first.date() and t<=first+timedelta(days=days) for t in times): returned+=1
    return {"window_days":days,"users":eligible,"returned_users":returned,"return_rate":round(returned/max(1,eligible),3)}

def outcome_breakdown(events, key):
    """Capsule outcomes grouped by any allowed field (rarity/context/provider/variant).

    `track_played` means the user opened the track in a service or reported
    listening to it; the app cannot observe playback inside external apps."""
    by=defaultdict(Counter)
    for e in events:
        k=e.get(key)
        if k: by[str(k)][e.get("event")]+=1
    out={}
    for k,c in by.items():
        opened=c["capsule_opened"]; started=c["capsule_started"]; played=max(1,c["track_played"])
        out[k]={"opened":opened,"started":started,"completed":c["capsule_completed"],
                "completion_rate":round(c["capsule_completed"]/max(1,started),3),
                "save_rate":round(c["track_saved"]/played,3),"replay_rate":round(c["track_replayed"]/played,3),
                "rejection_rate":round(c["track_rejected"]/played,3)}
    return out

def beta_report(events):
    return {"kind":"music_dna_beta_report","version":"3.0","generated_at":_now(),"privacy":{"local_only":True,"raw_track_titles_required":False,"raw_listening_history_required":False},"events":len(events),"sessions":len({e.get('session_id') for e in events if e.get('session_id')}),"funnel":funnel(events),"retention":retention(events),"capsules":capsule_outcomes(events),"provider_health":provider_health(events),"experiments":experiment_summary(events),
            "breakdowns":{k:outcome_breakdown(events,k) for k in ("capsule_rarity","context","provider","algorithm_variant")},
            "definitions":{"track_played":"Opened in a music service or marked as listened; playback inside external apps is not observable.",
                           "returning_users_proxy":"Users with events on a later calendar day within the window (local device only)."}}
