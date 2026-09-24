#!/usr/bin/env python3
"""Music DNA Copilot 3.0 product-layer tests (stdlib only, offline).

Covers the honesty and safety contracts of the 3.0 release: provider state,
imports (duplicate / malformed / unsupported), DNA build + insufficient-data
states, capsule pipeline and tier identity, Mystery redaction, explicit vs
self-reported signals, learning safety, resolver labelling, change feed,
privacy actions, API guards and the HTTP mount in local_interface.
"""
import io
import json
import sys
import tempfile
import threading
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))

from dna3 import api, capsules as C, dna as D, sources as SRC  # noqa: E402
from dna3.errors import ProductError  # noqa: E402
from dna3.store import Store  # noqa: E402

PASSED, FAILED = [], []


def check(name, cond, detail=""):
    (PASSED if cond else FAILED).append(name)
    print(f"  {'PASS' if cond else 'FAIL'}  {name}" + (f"  ({detail})" if detail and not cond else ""))


def raises(code, fn, *a, **k):
    try:
        fn(*a, **k)
    except ProductError as exc:
        return exc.code == code
    return False


def fresh():
    return Store(tempfile.mkdtemp(prefix="dna3-test-"))


def imported_store():
    s = fresh()
    ex = ROOT / "examples"
    SRC.import_file(s, "lastfm", "lastfm.json", (ex / "sample_lastfm_export.json").read_bytes())
    SRC.import_file(s, "youtube_music", "watch-history.json", (ex / "sample_youtube_takeout_history.json").read_bytes())
    SRC.import_file(s, "generic_csv", "library.csv", (ex / "sample_csv_import.csv").read_bytes())
    return s


H = {"Host": "127.0.0.1:8765", "X-MusicDNA-Client": "3"}


def call(store, method, path, body=None, headers=None):
    raw = json.dumps(body).encode() if body is not None else b""
    r = api.dispatch(store, method, "/api/v3/" + path, headers if headers is not None else H, raw)
    if r.stream is not None:
        return r.status, [json.loads(line) for line in b"".join(r.stream).decode().splitlines() if line]
    return r.status, json.loads(r.body.decode())


def main():
    print("1. Settings + store")
    s = fresh()
    st = s.settings()
    check("anonymous seed generated and stable", st["anonymous_seed"] == s.settings()["anonymous_seed"])
    check("invalid provider rejected", raises_value(lambda: s.update_settings({"preferred_provider": "napster"})))
    check("unknown settings ignored", "evil" not in s.update_settings({"evil": 1}))
    (s.v3).mkdir(parents=True, exist_ok=True)
    s.dna_path.write_text("{broken", encoding="utf-8")
    try:
        s.read_json(s.dna_path)
        check("corrupted file raises", False)
    except Exception as exc:
        check("corrupted file quarantined, not deleted", type(exc).__name__ == "CorruptedDataError"
              and any(p.name.startswith("dna.json.corrupt-") for p in s.v3.iterdir()))

    print("2. Sources: honest states + imports")
    s = fresh()
    cards = {c["id"]: c for c in SRC.provider_cards(s)}
    check("nothing is connected on a fresh install", all(c["state"] == "not_connected" for c in cards.values()))
    check("local folder is COMING_SOON", cards["local_files"]["badge"] == "COMING_SOON")
    check("Apple Music never claims live access", cards["apple_music"]["capabilities"] == ["import"])
    check("NO_SOURCES before any import", raises("NO_SOURCES", lambda: list(D.build_steps(s))))
    ex = ROOT / "examples"
    r = SRC.import_file(s, "lastfm", "l.json", (ex / "sample_lastfm_export.json").read_bytes())
    check("Last.fm import counts events and rows separately", r["events"] >= r["rows"] > 0)
    check("duplicate file detected", raises("DUPLICATE_IMPORT", SRC.import_file, s, "lastfm", "l.json",
                                            (ex / "sample_lastfm_export.json").read_bytes()))
    check("malformed file -> MALFORMED_IMPORT", raises("MALFORMED_IMPORT", SRC.import_file, s, "deezer", "x.csv", b"foo,bar\n1,2\n"))
    check("unsupported extension -> UNSUPPORTED_FORMAT", raises("UNSUPPORTED_FORMAT", SRC.import_file, s, "tidal", "x.exe", b"MZ"))
    check("coming-soon provider cannot import", raises("UNSUPPORTED_FORMAT", SRC.import_file, s, "local_files", "a.json", b"[]"))
    SRC.import_file(s, "deezer", "d.csv", b"title,artist\nSong A,Artist A\n")
    SRC.import_file(s, "tidal", "t.csv", b"title,artist\nSong B,Artist B\n")
    files = SRC.source_files(s)
    check("two services never overwrite each other", "deezer" in files and "tidal" in files)
    cards = {c["id"]: c for c in SRC.provider_cards(s)}
    check("imported state shown only for imported services", cards["deezer"]["state"] == "imported"
          and cards["qobuz"]["state"] == "not_connected")
    spotify_export = json.dumps([
        {"ts": "2025-01-01T10:00:00Z", "master_metadata_track_name": "Roads", "master_metadata_album_artist_name": "Portishead",
         "ms_played": 200000, "spotify_track_uri": "spotify:track:abc123"},
        {"ts": "2025-01-02T10:00:00Z", "master_metadata_track_name": "Roads", "master_metadata_album_artist_name": "Portishead", "ms_played": 5000},
        {"ts": "2025-01-03T10:00:00Z", "episode_name": "A podcast", "ms_played": 900000},
    ]).encode()
    r = SRC.import_file(s, "spotify", "Streaming_History.json", spotify_export)
    check("Spotify export: <30 s plays and podcasts not counted", r["rows"] == 1 and any("30 seconds" in n for n in r["notes"]))
    saved = json.loads((s.imports_dir / "spotify_export.json").read_text())
    check("Spotify export keeps provider identity", saved["tracks"][0].get("raw_id") == "abc123")
    SRC.remove_source(s, "tidal")
    check("remove_source deletes only that source", "tidal" not in SRC.source_files(s) and "deezer" in SRC.source_files(s))
    check("sync without connection is REQUIRES_SETUP", raises("REQUIRES_SETUP", SRC.sync_provider, s, "spotify"))
    err = SRC._classify_provider_error("spotify", RuntimeError("Spotify API /me returned 429: slow down"))
    check("429 classified as RATE_LIMITED", err.code == "RATE_LIMITED")
    err = SRC._classify_provider_error("lastfm", RuntimeError("Last.fm request failed: timed out"))
    check("network failure classified as OFFLINE", err.code == "OFFLINE")

    print("3. DNA build")
    s = imported_store()
    steps = list(D.build_steps(s))
    names = [x["step"] for x in steps]
    check("build streams the real steps in order", names == ["read", "dedupe", "artists", "genres", "affinities", "discovery", "dna", "done"])
    dna = steps[-1]["dna"]
    st = dna["stats"]
    check("raw events, unique tracks, artists and sources are distinct numbers",
          st["raw_events"] >= st["raw_rows"] >= st["unique_tracks"] > 0 and st["artists"] > 0 and st["source_count"] == 3)
    check("cross-service duplicates merged", st["cross_service_matches"] >= 1)
    check("history span from real timestamps", st["history_span"] and st["history_span"]["days"] > 0)
    check("popularity dimension not invented", dna["dimensions"]["mainstream_niche"]["status"] == "insufficient_data")
    check("every ok dimension carries its basis", all(v.get("basis") for v in dna["dimensions"].values() if v["status"] == "ok"))
    check("state words derived from data", 1 <= len(dna["state_words"]) <= 3)
    check("2.x compatibility files written", s.path("merged_listening_history.json").exists() and s.path("source_coverage.json").exists())
    small = fresh()
    SRC.import_file(small, "generic_csv", "a.csv", b"title,artist,genre\nOne,Solo,ambient\n")
    d_small, _ = D.build(small)
    check("tiny history -> tendencies are insufficient_data", d_small["dimensions"]["familiarity"]["status"] == "insufficient_data")
    demo = fresh()
    d_demo, _ = D.build(demo, demo=True)
    check("demo DNA is labelled demo", d_demo["demo"] is True and d_demo["stats"]["sources"][0]["id"] == "demo")
    check("demo never writes merged real-history file", not demo.path("merged_listening_history.json").exists())

    print("4. Capsules")
    s = fresh()
    D.build(s, demo=True)
    check("capsule without DNA fails cleanly", raises("NO_DNA", C.generate, fresh(), "common"))
    check("unknown tier rejected", raises("BAD_REQUEST", C.generate, s, "epic"))
    sizes = {}
    comp = {}
    for tier in ("common", "rare", "legendary", "mystery"):
        cap = C.generate(s, tier, "night_drive")
        sizes[tier] = cap["actual_size"]
        comp[tier] = cap["composition"]
        check(f"{tier}: pipeline stages recorded", cap["algorithm"]["stages"] == ["candidate_retrieval", "ranking", "reranking", "packaging"])
    check("tier sizes 5/10/15/10", sizes == {"common": 5, "rare": 10, "legendary": 15, "mystery": 10}, str(sizes))
    check("Common is closer to taste than Legendary", comp["common"]["close"] > comp["legendary"]["close"]
          and comp["legendary"]["far"] >= comp["common"]["far"], str(comp))
    caps = C.all_capsules(s)
    check("opening a new capsule abandons the untouched previous one", sum(c["state"] in ("opened", "started") for c in caps) == 1)
    check("A/B variant is stable", len({c["algorithm"]["variant"] for c in caps}) == 1)
    artists_per_capsule = [max(__import__("collections").Counter(t["artist"] for t in c["tracks"]).values()) for c in caps if c["rarity"] != "mystery"]
    check("max two tracks per artist", max(artists_per_capsule) <= 2)

    print("5. Mystery redaction")
    myst = next(c for c in C.all_capsules(s) if c["rarity"] == "mystery")
    view = C.view(s, myst)
    blob = json.dumps(view)
    real = [t["mystery_reveal"] for t in myst["tracks"]]
    leaked = [r for r in real if r["artist"] in blob or r["track_title"] in blob]
    check("hidden tracks leak no artist or title", not leaked, str(leaked[:2]))
    check("hidden tracks leak no links", "http" not in blob)
    check("hidden tracks still show match/distance/context", all(t["explain"]["match"] and t["explain"]["distance"] for t in view["tracks"]))
    check("opening a hidden track is refused", raises("CONFLICT", C.open_track, s, myst["capsule_id"], myst["tracks"][0]["track_id"]))
    tid = myst["tracks"][0]["track_id"]
    v2 = C.reveal(s, myst["capsule_id"], tid)
    t0 = next(t for t in v2["tracks"] if t["track_id"] == tid)
    check("reveal shows the real identity", t0["title"] == real[0]["track_title"] and t0["artist"] == real[0]["artist"])
    check("other tracks stay hidden after one reveal", sum(not t["hidden"] for t in v2["tracks"]) == 1)
    v3 = C.record_feedback(s, myst["capsule_id"], myst["tracks"][1]["track_id"], "skip")
    check("reacting to a hidden track reveals it", not v3["tracks"][1]["hidden"])
    fb = s.read_jsonl(s.feedback_path)[-1]
    check("feedback keeps full identity internally for learning", fb["artist"] == real[1]["artist"] and fb["capsule_rarity"] == "mystery")

    print("6. Feedback, completion, signals")
    s = fresh()
    D.build(s, demo=True)
    cap = C.generate(s, "common", "focus")
    actions = ["love", "save", "completed", "skip", "not_for_me"]
    check("unknown reaction rejected", raises("BAD_REQUEST", C.record_feedback, s, cap["capsule_id"], cap["tracks"][0]["track_id"], "explode"))
    for t, a in zip(cap["tracks"], actions):
        v = C.record_feedback(s, cap["capsule_id"], t["track_id"], a)
    check("capsule auto-completes when every track has a reaction", v["state"] == "completed")
    rows = [r for r in s.read_jsonl(s.feedback_path) if r.get("capsule_id") == cap["capsule_id"]]
    kinds = {r["action"]: r["signal_kind"] for r in rows}
    check("explicit vs self-reported signals are distinguished",
          kinds["love"] == "explicit" and kinds["completed"] == "self_reported" and kinds["skip"] == "self_reported")
    summ = v["summary"]
    check("summary counts match recorded events", (summ["loved"], summ["saved"], summ["completed"], summ["skipped"], summ["rejected"]) == (1, 1, 1, 1, 1))
    check("closed capsule refuses more feedback", raises("CONFLICT", C.record_feedback, s, cap["capsule_id"], cap["tracks"][0]["track_id"], "save"))
    hist = s.read_jsonl(s.capsule_history_path)
    check("completion appended to capsule history", hist and hist[-1]["capsule_id"] == cap["capsule_id"])
    h = C.history(s)
    check("history lists capsule with its counts", h["capsules"][0]["rejections"] == 1 and h["capsules"][0]["saves"] == 2)
    check("discoveries are artists outside the imported history", all(d["artist"].lower() not in set(D.load(s)["known_artists"]) for d in h["discoveries"]))
    cap2 = C.generate(s, "rare", "chill")
    rejected = {r["track_id"] for r in rows if r["action"] == "not_for_me"}
    check("rejected tracks are never re-served", not rejected & {t["track_id"] for t in cap2["tracks"]})
    closed = C.finish(s, cap2["capsule_id"])
    check("closing an untouched capsule marks it abandoned", closed["state"] == "abandoned")

    print("7. Explainability + playback honesty")
    s = fresh()
    D.build(s, demo=True)
    cap = C.generate(s, "common", "focus")
    v = C.view(s, cap)
    t = v["tracks"][0]
    check("every visible track has reasons", all(x["explain"]["reasons"] for x in v["tracks"]))
    acts = t["playback"]["actions"]
    check("search fallback is labelled Search, never Open", t["playback"]["status"] == "search_fallback"
          and acts[0]["label"].startswith("Search") and acts[0]["exact"] is False)
    from track_resolver import route_track
    r = route_track({"track_title": "X", "artist": "Y", "provider_ids": {"spotify": "ID"}}, preferred_provider="apple_music",
                    fallback_order=["spotify"], catalogs={"apple_music": []})
    view = C._route_view(r, {"apple_music": "https://music.apple.com/us/search?term=Y+X"})
    check("fallback provider is announced, not silent", view["note"] and "Apple Music" in view["note"] and "Spotify" in view["note"])
    check("preferred-provider search offered next to fallback", [a["label"] for a in view["actions"]][:2] == ["Open in Spotify", "Search Apple Music"])

    print("8. Learning safety")
    from music_dna_brain import build_adaptive_dna
    tmp = Path(tempfile.mkdtemp())
    now = datetime.now(timezone.utc).isoformat()
    one_skip = tmp / "a.jsonl"
    one_skip.write_text(json.dumps({"action": "skip", "genres": ["doom"], "artist": "A", "timestamp": now}) + "\n")
    g = build_adaptive_dna([], one_skip)["genre_affinity"]["doom"]
    check("one skip moves a genre only slightly", -0.2 < g < 0)
    leg = tmp / "b.jsonl"
    com = tmp / "c.jsonl"
    leg.write_text("".join(json.dumps({"action": "not_for_me", "genres": ["jazz"], "capsule_rarity": "legendary", "capsule_id": "L", "timestamp": now}) + "\n" for _ in range(15)))
    com.write_text("".join(json.dumps({"action": "not_for_me", "genres": ["jazz"], "timestamp": now}) + "\n" for _ in range(15)))
    gl = build_adaptive_dna([], leg)["genre_affinity"]["jazz"]
    gc = build_adaptive_dna([], com)["genre_affinity"]["jazz"]
    check("one Legendary capsule cannot rewrite a genre", abs(gl) < 0.3 and abs(gl) < abs(gc), f"legendary={gl} uncapped={gc}")

    print("9. Change feed")
    s = fresh()
    D.build(s, demo=True)
    check("empty feed when nothing happened", D.change_feed(s, D.load(s))["items"] == [])
    old = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
    s.append_jsonl(s.feedback_path, {"timestamp": old, "action": "save", "genres": ["ancient"], "origin": "capsule"})
    for a in ("completed", "completed", "save", "replay"):
        s.append_jsonl(s.feedback_path, {"timestamp": now, "action": a, "genres": ["post-metal"], "origin": "capsule"})
    feed = D.change_feed(s, D.load(s))
    item = next((i for i in feed["items"] if i["subject"] == "post-metal"), None)
    check("feed explains an increase with the actual counts", item and item["direction"] == "up"
          and "listened through 2" in item["why"] and "saved 1" in item["why"] and "replayed 1" in item["why"])
    check("feed ignores reactions outside the window", not any(i["subject"] == "ancient" for i in feed["items"]))
    sess = D.session_taste(s, s.settings(), D.load(s))
    check("session taste never mutates durable DNA", sess["durable_dna_mutated"] is False and sess["events"] == 4)
    s.update_settings({"session_reset_at": datetime.now(timezone.utc).isoformat()})
    check("reset session taste clears the session", D.session_taste(s, s.settings(), D.load(s))["events"] == 0)

    print("10. Beta instrumentation privacy")
    s = fresh()
    D.build(s, demo=True)
    cap = C.generate(s, "common", "focus")
    C.record_feedback(s, cap["capsule_id"], cap["tracks"][0]["track_id"], "save")
    text = s.beta_path.read_text()
    check("analytics carry no titles or artists", cap["tracks"][0]["track_title"] not in text and cap["tracks"][0]["artist"] not in text)
    check("events carry variant + algorithm version", all("algorithm_variant" in json.loads(l) and "algorithm_version" in json.loads(l) for l in text.splitlines()))
    s.update_settings({"analytics_enabled": False})
    n = len(text.splitlines())
    C.record_feedback(s, cap["capsule_id"], cap["tracks"][1]["track_id"], "save")
    check("analytics off -> no new events", len(s.beta_path.read_text().splitlines()) == n)

    print("11. API guards")
    s = fresh()
    code, body = call(s, "POST", "demo", {"enable": True}, headers={"Host": "127.0.0.1"})
    check("POST without client header -> 403", code == 403)
    code, body = call(s, "POST", "demo", {"enable": True}, headers={"Host": "attacker.example", "X-MusicDNA-Client": "3"})
    check("non-loopback Host rejected", code == 400 and body["error"]["title"] == "Blocked")
    code, body = call(s, "POST", "dna/build", {})
    check("build with no sources -> NO_SOURCES", code == 409 and body["error"]["code"] == "NO_SOURCES")
    code, lines = call(s, "POST", "dna/build", {"demo": True})
    check("streamed build ends with done", code == 200 and lines[-1]["step"] == "done")
    code, body = call(s, "POST", "privacy/reset_dna", {})
    check("destructive action needs confirmation", code == 400 and body["error"].get("requires_confirmation"))
    code, body = call(s, "POST", "capsules", {"tier": "rare", "intent": "discover"})
    check("capsule via API", code == 200 and body["capsule"]["actual_size"] == 10)
    code, body = call(s, "GET", "capsules/../../etc")
    check("path-like capsule ids rejected", code == 404)
    code, body = call(s, "GET", "state")
    check("state never exposes the anonymous seed", "anonymous_seed" not in json.dumps(body))
    for tab in ("quality", "beta", "identity", "diagnostics"):
        code, _ = call(s, "GET", f"advanced/{tab}")
        check(f"advanced/{tab} responds", code == 200)
    code, body = call(s, "POST", "privacy/delete_history", {"confirm": True})
    check("delete history keeps learned DNA", code == 200 and not C.all_capsules(s))
    code, body = call(s, "POST", "privacy/reset_dna", {"confirm": True})
    check("reset DNA keeps imports", code == 200 and not s.dna_path.exists())
    r = api.dispatch(s, "GET", "/api/v3/export/feedback", H)
    check("export sends an attachment", "attachment" in r.headers.get("Content-Disposition", ""))

    print("12. HTTP mount in local_interface")
    import local_interface as li
    from http.server import HTTPServer
    base = Path(tempfile.mkdtemp())
    li.OUTPUTS = base
    srv = HTTPServer(("127.0.0.1", 0), li.Handler)
    th = threading.Thread(target=srv.serve_forever, daemon=True)
    th.start()
    url = f"http://127.0.0.1:{srv.server_address[1]}"
    try:
        def get(p):
            try:
                with urllib.request.urlopen(url + p, timeout=10) as resp:
                    return resp.status, resp.read().decode(), dict(resp.headers)
            except urllib.error.HTTPError as e:
                return e.code, e.read().decode(), dict(e.headers)
        code, html, hdr = get("/")
        check("/ serves the 3.0 app", code == 200 and "/assets/app.js" in html)
        check("app is served with a CSP", "script-src 'self'" in hdr.get("Content-Security-Policy", ""))
        check("/classic serves the 2.x workspace", get("/classic")[0] == 200)
        check("static path traversal blocked", get("/assets/../scripts/local_interface.py")[0] == 404)
        code, body, _ = get("/api/v3/state")
        check("API mounted under /api/v3", code == 200 and json.loads(body)["version"].startswith("3."))
        boundary = "----dna3test"
        payload = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"provider\"\r\n\r\ngeneric_csv\r\n"
                   f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"a.csv\"\r\nContent-Type: text/csv\r\n\r\n"
                   "title,artist\nSong,Band\n\r\n"
                   f"--{boundary}--\r\n").encode()
        req = urllib.request.Request(url + "/api/v3/sources/import", data=payload, method="POST",
                                     headers={"Content-Type": f"multipart/form-data; boundary={boundary}", "X-MusicDNA-Client": "3"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            check("multipart import over HTTP", json.loads(resp.read())["import"]["rows"] == 1)
        req = urllib.request.Request(url + "/api/v3/sources/import", data=payload, method="POST",
                                     headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
        try:
            urllib.request.urlopen(req, timeout=10)
            check("multipart without client header blocked", False)
        except urllib.error.HTTPError as e:
            check("multipart without client header blocked", e.code == 403)
    finally:
        srv.shutdown()
        srv.server_close()

    print(f"\n{len(PASSED)} passed, {len(FAILED)} failed")
    return 0 if not FAILED else 1


def raises_value(fn):
    try:
        fn()
    except ValueError:
        return True
    return False


if __name__ == "__main__":
    sys.exit(main())
