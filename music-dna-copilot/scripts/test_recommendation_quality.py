#!/usr/bin/env python3
from recommendation_quality import *
def main():
    cat=[{'artist':'A','track_title':'1','genres':['metal']},{'artist':'B','track_title':'2','genres':['ambient']},{'artist':'C','track_title':'3','genres':['jazz']}]
    rec=[dict(cat[0],confidence_score=90,novelty_level=.2,mood_match=.9,task_match=.8),dict(cat[1],confidence_score=70,novelty_level=.8,mood_match=.7,task_match=.9)]
    q=evaluate(rec,cat)
    assert q['count']==2 and 0<=q['diversity']<=1 and q['catalog_coverage']==.6667 and q['artist_concentration']==.5
    s=blend_session_preferences({'evidence_count':99},[{'artist':'A','genres':['metal'],'action':'not_for_me'}])
    assert s['durable_dna_mutated'] is False and abs(s['artist']['a'])<=.12 and s['durable_evidence_count']==99
    rows=[{'rarity':'rare','context':{'task':'focus'},'metrics':{'completion_rate':.8,'save_rate':.2,'replay_rate':.1,'rejection_rate':.1,'hit_rate':.3}}]
    assert capsule_outcomes(rows)[0]['completion_rate']==.8
    print('Recommendation Quality Lab: 9/9 PASS'); return 0
if __name__=='__main__': raise SystemExit(main())
