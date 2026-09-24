import json, tempfile, sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from music_dna_brain import build_adaptive_dna, track_learning_adjustment, recency_weight, explain_changes

def main():
    now=datetime(2026,9,24,tzinfo=timezone.utc)
    with tempfile.TemporaryDirectory() as td:
        fb=Path(td)/"feedback.jsonl"
        rows=[
          {"timestamp":now.isoformat(),"action":"save","artist":"A","genres":["post-metal"],"task":"night_drive"},
          {"timestamp":now.isoformat(),"action":"replay","artist":"A","genres":["post-metal"]},
          {"timestamp":now.isoformat(),"action":"skip","artist":"B","genres":["pop"]},
          {"timestamp":now.isoformat(),"action":"too_similar"},]
        fb.write_text("\n".join(json.dumps(x) for x in rows),encoding="utf-8")
        dna=build_adaptive_dna([],fb,now)
        checks=[dna["artist_affinity"]["a"]>0,dna["genre_affinity"]["pop"]<0,dna["novelty_shift"]>0,
                track_learning_adjustment({"artist":"A","genres":["post-metal"]},dna,"night_drive")>0,
                recency_weight(now.isoformat(),now)>recency_weight((now-timedelta(days=300)).isoformat(),now),
                len(explain_changes(dna))>0,dna["confidence"]>0]
    print(f"{sum(checks)} passed, {len(checks)-sum(checks)} failed")
    return 0 if all(checks) else 1
if __name__=='__main__': sys.exit(main())
