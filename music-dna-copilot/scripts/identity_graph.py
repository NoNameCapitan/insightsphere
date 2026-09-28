#!/usr/bin/env python3
"""Explainable cross-service identity graph v2."""
from __future__ import annotations
import re
from difflib import SequenceMatcher
from source_common import normalize_key

ID_FIELDS=("musicbrainz_recording_id","musicbrainz_id","mbid")

def _norm(s): return " ".join(normalize_key(str(s or ""), "")[0].split())
def _sim(a,b): return SequenceMatcher(None,_norm(a),_norm(b)).ratio()

def provider_ids(track):
    ids={}
    if track.get("provider_ids") and isinstance(track["provider_ids"],dict): ids.update(track["provider_ids"])
    if track.get("source") and track.get("raw_id"): ids[str(track["source"])]=str(track["raw_id"])
    return ids

def match_tracks(a,b):
    ia=str(a.get("isrc","")).strip().upper(); ib=str(b.get("isrc","")).strip().upper()
    if ia and ib and ia==ib: return {"match":True,"method":"isrc","confidence":1.0,"reason":"same ISRC"}
    for f in ID_FIELDS:
        if a.get(f) and b.get(f) and str(a[f])==str(b[f]):
            return {"match":True,"method":"musicbrainz","confidence":0.99,"reason":f"same {f}"}
    pa,pb=provider_ids(a),provider_ids(b)
    for p,val in pa.items():
        if p in pb and str(pb[p])==str(val): return {"match":True,"method":"provider_id","confidence":0.98,"reason":f"same {p} id"}
    title=_sim(a.get("track_name"),b.get("track_name")); artist=_sim(a.get("artist_name"),b.get("artist_name"))
    score=round(.58*title+.42*artist,3)
    album=_sim(a.get("album_name"),b.get("album_name")) if a.get("album_name") and b.get("album_name") else None
    if album is not None: score=round(.50*title+.38*artist+.12*album,3)
    ok=score>=0.92 and title>=0.90 and artist>=0.88
    return {"match":ok,"method":"fuzzy" if ok else "none","confidence":score,"reason":f"title={title:.2f}, artist={artist:.2f}"+(f", album={album:.2f}" if album is not None else "")}

def identity_key(track):
    isrc=str(track.get("isrc","")).strip().upper()
    if isrc: return ("isrc",isrc)
    for f in ID_FIELDS:
        if track.get(f): return ("musicbrainz",str(track[f]))
    ids=provider_ids(track)
    if ids:
        p=sorted(ids)[0]; return ("provider",p,ids[p])
    return ("name",)+normalize_key(track.get("track_name",""),track.get("artist_name",""))
