#!/usr/bin/env python3
"""Music Capsules v2.5 — stateful recommendation sessions.

Pure-stdlib core: packaging, diversity/exploration guardrails, lifecycle,
per-track events, local history metrics, Mystery redaction and provider links.
"""
from __future__ import annotations
import argparse, hashlib, json, re, uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote_plus
try:
    from track_resolver import route_track
except ImportError:
    route_track = None

CAPSULE_SIZES = {"common": 5, "rare": 10, "legendary": 15, "mystery": 10}
VALID_STATES = ("opened", "started", "completed", "abandoned")
TRACK_EVENTS = ("completed", "skip", "save", "replay", "not_for_me")

def _now(): return datetime.now(timezone.utc).isoformat()
def _norm(v): return re.sub(r"\s+", " ", str(v or "").strip().lower())
def _track_id(t):
    raw = t.get("isrc") or t.get("track_id") or f"{_norm(t.get('artist'))}|{_norm(t.get('track_title') or t.get('title'))}"
    return hashlib.sha1(str(raw).encode()).hexdigest()[:16]
def provider_links(track):
    q=quote_plus(f"{track.get('artist','')} {track.get('track_title') or track.get('title','')}")
    links=dict(track.get("search_links") or {})
    links.setdefault("spotify", f"https://open.spotify.com/search/{q}")
    links.setdefault("apple_music", f"https://music.apple.com/us/search?term={q}")
    links.setdefault("youtube_music", f"https://music.youtube.com/search?q={q}")
    links.setdefault("deezer", f"https://www.deezer.com/search/{q}")
    links.setdefault("tidal", f"https://listen.tidal.com/search?q={q}")
    links.setdefault("soundcloud", f"https://soundcloud.com/search/sounds?q={q}")
    return links

def _diverse_select(items, size, max_per_artist=2, recent_track_ids=None, recent_artists=None):
    recent_track_ids=set(recent_track_ids or []); recent_artists={_norm(x) for x in (recent_artists or [])}
    chosen=[]; artist_count={}; deferred=[]
    for t in items:
        tid=_track_id(t); artist=_norm(t.get("artist"))
        penalty=(tid in recent_track_ids)*3 + (artist in recent_artists)*1
        (deferred if penalty else chosen).append(t)
    ordered=chosen+deferred; chosen=[]
    for t in ordered:
        artist=_norm(t.get("artist")); n=artist_count.get(artist,0)
        if artist and n>=max_per_artist: continue
        chosen.append(t); artist_count[artist]=n+1
        if len(chosen)>=size: break
    if len(chosen)<size: # fill only if diversity cap makes capsule impossible
        ids={_track_id(t) for t in chosen}
        for t in ordered:
            if _track_id(t) not in ids: chosen.append(t); ids.add(_track_id(t))
            if len(chosen)>=size: break
    return chosen

def build_capsule(recommendations, rarity="common", context=None, *, preferred_provider="spotify", recent_track_ids=None, recent_artists=None, capsule_id=None, available_providers=None, provider_catalogs=None):
    rarity=str(rarity).lower()
    if rarity not in CAPSULE_SIZES: raise ValueError(f"Unknown capsule rarity: {rarity}")
    items=recommendations.get("recommendations", recommendations if isinstance(recommendations,list) else [])
    size=CAPSULE_SIZES[rarity]
    selected=_diverse_select(items,size,2,recent_track_ids,recent_artists)
    tracks=[]
    for rank,t in enumerate(selected,1):
        x=dict(t); x["track_id"]=_track_id(x); x["capsule_rank"]=rank; x["provider_links"]=provider_links(x)
        if route_track:
            x["playback_route"] = route_track(x, preferred_provider=preferred_provider, available_providers=available_providers, catalogs=provider_catalogs)
        if rarity=="mystery":
            x["mystery_reveal"]={"track_title":x.get("track_title"),"artist":x.get("artist")}
            x["track_title"]="Hidden track"; x["artist"]="Reveal after listening"
        tracks.append(x)
    return {"kind":"music_capsule","version":"2.5","capsule_id":capsule_id or str(uuid.uuid4()),"rarity":rarity,
        "requested_size":size,"actual_size":len(tracks),"generated_at":_now(),"state":"opened","started_at":None,"ended_at":None,
        "context":context or {},"preferred_provider":preferred_provider,"tracks":tracks,"events":[],
        "exploration":{"max_tracks_per_artist":2,"recent_tracks_avoided":len(set(recent_track_ids or [])),"recent_artists_considered":len(set(recent_artists or []))},
        "learning_contract":{"signals":list(TRACK_EVENTS),"note":"Track events feed the adaptive Music DNA brain."},
        "playback_contract":{"resolver":"v2.7","preferred_provider":preferred_provider,"exact_resolution_is_distinguished_from_search_fallback":True}}

def transition(capsule, new_state, timestamp=None):
    if new_state not in VALID_STATES: raise ValueError(f"Invalid capsule state: {new_state}")
    cur=capsule.get("state","opened"); allowed={"opened":{"started","abandoned"},"started":{"completed","abandoned"},"completed":set(),"abandoned":set()}
    if new_state!=cur and new_state not in allowed.get(cur,set()): raise ValueError(f"Invalid transition: {cur} -> {new_state}")
    out=dict(capsule); out["state"]=new_state; ts=timestamp or _now()
    if new_state=="started" and not out.get("started_at"): out["started_at"]=ts
    if new_state in ("completed","abandoned"): out["ended_at"]=ts
    return out

def record_track_event(capsule, track_id, action, timestamp=None):
    if action not in TRACK_EVENTS: raise ValueError(f"Invalid track event: {action}")
    ids={t.get("track_id") for t in capsule.get("tracks",[])}
    if track_id not in ids: raise ValueError("Track does not belong to capsule")
    out=dict(capsule); out["events"]=list(capsule.get("events",[]))+[{"timestamp":timestamp or _now(),"track_id":track_id,"action":action}]
    return out

def capsule_metrics(capsule):
    events=capsule.get("events",[]); n=max(1,len(capsule.get("tracks",[])))
    counts={a:sum(1 for e in events if e.get("action")==a) for a in TRACK_EVENTS}
    touched=len({e.get("track_id") for e in events})
    positive=counts["save"]+counts["replay"]
    return {"tracks":len(capsule.get("tracks",[])),"tracks_with_feedback":touched,"completion_rate":round(counts["completed"]/n,3),
            "save_rate":round(counts["save"]/n,3),"replay_rate":round(counts["replay"]/n,3),"rejection_rate":round(counts["not_for_me"]/n,3),
            "hit_rate":round(min(1.0,positive/n),3),"event_counts":counts}

def append_history(path,capsule):
    p=Path(path); p.parent.mkdir(parents=True,exist_ok=True)
    row={k:capsule.get(k) for k in ("capsule_id","rarity","generated_at","state","started_at","ended_at","context","preferred_provider")}; row["metrics"]=capsule_metrics(capsule)
    with p.open("a",encoding="utf-8") as f: f.write(json.dumps(row,ensure_ascii=False)+"\n")
    return row

def main():
    ap=argparse.ArgumentParser(); ap.add_argument("recommendations"); ap.add_argument("--rarity",choices=CAPSULE_SIZES,default="common"); ap.add_argument("--provider",default="spotify"); ap.add_argument("--output",default="outputs/music_capsule.json")
    a=ap.parse_args(); data=json.loads(Path(a.recommendations).read_text(encoding="utf-8")); out=build_capsule(data,a.rarity,preferred_provider=a.provider); p=Path(a.output); p.parent.mkdir(parents=True,exist_ok=True); p.write_text(json.dumps(out,indent=2,ensure_ascii=False),encoding="utf-8"); print(p)
if __name__=="__main__": main()
