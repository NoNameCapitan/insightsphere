import sys, tempfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from music_capsules import build_capsule, transition, record_track_event, capsule_metrics, append_history

def main():
    items={"recommendations":[{"track_title":f"T{i}","artist":f"A{i//2}","genres":["rock"]} for i in range(30)]}
    c=build_capsule(items,"common",preferred_provider="apple_music")
    checks=[]
    checks += [len(c["tracks"])==5,c["state"]=="opened",c["preferred_provider"]=="apple_music",all("provider_links" in x for x in c["tracks"])]
    checks += [len(build_capsule(items,"rare")["tracks"])==10,len(build_capsule(items,"legendary")["tracks"])==15]
    m=build_capsule(items,"mystery"); checks += [len(m["tracks"])==10,m["tracks"][0]["track_title"]=="Hidden track","mystery_reveal" in m["tracks"][0]]
    d=build_capsule(items,"common",recent_track_ids=[c["tracks"][0]["track_id"]],recent_artists=["A0"]); checks += [d["tracks"][0]["artist"]!="A0"]
    s=transition(c,"started","2026-01-01T00:00:00+00:00"); tid=s["tracks"][0]["track_id"]; s=record_track_event(s,tid,"completed"); s=record_track_event(s,tid,"save"); s=transition(s,"completed")
    met=capsule_metrics(s); checks += [s["state"]=="completed",met["completion_rate"]==0.2,met["save_rate"]==0.2,met["hit_rate"]==0.2]
    try: transition(c,"completed"); checks.append(False)
    except ValueError: checks.append(True)
    try: record_track_event(c,"nope","save"); checks.append(False)
    except ValueError: checks.append(True)
    with tempfile.TemporaryDirectory() as td:
        p=Path(td)/"history.jsonl"; append_history(p,s); checks += [p.exists(),"completion_rate" in p.read_text()]
    print(f"{sum(checks)} passed, {len(checks)-sum(checks)} failed"); return 0 if all(checks) else 1
if __name__=='__main__': sys.exit(main())
