import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from identity_graph import match_tracks
def main():
 checks=[]
 checks.append(match_tracks({'isrc':'USX1','track_name':'A','artist_name':'B'},{'isrc':'USX1','track_name':'X','artist_name':'Y'})['method']=='isrc')
 checks.append(match_tracks({'musicbrainz_id':'mb1','track_name':'A','artist_name':'B'},{'musicbrainz_id':'mb1','track_name':'X','artist_name':'Y'})['method']=='musicbrainz')
 checks.append(match_tracks({'source':'spotify','raw_id':'1','track_name':'A','artist_name':'B'},{'provider_ids':{'spotify':'1'},'track_name':'X','artist_name':'Y'})['method']=='provider_id')
 r=match_tracks({'track_name':'Enjoy the Silence','artist_name':'Depeche Mode'},{'track_name':'Enjoy The Silence - Remastered','artist_name':'Depeche Mode'})
 checks.append(r['match'])
 checks.append(not match_tracks({'track_name':'One','artist_name':'Metallica'},{'track_name':'One','artist_name':'U2'})['match'])
 print(f'{sum(checks)} passed, {len(checks)-sum(checks)} failed'); return 0 if all(checks) else 1
if __name__=='__main__': sys.exit(main())
