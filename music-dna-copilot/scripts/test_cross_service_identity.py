import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from merge_listening_sources import merge_histories

def main():
    a={"source":"spotify","tracks":[{"track_name":"Song","artist_name":"Artist","isrc":"USABC1234567","raw_id":"sp1","source":"spotify","confidence":1.0}]}
    b={"source":"apple_music","tracks":[{"track_name":"Song (Remastered 2020)","artist_name":"Artist","isrc":"USABC1234567","raw_id":"am1","source":"apple_music","confidence":.9}]}
    r=merge_histories([a,b])
    checks=[len(r)==1,{x['source'] for x in r[0]['sources']}=={'spotify','apple_music'},{x.get('raw_id') for x in r[0]['sources']}=={'sp1','am1'}]
    print(f"{sum(checks)} passed, {len(checks)-sum(checks)} failed")
    return 0 if all(checks) else 1
if __name__=='__main__': sys.exit(main())
