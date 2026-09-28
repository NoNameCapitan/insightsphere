import tempfile,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from provider_adapter import *
def main():
 p=Path(tempfile.mkdtemp())/'s.json'; checks=[]
 checks += [PROVIDERS['spotify'].live_ready, PROVIDERS['apple_music'].import_ready, not PROVIDERS['apple_music'].live_ready]
 update_sync_state('spotify',cursor='2026-01-01T00:00:00Z',tracks_added=2,path=p)
 checks += [get_sync_state('spotify',p)['cursor']=='2026-01-01T00:00:00Z']
 rows=[{'played_at':'2025-01-01T00:00:00Z'},{'played_at':'2026-02-01T00:00:00Z'},{'x':1}]
 checks += [len(incremental_tracks('spotify',rows,p))==2,newest_cursor(rows)=='2026-02-01T00:00:00Z']
 print(f'{sum(checks)} passed, {len(checks)-sum(checks)} failed'); return 0 if all(checks) else 1
if __name__=='__main__': sys.exit(main())
