#!/usr/bin/env python3
"""Recommendation Quality Lab v2.6.
Offline, deterministic evaluation for ranking/capsules: relevance proxy, diversity,
novelty, coverage, concentration, context fit, calibration and durable-DNA guardrails.
Pure stdlib; safe to run without provider credentials.
"""
from __future__ import annotations
import json, math
from collections import Counter, defaultdict
from pathlib import Path

def _norm(v): return str(v or '').strip().lower()
def _genres(t): return {_norm(g) for g in (t.get('genres') or []) if _norm(g)}
def _artist(t): return _norm(t.get('artist') or t.get('artist_name'))
def _score(t): return float(t.get('confidence_score', t.get('scoring_breakdown',{}).get('confidence_score',0)) or 0)/100.0

def artist_concentration(items):
    if not items: return 0.0
    c=Counter(_artist(x) for x in items if _artist(x)); n=sum(c.values())
    return round(sum((v/n)**2 for v in c.values()),4) if n else 0.0

def diversity(items):
    if len(items)<2: return 1.0 if items else 0.0
    pairs=0; distance=0.0
    for i,a in enumerate(items):
        for b in items[i+1:]:
            ga,gb=_genres(a),_genres(b); union=ga|gb
            genre_d=1-(len(ga&gb)/len(union) if union else 0.0)
            artist_d=0.0 if _artist(a) and _artist(a)==_artist(b) else 1.0
            distance += .75*genre_d+.25*artist_d; pairs+=1
    return round(distance/pairs,4)

def novelty(items):
    if not items:return 0.0
    vals=[]
    for x in items:
        sb=x.get('scoring_breakdown',{})
        vals.append(float(x.get('novelty_level',sb.get('track_novelty',0.5)) or 0.5))
    return round(sum(vals)/len(vals),4)

def catalog_coverage(items,catalog):
    if not catalog:return 0.0
    key=lambda x:(_artist(x),_norm(x.get('track_title') or x.get('title')))
    return round(len({key(x) for x in items})/max(1,len({key(x) for x in catalog})),4)

def relevance_proxy(items):
    return round(sum(_score(x) for x in items)/len(items),4) if items else 0.0

def context_fit(items):
    if not items:return 0.0
    vals=[]
    for x in items:
        sb=x.get('scoring_breakdown',{})
        vals.append((float(x.get('mood_match',sb.get('mood_match_score',.5)))+float(x.get('task_match',sb.get('task_match_score',.5))))/2)
    return round(sum(vals)/len(vals),4)

def calibration(items):
    """Confidence-vs-observed proxy. Uses explicit outcome when present; otherwise neutral."""
    rows=[]
    positive={'save','replay','completed','like','more_like_this'}; negative={'skip','not_for_me','dislike'}
    for x in items:
        action=_norm(x.get('observed_action'))
        if action not in positive|negative: continue
        y=1.0 if action in positive else 0.0; rows.append(abs(_score(x)-y))
    return round(1-sum(rows)/len(rows),4) if rows else None

def evaluate(items,catalog=None, *, label='recommendations'):
    items=list(items or []); catalog=list(catalog or [])
    return {'label':label,'count':len(items),'relevance_proxy':relevance_proxy(items),
            'diversity':diversity(items),'novelty':novelty(items),
            'catalog_coverage':catalog_coverage(items,catalog),'artist_concentration':artist_concentration(items),
            'context_fit':context_fit(items),'calibration':calibration(items)}

def capsule_outcomes(history_rows):
    groups=defaultdict(list)
    for row in history_rows or []:
        m=row.get('metrics') or {}; groups[(_norm(row.get('rarity')),_norm((row.get('context') or {}).get('task')))].append(m)
    out=[]
    for (rarity,task),ms in sorted(groups.items()):
        avg=lambda k: round(sum(float(x.get(k,0) or 0) for x in ms)/len(ms),4)
        out.append({'rarity':rarity,'task':task or None,'sessions':len(ms),'completion_rate':avg('completion_rate'),
                    'save_rate':avg('save_rate'),'replay_rate':avg('replay_rate'),'rejection_rate':avg('rejection_rate'),'hit_rate':avg('hit_rate')})
    return out

def blend_session_preferences(durable, session_events, cap=.12):
    """Ephemeral session vector. It can rerank the current session but cannot mutate durable DNA."""
    g=defaultdict(float); a=defaultdict(float); weights={'save':1,'replay':1,'completed':.35,'skip':-.3,'not_for_me':-.8}
    for e in session_events or []:
        w=weights.get(_norm(e.get('action')),0)
        for genre in e.get('genres') or []: g[_norm(genre)]+=w
        if _artist(e): a[_artist(e)]+=w
    squash=lambda v:max(-cap,min(cap,math.tanh(v/2)*cap))
    return {'genre':{k:round(squash(v),4) for k,v in g.items() if k},'artist':{k:round(squash(v),4) for k,v in a.items() if k},
            'cap':cap,'durable_dna_mutated':False,'durable_evidence_count':(durable or {}).get('evidence_count',0)}

def evaluate_file(recommendations_path,catalog_path=None):
    data=json.loads(Path(recommendations_path).read_text(encoding='utf-8')); items=data.get('recommendations',data if isinstance(data,list) else [])
    catalog=json.loads(Path(catalog_path).read_text(encoding='utf-8')) if catalog_path else []
    return evaluate(items,catalog)
