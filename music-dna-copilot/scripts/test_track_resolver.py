import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from track_resolver import *
def main():
 t={"track_title":"Teardrop","artist":"Massive Attack","isrc":"GBBKS9800215","provider_ids":{"spotify":"abc"}}
 cat={"apple_music":[{"provider":"apple_music","track_title":"Teardrop","artist":"Massive Attack","isrc":"GBBKS9800215","provider_links":{"apple_music":"https://music.apple.com/x"}}]}
 a=route_track(t,preferred_provider="spotify",available_providers=["spotify","apple_music"],catalogs=cat)
 b=route_track({"track_title":"Roads","artist":"Portishead"},preferred_provider="apple_music",available_providers=["apple_music"],catalogs={})
 c=resolve_in_catalog({"track_title":"Angel","artist":"Massive Attack"},"spotify",[{"provider":"spotify","track_title":"Angel","artist":"Massive Attack","provider_id":"id1"}])
 m=resolver_metrics([a,b,c])
 checks=[a["method"]=="provider_id",a["provider"]=="spotify",b["status"]=="search_fallback",c["method"]=="exact_metadata",m["tracks"]==3,m["exact_rate"]==round(2/3,3),"open.spotify.com" in c["url"]]
 print(f"{sum(checks)} passed, {len(checks)-sum(checks)} failed"); return 0 if all(checks) else 1
if __name__=='__main__': raise SystemExit(main())
