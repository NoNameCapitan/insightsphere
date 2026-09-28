#!/usr/bin/env python3
"""
test_multi_source.py
====================
Offline tests for the multi-source system: YouTube Takeout importer,
Last.fm importer, source merging, coverage/confidence, and the portable
Music DNA export. No network, no credentials. Run:

    python scripts/test_multi_source.py
"""

import json
import sys
import tempfile
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
ROOT = SCRIPTS.parents[0]
sys.path.insert(0, str(SCRIPTS))

import export_portable_dna  # noqa: E402
import import_lastfm  # noqa: E402
import import_youtube_takeout as yt  # noqa: E402
import merge_listening_sources as merger  # noqa: E402
from source_common import compute_coverage, normalize_key  # noqa: E402

PASS = 0
FAIL = 0


def check(name, condition, detail=""):
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  PASS  {name}")
    else:
        FAIL += 1
        print(f"  FAIL  {name}  {detail}")


def main():
    tmp = Path(tempfile.mkdtemp(prefix="mtr_multi_"))

    # --- dedup key ----------------------------------------------------------------
    print("normalize_key")
    check("case/punctuation folded",
          normalize_key("Nightcall!", "KAVINSKY") == normalize_key("nightcall", "Kavinsky"))
    check("(Official Video) stripped",
          normalize_key("Blinding Lights (Official Video)", "The Weeknd") == normalize_key("Blinding Lights", "The Weeknd"))
    check("feat. stripped",
          normalize_key("Track feat. Someone", "A") == normalize_key("Track", "A"))
    check("remaster suffix stripped",
          normalize_key("Song - Remastered 2011", "B") == normalize_key("Song", "B"))

    # --- YouTube Takeout ------------------------------------------------------------
    print("YouTube Takeout importer")
    history = yt.import_takeout(ROOT / "examples" / "sample_youtube_takeout_history.json")
    tracks = history["tracks"]
    by_name = {t["track_name"]: t for t in tracks}
    check("music entries imported", len(tracks) == 4, f"got {len(tracks)}")
    check("source stamped", all(t["source"] == "youtube_takeout" for t in tracks))
    check("YT Music entries high confidence", by_name["Nightcall"]["confidence"] == 0.9)
    check("Topic channel = artist", by_name["Nightcall"]["artist_name"] == "Kavinsky")
    check("repeat watch -> play_count", by_name["Nightcall"]["play_count"] == 2)
    check("Artist - Track title split",
          by_name.get("Blinding Lights", {}).get("artist_name") == "The Weeknd")
    check("title noise cleaned", "(Official Video)" not in json.dumps(by_name.get("Blinding Lights", {})))
    check("non-music skipped (DIY video)", "How to fix a leaking tap" not in json.dumps(tracks))
    check("non-music skipped (lofi radio, no clear signal)", "lofi hip hop radio" not in json.dumps(tracks))
    check("uncertain entries lower confidence",
          any(t["confidence"] <= 0.6 for t in tracks))
    check("honest import summary present",
          history["import_summary"]["skipped_non_music"] >= 1 and "heuristic" in history["import_summary"]["note"])
    check("video id captured as raw_id", by_name["Nightcall"].get("raw_id") == "MV_3Dpw-BRY")

    # HTML variant
    html = """<html><body>
    <div class="content-cell mdl-typography--body-1"><a href="https://www.youtube.com/watch?v=abc123">Watched Daft Punk - Get Lucky (Official Audio)</a><br><a href="#">Daft Punk</a><br>May 2, 2026, 9:14:33 PM</div>
    <div class="content-cell mdl-typography--body-1"><a href="https://www.youtube.com/watch?v=zzz">Watched Best cat compilation 2026</a><br><a href="#">Cats Channel</a><br>May 1, 2026, 1:00:00 PM</div>
    </body></html>"""
    html_file = tmp / "watch-history.html"
    html_file.write_text(html, encoding="utf-8")
    h2 = yt.import_takeout(html_file)
    check("HTML watch history parsed", len(h2["tracks"]) == 1 and h2["tracks"][0]["artist_name"] == "Daft Punk",
          json.dumps(h2["tracks"])[:200])

    # music CSV variant
    csv_file = tmp / "music-library-songs.csv"
    csv_file.write_text("Song Title,Album Title,Artist Names\nAfter Dark,Time,Mr.Kitty\nResonance,Floral Shoppe,HOME\n", encoding="utf-8")
    h3 = yt.import_takeout(csv_file)
    check("music library CSV parsed", len(h3["tracks"]) == 2 and h3["tracks"][0]["confidence"] == 0.85)

    # --- Last.fm ----------------------------------------------------------------
    print("Last.fm importer")
    lf = import_lastfm.parse_export_file(ROOT / "examples" / "sample_lastfm_export.json")
    check("JSON export parsed", len(lf["tracks"]) == 5)
    check("uts -> ISO timestamp", any("2026" in (t.get("played_at") or "") for t in lf["tracks"]))
    check("playcount kept", any(t.get("play_count", 0) >= 9 for t in lf["tracks"]))
    csv_lf = tmp / "scrobbles.csv"
    csv_lf.write_text("uts,utc_time,artist,album,track\n1746200000,\"02 May 2026\",The xx,xx,Intro\n", encoding="utf-8")
    lf2 = import_lastfm.parse_export_file(csv_lf)
    check("CSV export parsed", len(lf2["tracks"]) == 1 and lf2["tracks"][0]["artist_name"] == "The xx")
    try:
        import_lastfm.import_lastfm(username=None, file=None)
        check("missing args rejected", False)
    except import_lastfm.LastfmError:
        check("missing args rejected", True)

    # --- merging -------------------------------------------------------------------
    print("source merging")
    yt_file = tmp / "yt.json"
    yt_file.write_text(json.dumps(history), encoding="utf-8")
    lf_file = tmp / "lf.json"
    lf_file.write_text(json.dumps(lf), encoding="utf-8")
    merged, coverage, merged_path = merger.merge_sources(
        [yt_file, lf_file], output=tmp / "merged.json", coverage_path=tmp / "coverage.json")
    mtracks = {t["track_name"]: t for t in merged["tracks"]}
    nightcall = mtracks["Nightcall"]
    check("cross-source dedup (Nightcall yt+lastfm)",
          {s["source"] for s in nightcall["sources"]} == {"youtube_takeout", "lastfm"})
    check("play counts combined", nightcall["play_count"] == 3, nightcall["play_count"])
    check("earliest timestamp kept", nightcall.get("played_at", "").startswith("2026-05-01"),
          nightcall.get("played_at"))
    check("midnight city merged too",
          len(mtracks["Midnight City"]["sources"]) == 2)
    check("merged history source field", merged["source"] == "merged")
    check("merge outputs written", (tmp / "merged.json").exists() and (tmp / "coverage.json").exists())

    # --- coverage -------------------------------------------------------------------
    print("coverage & confidence")
    check("contributions sum ~100",
          abs(sum(coverage["contribution_percent"].values()) - 100) < 1.5,
          coverage["contribution_percent"])
    check("two sources reported", set(coverage["sources_used"]) == {"youtube_takeout", "lastfm"})
    check("totals computed", coverage["total_tracks"] == len(merged["tracks"]) and coverage["unique_artists"] > 5)
    check("confidence level present", coverage["confidence_level"] in {"High", "Medium", "Low"})

    tiny = {"source": "manual", "tracks": [{"track_name": "A", "artist_name": "B"}]}
    tiny_cov = compute_coverage(tiny)
    check("tiny manual profile -> Low confidence", tiny_cov["confidence_level"] == "Low",
          tiny_cov["confidence_level"])
    check("reasons are honest", "single source" in tiny_cov["confidence_reasons"]
          and "few listening events" in tiny_cov["confidence_reasons"])

    uncertain = {"source": "youtube_takeout", "tracks": [
        {"track_name": f"T{i}", "artist_name": f"A{i}", "confidence": 0.55} for i in range(40)]}
    check("uncertain parsing lowers avg confidence",
          compute_coverage(uncertain)["average_parse_confidence"] == 0.55)

    # --- DNA + recommendations from merged data -----------------------------------
    print("pipeline from merged data")
    import subprocess
    taste, recs = tmp / "taste.json", tmp / "recs.json"
    r1 = subprocess.run([sys.executable, str(SCRIPTS / "analyze_taste.py"), str(tmp / "merged.json"), str(taste)],
                        cwd=ROOT, capture_output=True, text=True)
    check("analyze_taste on merged history", r1.returncode == 0, r1.stderr[-200:])
    r2 = subprocess.run([sys.executable, str(SCRIPTS / "generate_recommendations.py"), str(taste),
                         "--mood", "0", "--task", "work_focus", "--novelty", "3",
                         "--catalog", str(ROOT / "examples" / "sample_candidate_catalog.json"),
                         "--output", str(recs), "--no-feedback"],
                        cwd=ROOT, capture_output=True, text=True)
    check("recommendations from merged profile", r2.returncode == 0, r2.stderr[-200:])

    # --- portable export ------------------------------------------------------------
    print("portable Music DNA")
    fb = tmp / "feedback.jsonl"
    fb.write_text(json.dumps({"action": "not_for_me", "artist": "Nickelback", "genres": ["post-grunge"]}) + "\n"
                  + json.dumps({"action": "not_for_me", "artist": "Creed", "genres": ["post-grunge"]}) + "\n",
                  encoding="utf-8")
    portable, paths = export_portable_dna.export_portable(taste, tmp / "coverage.json", recs, fb, out_dir=tmp)
    check("three files written", all(p.exists() for p in paths.values()))
    check("sources + coverage embedded",
          portable["sources"]["sources_used"] and portable["sources"]["confidence_level"] in {"High", "Medium", "Low"})
    check("avoid-list from feedback",
          "Nickelback" in portable["avoid_list"]["artists"] and "post-grunge" in portable["avoid_list"]["genres"])
    check("markdown export readable", "Profile confidence" in paths["md"].read_text(encoding="utf-8"))
    check("prompt embeds the profile", "MY MUSIC DNA" in paths["prompt"].read_text(encoding="utf-8"))


    print(f"\n{PASS} passed, {FAIL} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
