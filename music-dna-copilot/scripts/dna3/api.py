"""JSON API for the 3.0 web app (mounted at /api/v3/ by local_interface.py).

Security model (localhost app):
* Every state-changing request must carry `X-MusicDNA-Client: 3`. A custom
  header forces a CORS preflight, which this server never grants, so another
  website open in the same browser cannot drive the API (CSRF).
* The Host header must be a loopback name (DNS-rebinding guard).
* Destructive actions additionally require `{"confirm": true}` in the body.
"""
from __future__ import annotations

import json
import traceback
from urllib.parse import parse_qs, urlsplit

from . import VERSION, capsules, dna as dna_mod, sources
from .errors import ProductError, bad_request, not_found
from .store import CorruptedDataError, Store, now_iso

CLIENT_HEADER = "X-MusicDNA-Client"
LOOPBACK_HOSTS = {"127.0.0.1", "localhost", "[::1]", "::1"}


class Response:
    def __init__(self, status=200, body=None, *, content_type="application/json; charset=utf-8",
                 headers=None, stream=None):
        self.status = status
        self.body = body
        self.content_type = content_type
        self.headers = headers or {}
        self.stream = stream  # iterator of bytes (NDJSON streaming)

    @classmethod
    def json(cls, obj, status=200):
        return cls(status, json.dumps({"ok": status < 400, **obj} if isinstance(obj, dict) else obj,
                                      ensure_ascii=False).encode("utf-8"))

    @classmethod
    def download(cls, obj, filename):
        data = json.dumps(obj, indent=2, ensure_ascii=False).encode("utf-8")
        return cls(200, data, headers={"Content-Disposition": f'attachment; filename="{filename}"'})


def _err(exc: ProductError):
    return Response.json({"error": exc.to_dict()}, status=exc.status)


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------

def state(store: Store):
    settings = store.settings()
    try:
        dna = dna_mod.load(store)
    except CorruptedDataError as exc:
        dna = None
        store.log_diagnostic("corrupted_data", exc)
    src = sources.sources_summary(store, demo=settings.get("demo_mode"))
    active = capsules.active_capsule(store)
    recent = capsules.history(store, dna)["capsules"][:3]
    return {
        "version": VERSION, "settings": _public_settings(settings),
        "onboarding_completed": settings.get("onboarding_completed"),
        "dna": dna_mod.summary(dna), "has_dna": bool(dna),
        "dna_stale": bool(dna and not dna.get("demo") and src["active_count"] == 0),
        "sources": {"active_count": src["active_count"], "active": src["active"]},
        "session": dna_mod.session_taste(store, settings, dna) if dna else None,
        "active_capsule": {"capsule_id": active["capsule_id"], "tier": active["rarity"],
                           "tier_label": active.get("tier_label"), "state": active["state"]} if active else None,
        "recent_capsules": recent,
        "tiers": {k: {"label": v["label"], "size": v["size"], "tagline": v["tagline"]} for k, v in capsules.TIERS.items()},
        "intents": {k: v["label"] for k, v in capsules.INTENTS.items()},
    }


def _public_settings(s):
    return {k: v for k, v in s.items() if k != "anonymous_seed"}


def privacy_inventory(store: Store):
    def info(path):
        try:
            st = path.stat()
            return {"exists": True, "bytes": st.st_size}
        except OSError:
            return {"exists": False, "bytes": 0}
    files = {name: path for name, path in sources.source_files(store).items()}
    feedback = store.read_jsonl(store.feedback_path)
    events = store.read_jsonl(store.beta_path)
    caps = capsules.all_capsules(store)
    return {
        "stays_local": ("Everything. Music DNA Copilot runs on this computer; your history, DNA, capsules, "
                        "feedback and analytics are files in the outputs/ folder. Nothing is uploaded."),
        "network_calls": ("Only when you ask: Spotify (read-only OAuth) and Last.fm sync, and the music-service "
                          "links you open. Opening a link sends that search or track to that service."),
        "imported": [{"id": k, "label": sources.label(sources.canonical_source(k)), "file": p.name, **info(p)}
                     for k, p in files.items()],
        "stored": {
            "music_dna": info(store.dna_path),
            "capsules": {"count": len(caps), "exists": bool(caps)},
            "feedback": {"count": len(feedback), **info(store.feedback_path)},
            "analytics_events": {"count": len(events), **info(store.beta_path)},
        },
        "analytics": {
            "enabled": store.settings().get("analytics_enabled", True),
            "contains": "Event names, timestamps, a random local ID, capsule tier/intent, provider and resolver status, experiment variant.",
            "never_contains": "Track titles, artist names, listening history, account names or e-mail.",
        },
        "deletable": ["capsule history", "session taste", "learned Music DNA (feedback)", "analytics events",
                      "individual imported sources", "live connections"],
    }


def _privacy_action(store: Store, action, body):
    if not body.get("confirm"):
        raise ProductError("BAD_REQUEST", "Please confirm", "This action needs confirmation.", requires_confirmation=True)
    if action == "delete_history":
        n = 0
        if store.capsules_dir.is_dir():
            for p in store.capsules_dir.glob("*.json"):
                p.unlink(missing_ok=True)
                n += 1
        store.capsule_history_path.unlink(missing_ok=True)
        return {"deleted_capsules": n, "note": "Your learned DNA (feedback) was kept. Reset it separately if you want."}
    if action == "reset_session":
        store.update_settings({"session_reset_at": now_iso()})
        return {"note": "Session taste cleared. Your core DNA is unchanged."}
    if action == "reset_dna":
        store.feedback_path.unlink(missing_ok=True)
        store.dna_path.unlink(missing_ok=True)
        return {"note": "Learned preferences and the DNA snapshot were removed. Imported listening history was kept; rebuild to recreate your DNA."}
    if action == "delete_analytics":
        store.beta_path.unlink(missing_ok=True)
        return {"note": "Local analytics events deleted."}
    raise bad_request(f"Unknown privacy action '{action}'.")


def advanced(store: Store, what):
    if what == "quality":
        from recommendation_quality import capsule_outcomes, evaluate
        caps = capsules.all_capsules(store)
        latest = caps[0] if caps else None
        cur = None
        if latest:
            items = [dict(t, track_title=(t.get("mystery_reveal") or {}).get("track_title") or t.get("track_title"),
                          artist=(t.get("mystery_reveal") or {}).get("artist") or t.get("artist"))
                     for t in latest.get("tracks", [])]
            pool = store.read_json(store.v3 / "candidate_pool.json", {"tracks": []}, quarantine=False) or {"tracks": []}
            cur = evaluate(items, pool.get("tracks", []), label=f"latest {latest.get('rarity')} capsule")
            cur["capsule_id"] = latest["capsule_id"]
        return {"latest": cur, "outcomes": capsule_outcomes(store.read_jsonl(store.capsule_history_path)),
                "definitions": {
                    "relevance_proxy": "Average model match score of the picks. A proxy, not proof of quality.",
                    "diversity": "How different the picks are from each other (genres 75%, artists 25%). 0–1.",
                    "novelty": "Average distance from your known taste. Higher = further out.",
                    "catalog_coverage": "Share of the candidate pool that made it into the capsule.",
                    "artist_concentration": "How much one artist dominates (Herfindahl index). Lower is more varied.",
                    "context_fit": "Average fit to the selected mood and task.",
                    "calibration": "How well scores matched your reactions. Empty until you react to tracks.",
                },
                "caveat": "Offline proxy metrics. They describe the list, not whether you'll like it."}
    if what == "beta":
        import beta_instrumentation as bi
        events = bi.read_events(store.beta_path)
        rep = bi.beta_report(events)
        rep["enabled"] = store.settings().get("analytics_enabled", True)
        rep["variant"] = capsules.variant(store)
        rep["algorithm_version"] = capsules.ALGORITHM_VERSION
        return rep
    if what == "identity":
        merged = store.read_json(store.path("merged_listening_history.json"), {"tracks": []}, quarantine=False) or {"tracks": []}
        from identity_graph import identity_key
        rows, methods = [], {}
        for t in merged.get("tracks", []):
            srcs = t.get("sources") or []
            if len(srcs) < 2:
                continue
            kind = identity_key(t)[0]
            method = {"isrc": "ISRC", "musicbrainz": "MusicBrainz ID", "provider": "Provider ID"}.get(kind, "Metadata (exact or conservative fuzzy)")
            methods[method] = methods.get(method, 0) + 1
            rows.append({"title": t.get("track_name"), "artist": t.get("artist_name"), "method": method,
                         "confidence": "High" if kind in ("isrc", "musicbrainz", "provider") else "Medium",
                         "found_on": [sources.label(sources.canonical_source(s.get("source"))) for s in srcs],
                         "sources": srcs})
        return {"cross_service_tracks": len(rows), "methods": methods, "tracks": rows[:200],
                "policy": "Tracks merge only on shared IDs (ISRC, MusicBrainz, provider) or near-identical title AND artist. We prefer missing a match over merging two different songs."}
    if what == "diagnostics":
        return {"version": VERSION, "diagnostics": store.diagnostics(), "settings": _public_settings(store.settings()),
                "outputs": str(store.base)}
    raise not_found("That Advanced view")


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------

def _build_stream(store: Store, demo):
    def gen():
        try:
            for step in dna_mod.build_steps(store, demo=demo):
                if step["step"] == "done":
                    d = step["dna"]
                    capsules.beta(store, "dna_generated", value=d["stats"]["source_count"])
                    yield (json.dumps({"step": "done", "dna": dna_mod.summary(d)}, ensure_ascii=False) + "\n").encode()
                else:
                    yield (json.dumps(step, ensure_ascii=False) + "\n").encode()
        except ProductError as exc:
            yield (json.dumps({"step": "error", "error": exc.to_dict()}) + "\n").encode()
        except Exception as exc:  # never leak a traceback to the page
            store.log_diagnostic("dna_build_failed", exc, traceback.format_exc())
            yield (json.dumps({"step": "error", "error": {
                "code": "INTERNAL", "title": "Couldn't build your DNA",
                "message": "Something went wrong while analysing your history. Details are in Settings → Advanced.",
                "detail": str(exc)}}) + "\n").encode()
    return Response(200, None, content_type="application/x-ndjson; charset=utf-8", stream=gen())


def dispatch(store: Store, method, raw_path, headers, body_bytes=b"", form=None):
    """Route one /api/v3 request. `form` is pre-parsed multipart fields (imports)."""
    parts = urlsplit(raw_path)
    path = parts.path[len("/api/v3"):].strip("/")
    seg = path.split("/") if path else []
    query = parse_qs(parts.query)
    try:
        host = (headers.get("Host") or "").rsplit(":", 1)[0].strip().lower()
        if host and host not in LOOPBACK_HOSTS:
            raise ProductError("BAD_REQUEST", "Blocked", "This app only answers requests addressed to localhost.")
        if method == "POST" and headers.get(CLIENT_HEADER) != "3":
            return Response.json({"error": {"code": "FORBIDDEN", "title": "Blocked",
                                            "message": "Requests must come from the Music DNA app."}}, status=403)
        body = {}
        if method == "POST" and body_bytes and form is None:
            try:
                body = json.loads(body_bytes.decode("utf-8") or "{}")
            except ValueError:
                raise bad_request("The request body was not valid JSON.")
            if not isinstance(body, dict):
                raise bad_request("Expected a JSON object.")
        return _route(store, method, seg, query, body, form)
    except ProductError as exc:
        return _err(exc)
    except CorruptedDataError as exc:
        return _err(ProductError("CORRUPTED_DATA", "Some local data was damaged",
                                 "A damaged file was set aside (not deleted) so the app can keep working. You may need to rebuild your DNA.",
                                 detail=str(exc)))
    except Exception as exc:
        store.log_diagnostic("internal_error", exc, traceback.format_exc())
        return _err(ProductError("INTERNAL", "Something went wrong",
                                 "That didn't work. Details were saved for Settings → Advanced → Diagnostics.",
                                 detail=f"{type(exc).__name__}: {exc}"))


def _route(store, method, seg, query, body, form):
    head = seg[0] if seg else ""
    if method == "GET":
        if head == "state":
            return Response.json(state(store))
        if head == "dna" and len(seg) == 1:
            d = dna_mod.load(store)
            if not d:
                from .errors import no_dna
                raise no_dna()
            view = {k: v for k, v in d.items() if k not in ("taste_profile", "known_artists")}
            view["session"] = dna_mod.session_taste(store, store.settings(), d)
            return Response.json({"dna": view})
        if head == "dna" and seg[1:] == ["changes"]:
            return Response.json(dna_mod.change_feed(store, dna_mod.load(store)))
        if head == "sources":
            return Response.json(sources.sources_summary(store, demo=store.settings().get("demo_mode")))
        if head == "capsules" and len(seg) == 2:
            return Response.json({"capsule": capsules.view(store, capsules.load(store, seg[1]))})
        if head == "history":
            return Response.json(capsules.history(store))
        if head == "settings":
            return Response.json({"settings": _public_settings(store.settings())})
        if head == "privacy":
            return Response.json(privacy_inventory(store))
        if head == "advanced" and len(seg) == 2:
            return Response.json(advanced(store, seg[1]))
        if head == "export" and len(seg) == 2:
            return _export(store, seg[1])
        raise not_found("That page")

    if method != "POST":
        raise bad_request("Unsupported method.")
    if head == "onboarding" and seg[1:] == ["complete"]:
        s = store.update_settings({"onboarding_completed": True})
        capsules.beta(store, "onboarding_completed")
        return Response.json({"settings": _public_settings(s)})
    if head == "demo":
        s = store.update_settings({"demo_mode": bool(body.get("enable", True))})
        return Response.json({"settings": _public_settings(s)})
    if head == "dna" and seg[1:] == ["build"]:
        settings = store.settings()
        demo = bool(body.get("demo", settings.get("demo_mode")))
        if not demo and not sources.source_files(store):
            raise ProductError("NO_SOURCES", "No sources connected",
                               "Connect or import at least one music source to build your DNA.")
        if demo != settings.get("demo_mode"):
            store.update_settings({"demo_mode": demo})
        return _build_stream(store, demo)
    if head == "sources":
        if seg[1:] == ["import"]:
            if not form:
                raise bad_request("Send the file as multipart form data.")
            provider = getattr(form.get("provider"), "value", "")
            upload = form.get("file")
            result = sources.import_file(store, provider, getattr(upload, "filename", "") or "",
                                         getattr(upload, "data", b"") or b"")
            if store.settings().get("demo_mode"):
                store.update_settings({"demo_mode": False})
                result["notes"] = list(result.get("notes", [])) + ["Demo mode turned off: your DNA will now use your real data."]
            capsules.beta(store, "source_connected", provider=provider)
            return Response.json({"import": result})
        if len(seg) == 3 and seg[1] == "lastfm" and seg[2] == "credentials":
            return Response.json({"lastfm": sources.save_lastfm_credentials(body.get("username"), body.get("api_key"))})
        if len(seg) == 3 and seg[2] == "sync":
            result = sources.sync_provider(store, seg[1])
            if store.settings().get("demo_mode"):
                store.update_settings({"demo_mode": False})
            capsules.beta(store, "source_connected", provider=seg[1])
            return Response.json({"sync": result})
        if len(seg) == 3 and seg[2] in ("disconnect", "remove"):
            if not body.get("confirm"):
                raise ProductError("BAD_REQUEST", "Please confirm", "This action needs confirmation.", requires_confirmation=True)
            fn = sources.disconnect if seg[2] == "disconnect" else sources.remove_source
            return Response.json({"result": fn(store, seg[1])})
        raise not_found("That source action")
    if head == "capsules":
        if len(seg) == 1:
            cap = capsules.generate(store, body.get("tier", "common"), body.get("intent", "surprise"),
                                    body.get("custom_intent"))
            return Response.json({"capsule": capsules.view(store, cap)})
        if len(seg) == 3:
            cid, action = seg[1], seg[2]
            if action == "feedback":
                return Response.json({"capsule": capsules.record_feedback(store, cid, body.get("track_id"), body.get("action"))})
            if action == "reveal":
                return Response.json({"capsule": capsules.reveal(store, cid, body.get("track_id"))})
            if action == "open":
                return Response.json(capsules.open_track(store, cid, body.get("track_id"), body.get("provider")))
            if action == "finish":
                return Response.json({"capsule": capsules.finish(store, cid)})
        raise not_found("That capsule action")
    if head == "settings":
        try:
            s = store.update_settings(body)
        except ValueError as exc:
            raise bad_request(str(exc))
        return Response.json({"settings": _public_settings(s)})
    if head == "privacy" and len(seg) == 2:
        return Response.json({"result": _privacy_action(store, seg[1], body)})
    raise not_found("That action")


def _export(store, kind):
    stamp = now_iso()[:10]
    if kind == "dna":
        d = dna_mod.load(store)
        if not d:
            from .errors import no_dna
            raise no_dna()
        return Response.download({k: v for k, v in d.items() if k != "known_artists"}, f"music-dna-{stamp}.json")
    if kind == "history":
        return Response.download({"exported_at": now_iso(), "capsules": capsules.all_capsules(store)},
                                 f"music-dna-capsules-{stamp}.json")
    if kind == "feedback":
        return Response.download({"exported_at": now_iso(), "feedback": store.read_jsonl(store.feedback_path)},
                                 f"music-dna-feedback-{stamp}.json")
    if kind == "analytics":
        return Response.download({"exported_at": now_iso(), "events": store.read_jsonl(store.beta_path)},
                                 f"music-dna-analytics-{stamp}.json")
    raise not_found("That export")
