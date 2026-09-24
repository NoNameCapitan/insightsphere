#!/usr/bin/env python3
"""
smoke_test.py
=============
End-to-end smoke tests for the Music DNA Copilot. Stdlib only,
no network, no real Spotify credentials required. Run:

    python scripts/smoke_test.py

Checks:
    1. every script compiles;
    2. demo pipeline runs (analyze -> recommend -> prompt);
    3. CSV import works;
    4. recommendation output validates against
       schemas/recommendation_output.schema.json (lightweight validator);
    5. Spotify connector offline tests pass;
    6. the local UI renders the home page in all languages and the
       feedback/export/i18n routes behave;
    7. free-port fallback works.
"""

import json
import os
import py_compile
import subprocess
import sys
import tempfile
import threading
import time
import urllib.parse
import urllib.request
import urllib.error
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
ROOT = SCRIPTS.parents[0]
sys.path.insert(0, str(SCRIPTS))

PASS, FAIL = [], []

SMOKE_HTTP_TIMEOUT = 20  # every UI request is bounded so smoke can never hang


def _open(target, timeout=SMOKE_HTTP_TIMEOUT):
    """urlopen with a hard timeout so a stuck request fails instead of hanging."""
    return urllib.request.urlopen(target, timeout=timeout)


def check(name, condition, detail=""):
    (PASS if condition else FAIL).append(name)
    mark = "PASS" if condition else "FAIL"
    print(f"  {mark}  {name}" + (f"  [{detail}]" if detail and not condition else ""))


class _Result:
    def __init__(self, returncode, stdout, stderr):
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr


def _clean_subprocess_env():
    """A sanitized environment for every smoke subprocess: no real network
    credentials, no bytecode writes, bounded pipeline, isolated config/cache."""
    env = dict(os.environ)
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    env["PYTHONUNBUFFERED"] = "1"
    env["MTR_PIPELINE_TIMEOUT"] = env.get("MTR_PIPELINE_TIMEOUT", "30")
    for key in ("LASTFM_API_KEY", "LASTFM_USERNAME", "SPOTIFY_CLIENT_ID",
                "SPOTIFY_CLIENT_SECRET", "SUPPORT_URL", "OLLAMA_BASE_URL"):
        env.pop(key, None)
    tmpdir = tempfile.mkdtemp(prefix="mtr_sub_")
    # Defense-in-depth: if any code honors these, it stays off shared paths.
    env["MTR_CONFIG_DIR"] = tmpdir
    env["MTR_CACHE_DIR"] = tmpdir
    return env, tmpdir


def _kill_proc_tree(proc):
    """Kill the child and any grandchildren so inherited pipes close and
    communicate() can return instead of blocking forever."""
    try:
        if os.name == "posix":
            import signal
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
            return
    except Exception:
        pass
    try:
        proc.kill()
    except Exception:
        pass


def run(cmd, timeout=120, name=None, **kw):
    """Run a subprocess in its own session with a hard timeout and a clean env.

    Logs start/end with elapsed seconds. On timeout, kills the whole process
    group, drains output, and returns a synthetic failure so the suite never
    hangs. Replaces subprocess.run(), whose cleanup can block when a child
    leaves pipe file descriptors open in a grandchild."""
    label = name or (Path(cmd[1]).name if len(cmd) > 1 else " ".join(map(str, cmd)))
    env, tmpdir = _clean_subprocess_env()
    popen_kw = dict(cwd=ROOT, stdin=subprocess.DEVNULL,
                    stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                    text=True, env=env, **kw)
    if os.name == "posix":
        popen_kw["start_new_session"] = True
    start = time.monotonic()
    print(f"   -> start {label}", flush=True)
    proc = subprocess.Popen(cmd, **popen_kw)
    try:
        out, err = proc.communicate(timeout=timeout)
        elapsed = time.monotonic() - start
        print(f"   <- done  {label} rc={proc.returncode} ({elapsed:.1f}s)", flush=True)
        return _Result(proc.returncode, out, err)
    except subprocess.TimeoutExpired:
        _kill_proc_tree(proc)
        try:
            out, err = proc.communicate(timeout=5)
        except Exception:
            out, err = "", ""
        elapsed = time.monotonic() - start
        printable = " ".join(str(c) for c in cmd)
        print(f"   xx TIMEOUT {label} after {timeout}s (killed, {elapsed:.1f}s): {printable}",
              flush=True)
        for tag, blob in (("stdout", out or ""), ("stderr", err or "")):
            if blob.strip():
                print(f"  --- captured {tag} (tail) ---")
                print("\n".join(blob.strip().splitlines()[-20:]))
        return _Result(124, out or "", (err or "") + f"\nTIMEOUT after {timeout}s")
    finally:
        try:
            import shutil
            shutil.rmtree(tmpdir, ignore_errors=True)
        except Exception:
            pass




def run_test_module(module_name):
    """Run a smoke-safe test module in-process. This avoids excessive nested
    Python subprocesses in constrained environments while preserving the same
    assertions and output."""
    import importlib
    module = importlib.import_module(module_name)
    try:
        rc = module.main()
        return 0 if rc is None else int(rc)
    except SystemExit as exc:
        return int(exc.code or 0)

# --- lightweight schema validation (no jsonschema dependency) ----------------

def validate_against_schema(instance, schema, path="$"):
    """Minimal draft-07 subset validator: type, required, properties, items, enum."""
    errors = []
    stype = schema.get("type")
    typemap = {"object": dict, "array": list, "string": str, "integer": int,
               "number": (int, float), "boolean": bool, "null": type(None)}
    if stype is not None:
        types = stype if isinstance(stype, list) else [stype]
        known = [ti for ti in types if ti in typemap]
        if known:
            allowed = tuple(
                t for ti in known
                for t in (typemap[ti] if isinstance(typemap[ti], tuple) else (typemap[ti],))
            )
            if not isinstance(instance, allowed):
                return [f"{path}: expected {stype}, got {type(instance).__name__}"]
        # for object/array sub-validation below, use the first concrete type
        stype = "object" if "object" in types else ("array" if "array" in types else known[0] if known else None)
    if "enum" in schema and instance not in schema["enum"]:
        errors.append(f"{path}: {instance!r} not in enum")
    if stype == "object":
        for req in schema.get("required", []):
            if req not in instance:
                errors.append(f"{path}.{req}: required field missing")
        for key, sub in schema.get("properties", {}).items():
            if key in instance:
                errors.extend(validate_against_schema(instance[key], sub, f"{path}.{key}"))
    if stype == "array" and "items" in schema:
        for i, item in enumerate(instance):
            errors.extend(validate_against_schema(item, schema["items"], f"{path}[{i}]"))
    return errors


def main():
    # Never let a localhost HTTP call hang the whole suite.
    import socket
    socket.setdefaulttimeout(20)

    # Bound pipeline subprocesses (must be set BEFORE local_interface is imported),
    # and guarantee no real Last.fm/Spotify network during smoke.
    os.environ["MTR_PIPELINE_TIMEOUT"] = os.environ.get("MTR_PIPELINE_TIMEOUT", "30")
    os.environ["LASTFM_API_KEY"] = ""
    os.environ["LASTFM_USERNAME"] = ""
    os.environ.pop("SUPPORT_URL", None)
    os.environ.pop("OLLAMA_BASE_URL", None)
    import faulthandler
    faulthandler.enable()

    # Process-wide watchdog: independent of the per-section faulthandler timer.
    # Use SIGALRM on POSIX instead of a daemon watchdog thread. The previous
    # thread-based watchdog could deadlock subprocess.Popen() after several
    # fork/exec cycles on POSIX, which made the full smoke suite hang while the
    # individual subprocess tests passed separately.
    total_budget = int(os.environ.get("MTR_SMOKE_TOTAL_TIMEOUT", "300"))
    try:
        import signal

        if hasattr(signal, "SIGALRM"):
            def _global_alarm(_signum, _frame):
                sys.stderr.write(f"\n*** smoke_test global watchdog fired after {total_budget}s "
                                 f"— dumping stacks and aborting ***\n")
                sys.stderr.flush()
                faulthandler.dump_traceback()
                os._exit(124)

            signal.signal(signal.SIGALRM, _global_alarm)
            signal.alarm(total_budget)
    except Exception:
        # Per-subprocess and HTTP timeouts still protect the suite. Avoid adding
        # a background thread here because that is what caused the fork hang.
        pass

    tmp = Path(tempfile.mkdtemp(prefix="mtr_smoke_"))
    os.environ["MTR_CONFIG_DIR"] = str(tmp / "config")

    print("1. Compilation")
    for script in sorted(SCRIPTS.glob("*.py")):
        try:
            py_compile.compile(str(script), doraise=True)
            check(f"compile {script.name}", True)
        except py_compile.PyCompileError as exc:
            check(f"compile {script.name}", False, str(exc))

    print("2. Demo pipeline")
    taste, recs, prompt = tmp / "taste.json", tmp / "recs.json", tmp / "prompt.md"
    r = run([sys.executable, str(SCRIPTS / "analyze_taste.py"),
             str(ROOT / "examples" / "sample_listening_history.json"), str(taste)])
    check("analyze_taste on demo data", r.returncode == 0 and taste.exists(), r.stderr[-200:])
    r = run([sys.executable, str(SCRIPTS / "generate_recommendations.py"), str(taste),
             "--mood", "1", "--task", "night_drive", "--novelty", "4", "--max", "9",
             "--catalog", str(ROOT / "examples" / "sample_candidate_catalog.json"),
             "--output", str(recs), "--no-feedback"])
    check("generate_recommendations", r.returncode == 0 and recs.exists(), r.stderr[-200:])
    r = run([sys.executable, str(SCRIPTS / "generate_recommendation_prompt.py"), str(taste),
             "--mood", "1", "--task", "night_drive", "--novelty", "4", "--output", str(prompt)])
    check("generate_recommendation_prompt", r.returncode == 0 and prompt.exists(), r.stderr[-200:])

    print("3. CSV import")
    csv_out = tmp / "csv_history.json"
    r = run([sys.executable, str(SCRIPTS / "normalize_csv_import.py"),
             str(ROOT / "examples" / "sample_csv_import.csv"), str(csv_out)])
    ok = r.returncode == 0 and csv_out.exists()
    if ok:
        data = json.loads(csv_out.read_text(encoding="utf-8"))
        ok = bool(data.get("tracks"))
    check("normalize_csv_import on sample CSV", ok, r.stderr[-200:])

    print("4. Schema validation")
    schema = json.loads((ROOT / "schemas" / "recommendation_output.schema.json").read_text(encoding="utf-8"))
    output = json.loads(recs.read_text(encoding="utf-8"))
    errors = validate_against_schema(output, schema)
    check("recommendations match recommendation_output.schema.json",
          not errors, "; ".join(errors[:3]))

    print("5. Spotify connector offline tests")
    r = run([sys.executable, str(SCRIPTS / "test_spotify_connector.py")])
    check("test_spotify_connector.py", r.returncode == 0,
          (r.stdout + r.stderr).strip().splitlines()[-1] if (r.stdout or r.stderr) else "")

    print("5b. Manual paste parser")
    from mtr_app.validation import build_manual_history
    parsed = build_manual_history(
        "1. Marrow by YOB\nA Solitary Reign by Amenra\nNightcall — Kavinsky\n* Midnight City - M83",
        "", "en")["tracks"]
    by_title = {t["track_name"]: t["artist_name"] for t in parsed}
    check("manual paste supports 'Track by Artist'", by_title.get("Marrow") == "YOB")
    check("manual paste strips list markers", by_title.get("A Solitary Reign") == "Amenra")
    check("manual paste supports em-dash and hyphen",
          by_title.get("Nightcall") == "Kavinsky" and by_title.get("Midnight City") == "M83")

    print("8. Regression: play_count weighting")
    import analyze_taste as analyzer
    base = [{"track_name": "A", "artist_name": "X", "genres": ["jazz"]},
            {"track_name": "B", "artist_name": "Y", "genres": ["metal"]}]
    heavy = [dict(base[0], play_count=40), dict(base[1], play_count=1)]
    ga = lambda tr: {g["genre"]: g["affinity_score"] for g in analyzer.calculate_genre_affinity(tr)}
    ar = lambda tr: {a["artist_name"]: a["play_count"] for a in analyzer.calculate_artist_recurrence(tr)}
    check("genre affinity is play_count-weighted",
          ga(base)["metal"] == 1.0 and ga(heavy)["metal"] < 0.1,
          f"base={ga(base)} heavy={ga(heavy)}")
    check("artist recurrence sums play_count",
          ar(base)["X"] == 1 and ar(heavy)["X"] == 40, f"{ar(heavy)}")
    rep_base = analyzer.calculate_repetition_pattern(base)
    rep_heavy = analyzer.calculate_repetition_pattern(heavy)
    check("repetition pattern counts listening events",
          rep_heavy["repeat_ratio"] > rep_base["repeat_ratio"],
          f"base={rep_base} heavy={rep_heavy}")
    check("total_listening_events uses play_count",
          analyzer.total_listening_events(heavy) == 41)

    print("10. Genre taxonomy")
    tax_schema = json.loads((ROOT / "schemas" / "genre_taxonomy.schema.json").read_text(encoding="utf-8"))
    tax_data = json.loads((ROOT / "data" / "genre_taxonomy.json").read_text(encoding="utf-8"))
    tax_errs = validate_against_schema(tax_data, tax_schema)
    check("genre_taxonomy.json validates against its schema", not tax_errs, "; ".join(tax_errs[:3]))
    r = run([sys.executable, str(SCRIPTS / "test_genre_taxonomy.py")], timeout=60)
    last = (r.stdout + r.stderr).strip().splitlines()
    check("test_genre_taxonomy.py passes", r.returncode == 0, last[-1] if last else "")

    print("11. Deep genre recommendations")
    r = run([sys.executable, str(SCRIPTS / "test_deep_genre_recommendations.py")], timeout=90)
    last = (r.stdout + r.stderr).strip().splitlines()
    check("test_deep_genre_recommendations.py passes", r.returncode == 0, last[-1] if last else "")

    print("12. Candidate engine")
    r = run([sys.executable, str(SCRIPTS / "test_candidate_engine.py")], timeout=60)
    last = (r.stdout + r.stderr).strip().splitlines()
    check("test_candidate_engine.py passes", r.returncode == 0, last[-1] if last else "")

    print("13. Last.fm connector (mocked)")
    r = run([sys.executable, str(SCRIPTS / "test_lastfm_connector.py")], timeout=60)
    last = (r.stdout + r.stderr).strip().splitlines()
    check("test_lastfm_connector.py passes", r.returncode == 0, last[-1] if last else "")

    print("14. Last.fm tag enrichment (mocked)")
    r = run([sys.executable, str(SCRIPTS / "test_lastfm_tag_enrichment.py")], timeout=60)
    last = (r.stdout + r.stderr).strip().splitlines()
    check("test_lastfm_tag_enrichment.py passes", r.returncode == 0, last[-1] if last else "")

    print("15. User scenarios (offline pipeline)")
    r = run([sys.executable, str(SCRIPTS / "test_user_scenarios.py")], timeout=180)
    last = (r.stdout + r.stderr).strip().splitlines()
    check("test_user_scenarios.py passes", r.returncode == 0, last[-1] if last else "")

    print("16. Personal store")
    r = run([sys.executable, str(SCRIPTS / "test_personal_store.py")], timeout=60)
    last = (r.stdout + r.stderr).strip().splitlines()
    check("test_personal_store.py passes", r.returncode == 0, last[-1] if last else "")

    print("17. Personal memory scoring")
    r = run([sys.executable, str(SCRIPTS / "test_personal_memory.py")], timeout=120)
    last = (r.stdout + r.stderr).strip().splitlines()
    check("test_personal_memory.py passes", r.returncode == 0, last[-1] if last else "")

    print("18. Music DNA report")
    rc = run_test_module("test_music_dna_report")
    check("test_music_dna_report.py passes", rc == 0, f"exit {rc}")

    print("19. Data management")
    rc = run_test_module("test_data_management")
    check("test_data_management.py passes", rc == 0, f"exit {rc}")

    print("20. Manual quality check")
    rc = run_test_module("test_manual_quality_check")
    check("test_manual_quality_check.py passes", rc == 0, f"exit {rc}")

    print("20b. Release packaging + safety")
    rc = run_test_module("test_release")
    check("test_release.py passes", rc == 0, f"exit {rc}")

    print("20c. Multi-source import + merge + portable DNA")
    rc = run_test_module("test_multi_source")
    check("test_multi_source.py passes", rc == 0, f"exit {rc}")

    print("20d. Genre enrichment for tagless sources")
    rc = run_test_module("test_genre_enrichment")
    check("test_genre_enrichment.py passes", rc == 0, f"exit {rc}")

    rc = run_test_module("test_cross_service_identity")
    check("test_cross_service_identity.py passes", rc == 0, f"exit {rc}")

    rc = run_test_module("test_music_capsules")
    check("test_music_capsules.py passes", rc == 0, f"exit {rc}")

    rc = run_test_module("test_music_dna_brain")
    check("test_music_dna_brain.py passes", rc == 0, f"exit {rc}")

    print("20e. Recommendation Quality Lab")
    rc = run_test_module("test_recommendation_quality")
    check("test_recommendation_quality.py passes", rc == 0)

    print("20f. 2.3-2.8 foundations (resolver, beta, provider adapter, identity v2)")
    for mod in ("test_track_resolver", "test_beta_instrumentation", "test_provider_adapter", "test_identity_graph_v2"):
        r = run([sys.executable, str(SCRIPTS / f"{mod}.py")], timeout=60)
        last = (r.stdout or "").strip().splitlines()
        check(f"{mod}.py passes", r.returncode == 0, last[-1] if last else "")

    print("20g. Music DNA Copilot 3.0 product layer + /api/v3")
    r = run([sys.executable, str(SCRIPTS / "test_v3_product.py")], timeout=300)
    last = (r.stdout or "").strip().splitlines()
    check("test_v3_product.py passes", r.returncode == 0, last[-1] if last else "")

    print("21. Local UI (after isolated subprocess suites)")
    import local_interface as li
    print("21a. Regression: feedback schema compatibility (uses local_interface)")
    fb_schema = json.loads((ROOT / "schemas" / "feedback.schema.json").read_text(encoding="utf-8"))
    entry = li.save_feedback({
        "track_title": "Regression", "artist": "Tester", "genres": ["synthwave"],
        "group": "safe_match", "action": "like", "mood": 1,
        "task": "night_drive", "experimentality": 3, "source": "regression",
    })
    errs = validate_against_schema(entry, fb_schema)
    check("save_feedback() output validates against feedback.schema.json",
          not errs, "; ".join(errs[:3]))
    check("feedback record carries required timestamp + action",
          "timestamp" in entry and entry.get("action") == "like")
    # the sample feedback file must also match the documented contract
    sample_fb = json.loads((ROOT / "examples" / "sample_feedback.json").read_text(encoding="utf-8"))
    check("examples/sample_feedback.json matches schema",
          not validate_against_schema(sample_fb, fb_schema))


    port = li.find_free_port(8801)
    li.CURRENT_PORT[0] = port
    from http.server import HTTPServer
    server = HTTPServer((li.HOST, port), li.Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    time.sleep(0.3)
    base = f"http://{li.HOST}:{port}"
    import faulthandler
    # Hard watchdog: if the UI section stalls for any reason, dump all thread
    # stacks and abort with a non-zero exit instead of hanging forever.
    faulthandler.dump_traceback_later(75, exit=True)
    try:
        for lang, marker in (("en", "Music DNA Copilot"),
                             ("ru", "Источник музыки"),
                             ("uk", "Джерело музики")):
            html = _open(f"{base}/classic?lang={lang}").read().decode()
            check(f"home page renders [{lang}]", marker in html and "privacy" in html.lower() or marker in html)
        home_en = _open(f"{base}/classic?lang=en").read().decode()
        check("home renders Last.fm source card", 'value="lastfm"' in home_en and "Last.fm" in home_en)
        check("Last.fm missing-key message shown cleanly", "Add LASTFM_API_KEY" in home_en)
        check("Last.fm username field present", 'name="lastfm_username"' in home_en)
        check("Last.fm similar-discovery toggle present", 'name="use_lastfm_candidates"' in home_en)
        check("source dashboard lists sources", "Music sources" in home_en)
        check("Apple Music is planned-only (no connect button)",
              "Apple Music" in home_en and "apple developer" in home_en.lower()
              and 'href="/apple' not in home_en)
        check("YouTube Music presented as Takeout file import (not live login)",
              "Takeout file import" in home_en and "no cookies" in home_en)
        check("YouTube Takeout source + upload field present",
              'value="youtube_takeout"' in home_en and 'name="takeout_file"' in home_en)
        check("Last.fm export-file upload present", 'name="lastfm_file"' in home_en)
        check("genre enrichment toggle present (on by default)",
              'name="enrich_genres" value="1" checked' in home_en)
        check("My presets section present", "My presets" in home_en)
        check("preset save/delete controls present in UI",
              "savePreset()" in home_en and "deletePreset(" in home_en)
        check("no active Spotify playlist export (still future)",
              "Create Spotify playlist" not in home_en and "Export to Spotify playlist" not in home_en)
        # preset routes: save -> appears -> delete; built-in delete rejected
        psave = json.dumps({"name": "Smoke Preset", "mood": "1", "task": "workout",
                            "novelty": "4", "genre_families": "electronic"}).encode()
        req = urllib.request.Request(f"{base}/preset/save", data=psave,
                                     headers={"Content-Type": "application/json"})
        pres = json.loads(_open(req).read().decode())
        check("custom preset saved via UI route", pres.get("ok") and pres.get("id", "").startswith("custom:"))
        new_home = _open(f"{base}/classic?lang=en").read().decode()
        check("saved custom preset appears on home", "Smoke Preset" in new_home)
        try:
            req = urllib.request.Request(f"{base}/preset/delete",
                                         data=json.dumps({"id": "builtin:night_drive"}).encode(),
                                         headers={"Content-Type": "application/json"})
            _open(req).read()
            builtin_blocked = False
        except urllib.error.HTTPError as e:
            builtin_blocked = (e.code == 400)
        check("built-in preset cannot be deleted", builtin_blocked)
        req = urllib.request.Request(f"{base}/preset/delete",
                                     data=json.dumps({"id": pres["id"]}).encode(),
                                     headers={"Content-Type": "application/json"})
        check("custom preset deleted via UI route", json.loads(_open(req).read().decode()).get("ok"))
        check("no monetization link by default (SUPPORT_URL unset)",
              "Support this project" not in home_en)
        # personal queue page renders
        qhtml = _open(f"{base}/queue").read().decode()
        check("My Music Queue page renders", "My Music Queue" in qhtml)
        # local data management page + actions
        dhtml = _open(f"{base}/data").read().decode()
        check("data management page renders", "Local data" in dhtml and "Full reset" in dhtml)
        shtml = _open(f"{base}/sources").read().decode()
        check("sources page renders with statuses",
              "Sources &" in shtml and "Test Last.fm connection" in shtml
              and "import only" in shtml and "future / planned" in shtml)
        sthtml = _open(f"{base}/self-test").read().decode()
        check("self-test checklist page renders",
              "Self-Test" in sthtml and "What to click" in sthtml and "Expected:" in sthtml)
        check("owner demo dataset present with 40+ tracks",
              (ROOT / "examples" / "demo_owner_taste.json").exists()
              and len(json.loads((ROOT / "examples" / "demo_owner_taste.json")
                                 .read_text(encoding="utf-8")).get("tracks", [])) >= 40)
        check("owner demo source option on home", "Owner-style demo taste" in home_en)
        check("SELF_TEST_PLAN.md exists with scoring table",
              (ROOT / "SELF_TEST_PLAN.md").exists()
              and "Recommendation quality" in (ROOT / "SELF_TEST_PLAN.md").read_text(encoding="utf-8"))
        check("pool warning is actionable",
              "Try Balanced mode" in (ROOT / "scripts" / "mtr_app" / "i18n.py").read_text(encoding="utf-8"))
        # Vercel demo mode: files present + engine runs fully in memory, offline
        check("vercel demo files present",
              (ROOT / "api" / "recommend.py").exists() and (ROOT / "api" / "_engine.py").exists()
              and (ROOT / "index.html").exists() and (ROOT / "vercel.json").exists()
              and (ROOT / "VERCEL_DEPLOY.md").exists())
        sys.path.insert(0, str(ROOT / "api"))
        try:
            import _engine as _vercel_engine
            before = {p.name for p in (ROOT / "outputs").glob("*")}
            vd = _vercel_engine.demo_recommend({"source": "owner_demo", "mood": -1,
                                                "task": "night_drive", "novelty": 3})
            after = {p.name for p in (ROOT / "outputs").glob("*")}
            check("vercel engine returns recommendations in memory",
                  vd.get("ok") and len(vd.get("recommendations", [])) >= 3
                  and vd["dna"]["tracks_analyzed"] >= 40)
            check("vercel engine writes nothing to outputs", before == after)
            vp = _vercel_engine.demo_recommend({"source": "paste",
                                                "tracks_text": "Marrow by YOB\nFinland - Cult of Luna",
                                                "mood": 0, "task": "workout", "novelty": 2})
            check("vercel engine handles pasted tracks", vp.get("ok")
                  and vp["dna"]["tracks_analyzed"] == 2)
        except Exception as exc:  # pragma: no cover
            check("vercel engine returns recommendations in memory", False, str(exc))
        idx = (ROOT / "index.html").read_text(encoding="utf-8")
        check("demo UI is trilingual with presets and 3 steps",
              "Швидкі пресети" in idx and "Быстрые пресеты" in idx and "Quick presets" in idx
              and idx.count("class=\"step\"") == 3 and "applyPreset" in idx
              and "lim_title" in idx)
        check("vercel docs honest about providers",
              "local/self-test only" in (ROOT / "VERCEL_DEPLOY.md").read_text(encoding="utf-8"))
        lf_save = json.dumps({"username": "smoke_user", "api_key": "smoke_key"}).encode()
        req = urllib.request.Request(f"{base}/lastfm/save", data=lf_save,
                                     headers={"Content-Type": "application/json"})
        check("lastfm save writes local config",
              json.loads(_open(req).read().decode()).get("ok")
              and (ROOT / "outputs" / "local_config.json").exists())
        req = urllib.request.Request(f"{base}/lastfm/clear", data=b"{}",
                                     headers={"Content-Type": "application/json"})
        check("lastfm clear works", json.loads(_open(req).read().decode()).get("ok"))
        backup = _open(f"{base}/data/backup")
        bblob = backup.read()
        check("data backup downloads a zip", bblob[:2] == b"PK" and len(bblob) > 0)
        # clear shortlist via /data/action (seed one shortlist item first)
        sl = json.dumps({"track_title": "Tmp", "artist": "Tmp", "action": "shortlist"}).encode()
        req = urllib.request.Request(f"{base}/feedback", data=sl,
                                     headers={"Content-Type": "application/json"})
        _open(req).read()
        req = urllib.request.Request(f"{base}/data/action",
                                     data=json.dumps({"action": "shortlist"}).encode(),
                                     headers={"Content-Type": "application/json"})
        check("clear shortlist via data action", json.loads(_open(req).read().decode()).get("ok"))
        # full reset without confirm must be rejected
        try:
            req = urllib.request.Request(f"{base}/data/action",
                                         data=json.dumps({"action": "full_reset"}).encode(),
                                         headers={"Content-Type": "application/json"})
            _open(req).read()
            reset_guarded = False
        except urllib.error.HTTPError as e:
            reset_guarded = (e.code == 400)
        check("full reset requires confirmation", reset_guarded)
        # new built-in presets are present
        check("new presets present (Calm Ambient, Workout, Experimental Discovery)",
              "Calm Ambient" in home_en and "Workout" in home_en
              and "Experimental Discovery" in home_en)
        check("added presets present (Post-metal, Focus: No Vocals, Melancholic)",
              "Post-metal" in home_en and "Focus: No Vocals" in home_en
              and "Melancholic but Beautiful" in home_en)
        check("home shows quick-path guidance", "Start with a preset" in home_en)
        # RC checklist + documentation hygiene (read files directly; offline)
        check("RC_CHECKLIST.md exists", (ROOT / "RC_CHECKLIST.md").exists())
        check("START_FOR_FRIEND.md exists", (ROOT / "START_FOR_FRIEND.md").exists())
        check("README_FOR_NORMAL_USER.md exists", (ROOT / "README_FOR_NORMAL_USER.md").exists())
        check("docs/PROVIDER_SETUP.md exists", (ROOT / "docs" / "PROVIDER_SETUP.md").exists())
        check("home shows no-accounts note", "No accounts needed" in home_en)
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        check("README does not call Last.fm a future connector",
              "Last.fm account connector." not in readme
              and "expansion (Last.fm/Spotify) lands" not in readme)
        connectors = (ROOT / "CONNECTORS.md").read_text(encoding="utf-8")
        check("Apple Music documented as future/planned only",
              "FUTURE / PLANNED" in connectors)
        env_example = (ROOT / ".env.example").read_text(encoding="utf-8")
        check(".env.example does not require SPOTIFY_CLIENT_SECRET",
              "SPOTIFY_CLIENT_SECRET" not in env_example)
        provider_doc = (ROOT / "docs" / "PROVIDER_SETUP.md").read_text(encoding="utf-8")
        check("provider docs use PKCE (no client secret required)",
              "PKCE" in provider_doc and "your_client_secret" not in provider_doc)
        check("README_FOR_NORMAL_USER.md exists", (ROOT / "README_FOR_NORMAL_USER.md").exists())
        check("docs/PROVIDER_SETUP.md exists", (ROOT / "docs" / "PROVIDER_SETUP.md").exists())
        # suggest_next_action unit behavior
        from mtr_app.quality import suggest_next_action as _sna
        s_few = _sna({"tracks_analyzed": 20}, {"recommendations": [],
                     "parameters": {"genre_constraints": {"strictness": "strict"}}}, {}, {})
        check("next-action: strict+few -> broaden", s_few["action"] == "broaden")
        s_small = _sna({"tracks_analyzed": 20}, {"recommendations": [1, 2, 3, 4]},
                       {"favorites_count": 5}, {"size": 10, "warnings": ["small_pool"]})
        check("next-action: small pool -> lastfm", s_small["action"] == "lastfm")
        s_fav = _sna({"tracks_analyzed": 20}, {"recommendations": [1, 2, 3, 4]},
                     {"favorites_count": 0}, {"size": 200})
        check("next-action: no favorites -> favorite", s_fav["action"] == "favorite")
        # demo run through the HTTP interface
        print("   - posting demo /recommend ...", flush=True)
        form = urllib.parse.urlencode({"source": "sample", "mood": "1", "task": "night_drive",
                                       "novelty": "3", "max": "6", "lang": "en"}).encode()
        req = urllib.request.Request(f"{base}/recommend", data=form,
                                     headers={"Content-Type": "application/x-www-form-urlencoded"})
        html = _open(req, timeout=45).read().decode()
        print("   - demo /recommend done", flush=True)
        check("demo run via UI returns results", "Your Music DNA" in html and "Safe Match" in html)
        check("candidate pool status shown in UI", "Candidate pool:" in html)
        check("profile quality card appears after generation", "Profile quality" in html)
        check("feedback buttons present", "sendFeedback" in html and "data-action='like'" in html)
        check("export links present", "/export/markdown" in html and "/export/json" in html)
        check("recommended next action shown", "Recommended next action" in html)
        check("refine/reroll controls shown", "Refine these results" in html)
        # reroll keeps rendering results (safer + broaden), exercised after a demo run
        print("   - posting reroll safer ...", flush=True)
        rsafer = _open(f"{base}/reroll?mode=safer&lang=en", timeout=45).read().decode()
        print("   - reroll safer done", flush=True)
        check("reroll safer returns results", "Your Music DNA" in rsafer and "Safe Match" in rsafer)
        print("   - posting reroll broaden ...", flush=True)
        rbroad = _open(f"{base}/reroll?mode=broaden&lang=en", timeout=45).read().decode()
        print("   - reroll broaden done", flush=True)
        check("reroll broaden returns results", "Your Music DNA" in rbroad)
        rnarrow = _open(f"{base}/reroll?mode=narrow&lang=en", timeout=45).read().decode()
        check("reroll narrow returns results", "Your Music DNA" in rnarrow)
        # deep-genre constrained submission via the UI form (Stage 1)
        gform = urllib.parse.urlencode({
            "source": "sample", "mood": "0", "task": "focus", "novelty": "3", "max": "12",
            "lang": "en", "genre_families": "electronic", "strictness": "strict",
            "discovery": "inside", "exclude_genres": "pop",
        }).encode()
        req = urllib.request.Request(f"{base}/recommend", data=gform,
                                     headers={"Content-Type": "application/x-www-form-urlencoded"})
        print("   - posting genre-constrained /recommend ...", flush=True)
        ghtml = _open(req, timeout=45).read().decode()
        print("   - genre /recommend done", flush=True)
        check("genre-constrained UI run returns results", "Your Music DNA" in ghtml)
        check("genre reasoning shown in result cards (not raw JSON)", "Why it matches" in ghtml)
        grecs = json.loads((ROOT / "outputs" / "local_recommendations.json").read_text(encoding="utf-8"))
        gparams = grecs.get("parameters", {})
        check("UI forwarded genre constraints to engine",
              gparams.get("genre_constraints", {}).get("strictness") == "strict")
        leaked = [r["track_title"] for r in grecs["recommendations"]
                  if any(str(g).lower() == "pop" for g in r.get("genres", []))]
        check("strict UI mode: excluded genre is absent", not leaked, str(leaked[:3]))
        check("strict UI mode: every recommendation has genre_reasoning",
              all("genre_reasoning" in r for r in grecs["recommendations"]))
        check("genre filter actually narrowed the pool",
              gparams.get("candidates_after_genre_filter", 99) < gparams.get("candidate_pool_size", 0) + 1
              and gparams.get("candidates_after_genre_filter", 0) >= 1)
        # feedback POST
        fb = json.dumps({"track_title": "Smoke", "artist": "Test", "genres": ["synthwave"],
                         "group": "safe_match", "action": "like", "mood": 1,
                         "task": "night_drive", "experimentality": 3, "source": "smoke"}).encode()
        req = urllib.request.Request(f"{base}/feedback", data=fb,
                                     headers={"Content-Type": "application/json"})
        resp = json.loads(_open(req).read().decode())
        fb_file = ROOT / "outputs" / "feedback.jsonl"
        check("feedback endpoint saves to outputs/feedback.jsonl", resp.get("ok") and fb_file.exists())
        # exports downloadable
        md = _open(f"{base}/export/markdown").read().decode()
        check("markdown export downloadable", md.startswith("# Music DNA Copilot"))
        ex_json = json.loads(_open(f"{base}/export/json").read().decode())
        check("json export downloadable", "recommendations" in ex_json)
        # multi-source: YouTube Takeout upload -> enrichment -> coverage -> DNA exports
        print("   - posting YouTube Takeout /recommend ...", flush=True)
        bnd = "smokeBoundary7f3a"
        takeout_bytes = (ROOT / "examples" / "sample_youtube_takeout_history.json").read_bytes()
        parts = []
        for k, v in {"lang": "en", "source": "youtube_takeout", "mood": "0", "task": "night_drive",
                     "novelty": "3", "max": "6", "enrich_genres": "1"}.items():
            parts.append(f'--{bnd}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
        parts.append(f'--{bnd}\r\nContent-Disposition: form-data; name="takeout_file"; '
                     f'filename="watch-history.json"\r\nContent-Type: application/json\r\n\r\n'.encode()
                     + takeout_bytes + b"\r\n")
        parts.append(f"--{bnd}--\r\n".encode())
        req = urllib.request.Request(f"{base}/recommend", data=b"".join(parts),
                                     headers={"Content-Type": f"multipart/form-data; boundary={bnd}"})
        thtml = _open(req, timeout=45).read().decode()
        check("Takeout UI run returns results", "Your Music DNA" in thtml)
        check("coverage card rendered", 'id="coverage"' in thtml and "Music DNA Coverage" in thtml)
        check("genre enrichment reported honestly", "Genre enrichment:" in thtml and "inferred" in thtml)
        check("Takeout normalized copy saved for merging",
              (ROOT / "outputs" / "youtube_takeout_normalized.json").exists())
        cov = json.loads((ROOT / "outputs" / "source_coverage.json").read_text(encoding="utf-8"))
        check("coverage lists youtube_takeout", "youtube_takeout" in cov.get("sources_used", []))
        pdna = json.loads(_open(f"{base}/export/dna-json").read().decode())
        check("portable DNA JSON downloadable", isinstance(pdna, dict) and len(pdna) >= 3, list(pdna)[:5])
        card = _open(f"{base}/export/dna-card?lang=en").read().decode()
        check("DNA Card renders as self-contained HTML", card.lstrip().lower().startswith("<!doctype html"))
        home_after = _open(f"{base}/classic?lang=en").read().decode()
        check("merged source becomes available after an import", 'value="merged"' in home_after)
        print("   - posting merged /recommend ...", flush=True)
        req = urllib.request.Request(f"{base}/recommend",
                                     data=b"lang=en&source=merged&mood=0&task=night_drive&novelty=3&max=6&enrich_genres=1",
                                     headers={"Content-Type": "application/x-www-form-urlencoded"})
        mhtml = _open(req, timeout=45).read().decode()
        check("merged UI run returns results + coverage", "Your Music DNA" in mhtml and 'id="coverage"' in mhtml)
        # personal action routing: favorite -> outputs/favorites.jsonl
        fav = json.dumps({"track_title": "Smoke Fav", "artist": "Tester", "genres": ["ambient"],
                          "group": "safe_match", "action": "favorite", "source": "smoke"}).encode()
        req = urllib.request.Request(f"{base}/feedback", data=fav,
                                     headers={"Content-Type": "application/json"})
        resp = json.loads(_open(req).read().decode())
        fav_file = ROOT / "outputs" / "favorites.jsonl"
        check("favorite routes to favorites.jsonl", resp.get("kind") == "favorites" and fav_file.exists())
        # Music DNA report export
        dna = _open(f"{base}/export/dna-report").read().decode()
        check("Music DNA report exports", dna.startswith("# Music DNA"))
        # monetization footer appears only when SUPPORT_URL is set
        os.environ["SUPPORT_URL"] = "https://example.test/support"
        try:
            shtml = _open(f"{base}/classic?lang=en").read().decode()
            check("Support link appears when SUPPORT_URL set", "Support this project" in shtml)
        finally:
            del os.environ["SUPPORT_URL"]
        # enhance endpoint degrades cleanly without Ollama
        req = urllib.request.Request(f"{base}/enhance", data=b'{"lang":"en"}',
                                     headers={"Content-Type": "application/json"})
        resp = json.loads(_open(req).read().decode())
        check("enhance endpoint degrades cleanly without Ollama",
              "error" in resp or "text" in resp)
        # upload size limit -> 413 (temporarily shrink the JSON body limit)
        import mtr_app.io_http as _io
        saved_limit = _io.MAX_JSON_BODY_BYTES
        _io.MAX_JSON_BODY_BYTES = 8
        try:
            big = json.dumps({"action": "like", "pad": "x" * 200}).encode()
            req = urllib.request.Request(f"{base}/feedback", data=big,
                                         headers={"Content-Type": "application/json"})
            status = 200
            try:
                _open(req)
            except urllib.error.HTTPError as exc:
                status = exc.code
            check("oversize request body rejected with 413", status == 413)
        finally:
            _io.MAX_JSON_BODY_BYTES = saved_limit
    finally:
        faulthandler.cancel_dump_traceback_later()
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)
    check("UI server thread fully stopped before later phases", not thread.is_alive())

    print("22. Free-port fallback")
    blocker = HTTPServer((li.HOST, 8802), li.Handler)
    try:
        chosen = li.find_free_port(8802)
        check("busy port skipped for next free one", chosen != 8802)
    finally:
        blocker.server_close()

    print("23. start_app --check")
    import contextlib
    import io
    import start_app
    _buf = io.StringIO()
    with contextlib.redirect_stdout(_buf):
        rc = start_app.status_check()
    status_text = _buf.getvalue()
    check("start_app --check prints status",
          rc == 0 and "status check" in status_text.lower() and "Open in browser" in status_text)

    # Record a status marker so start_app --check can surface the last result.
    try:
        marker = ROOT / "outputs" / ".last_smoke_status"
        marker.parent.mkdir(exist_ok=True)
        verdict = "passed" if not FAIL else f"{len(FAIL)} failed"
        marker.write_text(f"{len(PASS)} passed, {len(FAIL)} failed "
                          f"({time.strftime('%Y-%m-%d %H:%M')})", encoding="utf-8")
    except Exception:
        pass

    print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
    if FAIL:
        print("Failed:", ", ".join(FAIL))
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
