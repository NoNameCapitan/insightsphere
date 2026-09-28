#!/usr/bin/env python3
import tempfile
from pathlib import Path
from beta_instrumentation import *

PASS=[]
def ck(name,x):
    assert x,name; PASS.append(name); print('  PASS ',name)

def main():
    uid=anonymous_id('local-user')
    ck('anonymous id stable',uid==anonymous_id('local-user') and len(uid)==16)
    ck('variant stable',assign_variant(uid)==assign_variant(uid))
    sid='s1'; rows=[]
    for name in ('session_started','dna_generated','capsule_opened','capsule_started','track_played','track_saved','capsule_completed'):
        rows.append(make_event(name,session_id=sid,anonymous_user_id=uid,capsule_rarity='common',algorithm_variant='control'))
    rows.append(make_event('resolver_result',session_id=sid,provider='spotify',resolver_status='provider_id'))
    rows.append(make_event('resolver_result',session_id=sid,provider='apple_music',resolver_status='search_fallback'))
    with tempfile.TemporaryDirectory() as d:
        p=Path(d)/'beta.jsonl'
        for r in rows: append_event(p,{**r,'track_title':'must not persist','email':'x@y'})
        got=read_events(p); ck('events persisted',len(got)==len(rows)); ck('PII/track fields stripped','track_title' not in p.read_text() and 'email' not in p.read_text())
    rep=beta_report(rows)
    ck('funnel completion',rep['funnel']['capsule_completed']['sessions']==1)
    ck('capsule save rate',rep['capsules']['common']['save_rate']==1.0)
    ck('provider exact',rep['provider_health']['spotify']['exact_rate']==1.0)
    ck('provider fallback',rep['provider_health']['apple_music']['search_fallback_rate']==1.0)
    ck('experiment summary',rep['experiments']['control']['tracks_saved']==1)
    ck('privacy contract',rep['privacy']['local_only'] is True)
    print(f'\n{len(PASS)} passed, 0 failed')
    return 0
if __name__=='__main__': raise SystemExit(main())
