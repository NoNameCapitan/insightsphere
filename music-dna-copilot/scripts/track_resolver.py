#!/usr/bin/env python3
"""Track Resolver v2.7: deterministic cross-provider playback routing.

Resolution order: exact provider id/URI -> ISRC catalog -> normalized exact
metadata -> conservative fuzzy metadata -> provider search fallback. Pure stdlib.
"""
from __future__ import annotations
import re
from difflib import SequenceMatcher
from urllib.parse import quote_plus

PROVIDER_ORDER=("spotify","apple_music","youtube_music","deezer","tidal","soundcloud")

def _norm(v):
    s=str(v or "").lower().strip()
    s=re.sub(r"\([^)]*(remaster|live|edit|version)[^)]*\)","",s)
    s=re.sub(r"[^a-z0-9а-яіїєґ]+"," ",s,flags=re.I)
    return re.sub(r"\s+"," ",s).strip()

def _title(t): return t.get("track_title") or t.get("track_name") or t.get("title") or ""
def _artist(t): return t.get("artist") or t.get("artist_name") or ""
def _album(t): return t.get("album") or t.get("album_name") or ""

def search_url(provider, track):
    q=quote_plus(f"{_artist(track)} {_title(track)}")
    templates={
      "spotify":f"https://open.spotify.com/search/{q}",
      "apple_music":f"https://music.apple.com/us/search?term={q}",
      "youtube_music":f"https://music.youtube.com/search?q={q}",
      "deezer":f"https://www.deezer.com/search/{q}",
      "tidal":f"https://listen.tidal.com/search?q={q}",
      "soundcloud":f"https://soundcloud.com/search/sounds?q={q}",
    }
    return templates.get(provider)

def _provider_ids(t):
    ids=dict(t.get("provider_ids") or {})
    src=t.get("source") or t.get("provider")
    rid=t.get("raw_id") or t.get("provider_id")
    if src and rid: ids.setdefault(src,rid)
    return ids

def _direct_url(provider, track):
    links=track.get("provider_links") or track.get("external_urls") or {}
    if isinstance(links,dict) and links.get(provider): return links[provider]
    ids=_provider_ids(track); pid=ids.get(provider)
    if provider=="spotify":
        uri=track.get("provider_uri")
        if uri and str(uri).startswith("spotify:track:"): return "https://open.spotify.com/track/"+str(uri).split(":")[-1]
        if pid: return f"https://open.spotify.com/track/{pid}"
    return None

def similarity(a,b):
    title=SequenceMatcher(None,_norm(_title(a)),_norm(_title(b))).ratio()
    artist=SequenceMatcher(None,_norm(_artist(a)),_norm(_artist(b))).ratio()
    album=SequenceMatcher(None,_norm(_album(a)),_norm(_album(b))).ratio() if _album(a) and _album(b) else .8
    return .5*title+.4*artist+.1*album

def resolve_in_catalog(track, provider, catalog):
    rows=[r for r in (catalog or []) if (r.get("provider") or r.get("source"))==provider]
    direct=_direct_url(provider,track)
    if direct: return {"provider":provider,"status":"resolved","method":"provider_id","confidence":1.0,"url":direct}
    isrc=str(track.get("isrc") or "").upper()
    if isrc:
        for r in rows:
            if str(r.get("isrc") or "").upper()==isrc:
                return {"provider":provider,"status":"resolved","method":"isrc","confidence":1.0,"url":_direct_url(provider,r) or search_url(provider,r),"match":r}
    nt,na=_norm(_title(track)),_norm(_artist(track))
    for r in rows:
        if nt and na and _norm(_title(r))==nt and _norm(_artist(r))==na:
            return {"provider":provider,"status":"resolved","method":"exact_metadata","confidence":.97,"url":_direct_url(provider,r) or search_url(provider,r),"match":r}
    scored=sorted(((similarity(track,r),r) for r in rows),reverse=True,key=lambda x:x[0])
    if scored and scored[0][0]>=.92:
        score,r=scored[0]
        return {"provider":provider,"status":"resolved","method":"fuzzy_metadata","confidence":round(score,3),"url":_direct_url(provider,r) or search_url(provider,r),"match":r}
    return {"provider":provider,"status":"search_fallback","method":"provider_search","confidence":0.0,"url":search_url(provider,track)}

def route_track(track, *, preferred_provider="spotify", available_providers=None, catalogs=None):
    available=set(available_providers or PROVIDER_ORDER); catalogs=catalogs or {}
    chain=[preferred_provider]+[p for p in PROVIDER_ORDER if p!=preferred_provider]
    attempts=[]
    for p in chain:
        if p not in available: continue
        r=resolve_in_catalog(track,p,catalogs.get(p,[])); attempts.append({k:v for k,v in r.items() if k!="match"})
        if r["status"]=="resolved": return r | {"preferred_provider":preferred_provider,"fallback_used":p!=preferred_provider,"attempts":attempts}
    # Search fallback is actionable but explicitly not claimed as exact resolution.
    for a in attempts:
        if a.get("url"): return a | {"preferred_provider":preferred_provider,"fallback_used":a["provider"]!=preferred_provider,"attempts":attempts}
    return {"provider":None,"status":"unresolved","method":"none","confidence":0.0,"url":None,"preferred_provider":preferred_provider,"fallback_used":False,"attempts":attempts}

def resolver_metrics(results):
    rs=list(results); n=max(1,len(rs)); methods={}
    for r in rs: methods[r.get("method","none")]=methods.get(r.get("method","none"),0)+1
    exact=sum(methods.get(x,0) for x in ("provider_id","isrc","exact_metadata"))
    return {"tracks":len(rs),"exact_rate":round(exact/n,3),"fuzzy_rate":round(methods.get("fuzzy_metadata",0)/n,3),"search_fallback_rate":round(methods.get("provider_search",0)/n,3),"unresolved_rate":round(methods.get("none",0)/n,3),"methods":methods}
