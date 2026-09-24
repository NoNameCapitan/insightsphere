#!/usr/bin/env python3
"""
local_interface.py
==================
A dependency-free local browser interface for the Music DNA Copilot.

Run (developers):
    python scripts/local_interface.py
Run (everyone else):
    double-click start_mac.command / start_windows.bat / start_linux.sh
    (they call scripts/start_app.py, which picks a free port and opens
    the browser automatically)

Privacy model:
    - Runs on localhost only.
    - No accounts, no cloud storage, no analytics.
    - All generated files stay in the local `outputs/` folder.
    - Spotify access happens only through explicit OAuth consent (V2).
    - Optional AI enhancement talks only to a LOCAL Ollama server.

What works:
    - Demo library, manual mini-library, JSON/CSV upload, pasted JSON
    - Spotify OAuth source (read-only) with optional Spotify-search candidates
    - Music DNA -> grouped, explainable recommendations
    - Feedback buttons saved to outputs/feedback.jsonl (feedback-aware scoring)
    - Markdown/JSON export, copyable AI prompt
    - UI languages: English / Russian / Ukrainian
"""

import html
import json
import secrets
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from email.parser import BytesParser
from email.policy import default as email_default_policy

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
EXAMPLES = ROOT / "examples"
OUTPUTS = ROOT / "outputs"
HOST = "127.0.0.1"
PORT = 8765  # default; start_app.py may pick another free port
import os as _os_li
PIPELINE_STEP_TIMEOUT = int(_os_li.environ.get("MTR_PIPELINE_TIMEOUT", 120))  # seconds per pipeline subprocess


sys.path.insert(0, str(SCRIPTS))
try:
    from normalize_csv_import import normalize_csv
except Exception:  # pragma: no cover - CLI fallback only
    normalize_csv = None

try:
    import spotify_connector
    from env_loader import load_env
except Exception:  # pragma: no cover - connector module optional
    spotify_connector = None
    load_env = None

try:
    import ollama_enhance
except Exception:  # pragma: no cover
    ollama_enhance = None

# Multi-source layer (merged from the v1.4.0 branch): Takeout / Last.fm export
# import, merge + coverage, Portable Music DNA, DNA Card, genre enrichment.
try:
    import import_youtube_takeout
    import import_multi_service
    import import_lastfm
    import merge_listening_sources
    import export_portable_dna
    import source_common
    import enrich_genres
except Exception:  # pragma: no cover
    import_youtube_takeout = import_multi_service = import_lastfm = merge_listening_sources = None
    export_portable_dna = source_common = enrich_genres = None

# 3.0 product layer (JSON API + web app). The 2.x workspace stays at /classic.
try:
    from dna3 import api as dna3_api
    from dna3.store import Store as Dna3Store
except Exception:  # pragma: no cover
    dna3_api = None
    Dna3Store = None
WEB = ROOT / "web"
WEB_TYPES = {".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
             ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml",
             ".json": "application/json; charset=utf-8", ".png": "image/png", ".ico": "image/x-icon",
             ".webmanifest": "application/manifest+json"}

# Internal modules (split out of this file; routes/UI unchanged).
from mtr_app.i18n import *  # noqa: F401,F403
from mtr_app.io_http import *  # noqa: F401,F403
from mtr_app.io_http import _read_limited_body  # noqa: F401
from mtr_app.spotify_state import *  # noqa: F401,F403
from mtr_app.validation import *  # noqa: F401,F403


# ---------------------------------------------------------------------------
# i18n: simple Python dictionaries (intentionally not a full i18n framework)
# ---------------------------------------------------------------------------


TASK_KEYS = [
    "work_focus", "walking", "workout", "night_drive", "sad_mood", "romantic_mood",
    "party", "relaxation", "tiktok_reels", "ai_video", "playlist_creation",
    "discovering_new_artists", "surprise_me",
]








# ---------------------------------------------------------------------------
# Request parsing (unchanged from V2, stdlib only)
# ---------------------------------------------------------------------------











# ---------------------------------------------------------------------------
# Spotify connection state (V2)
# ---------------------------------------------------------------------------




# ---------------------------------------------------------------------------
# Styling
# ---------------------------------------------------------------------------

BASE_CSS = """
:root {
  color-scheme: light;
  --bg: #f6f4ef; --card: #ffffff; --text: #121212; --muted: #68645c;
  --line: #e4dfd6; --soft: #f0ede6; --accent: #111111; --danger: #9b1c1c; --ok: #1c6b2f;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
* { box-sizing: border-box; }
body { margin: 0; background: radial-gradient(circle at top left, #fffaf0, var(--bg) 35%, #f1eee8); color: var(--text); }
main { width: min(1120px, calc(100vw - 28px)); margin: 0 auto; padding: 26px 0 52px; }
.hero { padding: 30px; border: 1px solid var(--line); border-radius: 28px; background: rgba(255,255,255,.78); box-shadow: 0 18px 50px rgba(0,0,0,.05); backdrop-filter: blur(10px); }
h1 { font-size: clamp(30px, 5vw, 58px); letter-spacing: -0.05em; line-height: .98; margin: 0 0 12px; }
h2 { font-size: 21px; margin: 0 0 12px; letter-spacing: -0.02em; }
h3 { font-size: 17px; margin: 0 0 8px; }
p { color: var(--muted); line-height: 1.56; margin: 8px 0; }
a { color: var(--text); }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 24px; padding: 22px; margin: 16px 0; box-shadow: 0 10px 34px rgba(0,0,0,.035); }
.grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 16px; }
.col-4 { grid-column: span 4; } .col-6 { grid-column: span 6; } .col-8 { grid-column: span 8; } .col-12 { grid-column: span 12; }
@media (max-width: 860px) {
  .col-4, .col-6, .col-8 { grid-column: span 12; }
  main { width: min(100vw - 14px, 720px); padding-top: 10px; }
  .hero { padding: 18px; border-radius: 20px; }
  .card { padding: 16px; border-radius: 18px; }
}
label { display:block; font-weight: 750; margin: 16px 0 8px; }
select, textarea, input[type='number'], input[type='text'], input[type='file'] { width: 100%; border: 1px solid #d7d1c7; border-radius: 14px; padding: 12px 13px; font: inherit; background: #fff; color: var(--text); }
textarea { min-height: 116px; resize: vertical; }
input[type='range'] { width: 100%; accent-color: #111; height: 32px; }
button { width: 100%; border: 0; border-radius: 16px; padding: 15px 18px; font: inherit; font-weight: 800; background: var(--accent); color: white; cursor: pointer; box-shadow: 0 12px 26px rgba(0,0,0,.13); }
button:hover { transform: translateY(-1px); }
button:disabled { opacity: .55; cursor: progress; transform: none; }
.small { font-size: 13px; color: var(--muted); }
.bar { height: 8px; background: var(--soft); border-radius: 999px; overflow: hidden; margin: 4px 0 10px; }
.bar i { display: block; height: 100%; background: var(--accent, #6b5cff); border-radius: 999px; }
.pill.st-ok { background: #e7f6ec; border-color: #9fd6b0; color: #1d6b37; }
.pill.st-off { opacity: .75; }
.pill.st-later { background: #f4f1ea; color: #7a6f5e; }
.pill { display: inline-flex; align-items:center; gap:6px; border:1px solid var(--line); background: var(--soft); border-radius: 999px; padding: 6px 10px; font-size: 12px; font-weight: 750; color:#3b3833; margin: 3px 4px 3px 0; }
.steps { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-top: 18px; }
.step { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 10px; font-size: 13px; color: #3f3b34; text-align:center; }
@media (max-width: 760px) { .steps { grid-template-columns: repeat(2, 1fr); } }
.paths { display:grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 16px; }
@media (max-width: 760px) { .paths { grid-template-columns: 1fr; } }
.path { display:block; border:1px solid var(--line); border-radius: 16px; padding: 14px; background:#fff; text-decoration:none; cursor:pointer; }
.path:hover { background:#fbfaf7; }
.path strong { display:block; margin-bottom: 4px; }
.source-option { display: grid; grid-template-columns: 20px 1fr; gap: 10px; border:1px solid var(--line); border-radius: 16px; padding: 12px; margin: 9px 0; cursor:pointer; }
.source-option:hover { background: #fbfaf7; }
.source-option input { margin-top: 3px; }
.group-title { display:flex; justify-content:space-between; gap: 12px; align-items: baseline; margin-top: 22px; flex-wrap: wrap; }
.rec-card { display:grid; grid-template-columns: 1fr auto; gap: 14px; align-items:start; }
@media (max-width: 600px) { .rec-card { grid-template-columns: 1fr; } .conf { order: -1; } }
.conf { font-size: 24px; font-weight: 900; letter-spacing: -0.04em; }
.genre-direction { border:1px solid var(--line); border-radius:12px; padding:10px 14px; background:var(--soft); }
.genre-direction summary { cursor:pointer; }
.prefs { display:flex; flex-wrap:wrap; gap:6px 16px; }
.prefs .cb { display:inline-flex; align-items:center; gap:6px; font-weight:500; }
.genre-reasoning { border-left:3px solid var(--line); padding:6px 0 6px 12px; margin:8px 0; }
.warn { color:#8a5a00; font-weight:650; }
.link-row { display:flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.link-row a, .link-row button.mini { text-decoration:none; border:1px solid var(--line); background: var(--soft); border-radius: 999px; padding: 7px 10px; font-size: 13px; font-weight: 700; color: var(--text); width:auto; box-shadow:none; }
.fb-row { display:flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.fb-row button { width:auto; padding: 7px 10px; font-size: 13px; font-weight: 700; background: var(--soft); color: var(--text); border:1px solid var(--line); box-shadow:none; border-radius: 999px; }
.fb-row button.done { background:#eaf7ec; border-color:#cfe8d2; color: var(--ok); }
.error { border-color:#ffd0d0; background:#fff3f3; color: var(--danger); }
.ok { border-color:#d6ecd1; background:#f4fff1; }
.notice { border-color:#ffe9c7; background:#fff8ec; }
.hidden { display: none; }
.kpi { background: #faf8f3; border: 1px solid var(--line); border-radius: 18px; padding: 14px; }
.kpi strong { display:block; font-size: 22px; letter-spacing: -0.04em; overflow-wrap: anywhere; }
.langbar { display:flex; justify-content:flex-end; gap:8px; margin: 4px 0 10px; }
.langbar a { text-decoration:none; font-size:13px; font-weight:800; border:1px solid var(--line); background:#fff; border-radius:999px; padding:6px 11px; color:var(--muted); }
.langbar a.active { color:#fff; background:var(--accent); border-color:var(--accent); }
#progress { position: fixed; inset: 0; background: rgba(246,244,239,.92); display:none; align-items:center; justify-content:center; z-index: 50; }
#progress .box { background:#fff; border:1px solid var(--line); border-radius: 22px; padding: 26px 30px; max-width: 420px; text-align:center; box-shadow: 0 18px 50px rgba(0,0,0,.10); }
.spinner { width: 34px; height: 34px; border-radius: 50%; border: 4px solid var(--line); border-top-color: var(--accent); margin: 0 auto 14px; animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
"""


def esc(value):
    return html.escape(str(value))


def _support_footer():
    url = os.environ.get("SUPPORT_URL", "").strip()
    if not url:
        return ""
    return (f'<footer style="text-align:center;padding:18px;font-size:13px">'
            f'<a href="{esc(url)}" target="_blank" rel="noopener">Support this project</a></footer>')


def page(title, body, lang=DEFAULT_LANG):
    return f"""<!doctype html>
<html lang="{esc(lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{esc(title)}</title>
  <style>{BASE_CSS}</style>
</head>
<body><main>{body}</main>
<footer style="text-align:center;padding:14px;font-size:12px;opacity:0.7">
Music DNA Copilot 2.2 · local-first · no accounts · see START_FOR_FRIEND.md
</footer>{_support_footer()}</body></html>""".encode("utf-8")


def lang_bar(lang, path="/classic"):
    names = {"en": "EN", "ru": "RU", "uk": "UK"}
    links = "".join(
        f"<a href='{path}?lang={code}' class='{'active' if code == lang else ''}'>{names[code]}</a>"
        for code in LANGS
    )
    return f"<div class='langbar'>{links}</div>"


def task_options(lang, selected="night_drive"):
    return "\n".join(
        f"<option value='{esc(key)}' {'selected' if key == selected else ''}>{esc(t(lang, 'task_' + key))}</option>"
        for key in TASK_KEYS
    )


def mood_labels(lang):
    return {str(v): t(lang, f"mood_{v}") for v in (-2, -1, 0, 1, 2)}


def novelty_labels(lang):
    return {str(v): t(lang, f"nov_{v}") for v in (1, 2, 3, 4, 5)}


def render_lastfm_source_block(lang):
    """Honest Last.fm source card: username field, similar-tracks toggle, status."""
    if _lastfm is None:
        return ""
    client = _lastfm.LastfmClient()
    status = client.config_status()
    if not status["api_key_present"]:
        hint = t(lang, "lastfm_nokey")
    elif not status["username_present"]:
        hint = t(lang, "lastfm_nouser")
    else:
        hint = t(lang, "lastfm_ready")
    user_default = esc(client.username or "")
    lf = normalized_file_status().get("lastfm")
    lf_reuse = f"<br><span class='small'>{t(lang, 'reuse_note', n=lf['tracks'])}</span>" if lf else ""
    return f"""
      <label class="source-option"><input type="radio" name="source" value="lastfm" id="src-lastfm"><span><strong>{t(lang, 'src_lastfm')}</strong><br><span class="small">{t(lang, 'src_lastfm_sub')}</span></span></label>
      <div style="margin-left:24px">
        <label class="small">{t(lang, 'lastfm_username_label')}</label>
        <input type="text" name="lastfm_username" value="{user_default}" placeholder="your_lastfm_name" autocomplete="off">
        <label class="small">{t(lang, 'lbl_lastfm_file')}</label>
        <input type="file" name="lastfm_file" accept=".json,.csv">{lf_reuse}
        <label class="source-option"><input type="checkbox" name="use_lastfm_candidates" value="1"><span><span class="small">{t(lang, 'lastfm_use_similar')}</span></span></label>
        <p class="small">{esc(hint)}</p>
      </div>"""


def normalized_file_status():
    """Which normalized source files exist locally (with track counts)."""
    status = {}
    if source_common is None:
        return status
    for kind, name in source_common.KNOWN_NORMALIZED_FILES.items():
        path = OUTPUTS / name
        if not path.exists():
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        source = data.get("source", kind)
        if kind == "file_import" and source not in {"csv", "json", "manual"}:
            continue  # demo/spotify/lastfm copies don't count as a separate source
        status[kind] = {"source": source, "tracks": len(data.get("tracks", [])), "file": name}
    return status


def status_pill(lang, kind):
    labels = {
        "imported": ("st_imported", "ok"), "ready": ("st_ready", "ok"),
        "not_imported": ("st_not_imported", "off"), "later": ("st_later", "later"),
    }
    key, cls = labels[kind]
    return f" <span class='pill st-{cls}'>{t(lang, key)}</span>"


def render_multi_source_blocks(lang):
    """YouTube Takeout import, merged profile, honest Apple Music placeholder."""
    if import_youtube_takeout is None:
        return ""
    files = normalized_file_status()
    parts = []
    yt = files.get("youtube_takeout")
    yt_reuse = f"<br><span class='small'>{t(lang, 'reuse_note', n=yt['tracks'])}</span>" if yt else ""
    parts.append(f"""
      <label class="source-option"><input type="radio" name="source" value="youtube_takeout" id="src-youtube"><span><strong>📺 {t(lang, 'src_youtube')}</strong>{status_pill(lang, 'imported' if yt else 'not_imported')}<br><span class="small">{t(lang, 'src_youtube_sub')}</span><br><span class="small">{t(lang, 'src_youtube_hint')}</span></span></label>
      <div style="margin-left:24px">
        <label class="small">{t(lang, 'lbl_takeout_file')}</label>
        <input type="file" name="takeout_file" accept=".json,.html,.htm,.csv">{yt_reuse}
      </div>""")
    ms = files.get("multi_service")
    ms_reuse = f"<br><span class='small'>Saved import: {ms['tracks']} tracks</span>" if ms else ""
    service_opts = "".join(f"<option value='{esc(k)}'>{esc(v)}</option>" for k,v in import_multi_service.SERVICES.items()) if import_multi_service else ""
    parts.append(f"""
      <label class="source-option"><input type="radio" name="source" value="multi_service" id="src-multi"><span><strong>🎼 Apple Music / Deezer / TIDAL / SoundCloud / +</strong>{status_pill(lang, 'imported' if ms else 'not_imported')}<br><span class="small">Import a CSV/JSON export from another music service. Parsed locally and merged into the same Music DNA.</span></span></label>
      <div style="margin-left:24px">
        <label class="small">Music service</label><select name="music_service">{service_opts}</select>
        <label class="small">Export file (.csv or .json)</label><input type="file" name="service_file" accept=".csv,.json">{ms_reuse}
      </div>""")
    if files:
        labels = ", ".join(source_common.SOURCE_LABELS.get(v["source"], v["source"]) for v in files.values())
        parts.append(f"""
      <label class="source-option"><input type="radio" name="source" value="merged" id="src-merged"><span><strong>🧬 {t(lang, 'src_merged')}</strong>{status_pill(lang, 'ready')}<br><span class="small">{t(lang, 'src_merged_sub', sources=esc(labels))}</span></span></label>""")
    else:
        parts.append(f"""
      <div class="source-option" style="cursor:default;opacity:.75"><span>🧬</span><span><strong>{t(lang, 'src_merged')}</strong>{status_pill(lang, 'not_imported')}<br><span class="small">{t(lang, 'src_merged_empty')}</span></span></div>""")
    parts.append(f"""
      <div class="source-option" style="cursor:default;opacity:.7"><span>🍎</span><span><strong>{t(lang, 'src_apple')}</strong>{status_pill(lang, 'later')}<br><span class="small">{t(lang, 'src_apple_sub')}</span></span></div>""")
    if enrich_genres is not None:
        parts.append(f"""
      <label class="source-option" style="margin-top:10px"><input type="checkbox" name="enrich_genres" value="1" checked><span><strong>🏷️ {t(lang, 'enrich_label')}</strong><br><span class="small">{t(lang, 'enrich_sub')}</span></span></label>""")
    return "\n".join(parts)


def render_source_dashboard(lang):
    """Compact, honest 'what works now' list for sources without their own card."""
    return f"""
    <details class="genre-direction" style="margin-top:10px">
      <summary><strong>{t(lang, 'h_sources')}</strong></summary>
      <ul class="small" style="margin:8px 0 0 0; padding-left:18px">
        <li>{t(lang, 'src_dash_demo')}</li>
        <li>{t(lang, 'src_dash_manual')}</li>
        <li>{t(lang, 'src_dash_file')}</li>
        <li>{t(lang, 'src_dash_youtube')}</li>
        <li>{t(lang, 'src_dash_apple')}</li>
      </ul>
    </details>"""


def render_spotify_source_block(lang):
    """Honest connector state block: not configured / connect / connected / wrong port."""
    if spotify_connector is None:
        return ""
    if SPOTIFY.connected():
        who = esc(SPOTIFY.session.display_name or "Spotify")
        mode = t(lang, "mode_remembered") if getattr(SPOTIFY.session, "remember", False) else t(lang, "mode_session")
        candidates_block = f"""
      <label class="source-option" style="margin-left:24px"><input type="checkbox" name="spotify_candidates" value="1" checked><span><strong>{t(lang, 'spotify_candidates')}</strong><br><span class="small">{t(lang, 'spotify_candidates_sub')}</span></span></label>"""
        return f"""
      <label class="source-option"><input type="radio" name="source" value="spotify" id="src-spotify"><span><strong>{t(lang, 'spotify_connected', who=who)}</strong><br><span class="small">{t(lang, 'spotify_connected_sub', mode=mode)} <a href="/spotify/disconnect">{t(lang, 'disconnect')}</a></span></span></label>{candidates_block}"""
    if SPOTIFY.configured():
        expected_port = SPOTIFY.redirect_port()
        if expected_port and expected_port != CURRENT_PORT[0]:
            warning = esc(t(lang, "spotify_port_warning", port=CURRENT_PORT[0], expected=expected_port))
            return f"""
      <div class="source-option" style="cursor:default"><span>🎧</span><span><strong>{t(lang, 'spotify_title')}</strong><br><span class="small" style="color:var(--danger)">{warning}</span></span></div>"""
        err = f"<br><span class='small' style='color:var(--danger)'>{esc(SPOTIFY.last_error)}</span>" if SPOTIFY.last_error else ""
        return f"""
      <div class="source-option" style="cursor:default" id="spotify-connect-block"><span>🎧</span><span><strong>{t(lang, 'spotify_title')}</strong><br><span class="small">{t(lang, 'spotify_connect_sub')} <a href="/spotify/login?lang={lang}">{t(lang, 'connect')}</a> · <a href="/spotify/login?remember=1&lang={lang}">{t(lang, 'connect_remember')}</a>{err}</span></span></div>"""
    return f"""
      <div class="source-option" style="cursor:default"><span>🎧</span><span><strong>{t(lang, 'spotify_title')}</strong><br><span class="small">{t(lang, 'spotify_not_configured')}</span></span></div>"""


try:
    from genre_taxonomy import load_taxonomy as _load_taxonomy
except Exception:  # pragma: no cover - taxonomy optional
    _load_taxonomy = None

try:
    import candidate_engine as _candidate_engine
except Exception:  # pragma: no cover - candidate engine optional
    _candidate_engine = None

try:
    import lastfm_client as _lastfm
except Exception:  # pragma: no cover - lastfm client optional
    _lastfm = None

try:
    import personal_store as _personal
    STORE = _personal.PersonalStore()
except Exception:  # pragma: no cover
    _personal = None
    STORE = None

try:
    import music_dna_report as _dna_report
except Exception:  # pragma: no cover
    _dna_report = None

try:
    from mtr_app.quality import suggest_next_action as _suggest_next_action
except Exception:  # pragma: no cover
    _suggest_next_action = None

try:
    from mtr_app import data_management as _data_mgmt
except Exception:  # pragma: no cover
    _data_mgmt = None

try:
    from mtr_app import local_config as _local_config
    _local_config.apply_to_env()
except Exception:  # pragma: no cover
    _local_config = None


def _genre_datalists():
    """Return (families_options, subgenres_options, all_tokens_options) for the
    UI datalists, sourced from data/genre_taxonomy.json. Empty on any failure."""
    if _load_taxonomy is None:
        return "", "", ""
    try:
        tax = _load_taxonomy()
    except Exception:
        return "", "", ""
    families = sorted(tax.families.keys())
    subs = sorted({s for info in tax.families.values() for s in info.get("subgenres", [])})
    micros = sorted({m for info in tax.families.values() for m in info.get("microgenres", [])})
    all_tokens = sorted(set(families) | set(subs) | set(micros))
    opt = lambda xs: "".join(f'<option value="{esc(x)}">' for x in xs)
    return opt(families), opt(subs), opt(all_tokens)


def genre_controls_html(lang=DEFAULT_LANG):
    fam_opts, sub_opts, all_opts = _genre_datalists()
    return f"""
    <section class="col-12">
      <details class="genre-direction">
        <summary><strong>{t(lang, 'h_genre')}</strong> — <span class="small">{t(lang, 'genre_intro')}</span></summary>
        <div class="grid" style="margin-top:12px">
          <div class="col-6">
            <label>{t(lang, 'lbl_genre_families')}</label>
            <input type="text" name="genre_families" list="dl-families" placeholder="metal, ambient">
            <datalist id="dl-families">{fam_opts}</datalist>
            <label>{t(lang, 'lbl_genre_subgenres')}</label>
            <input type="text" name="genre_subgenres" list="dl-subgenres" placeholder="atmospheric black metal, dark ambient">
            <datalist id="dl-subgenres">{sub_opts}</datalist>
            <label>{t(lang, 'lbl_genre_microgenres')}</label>
            <input type="text" name="genre_microgenres" list="dl-all" placeholder="blackgaze, dungeon synth">
            <label>{t(lang, 'lbl_exclude_genres')}</label>
            <input type="text" name="exclude_genres" list="dl-all" placeholder="metalcore, deathcore">
            <datalist id="dl-all">{all_opts}</datalist>
          </div>
          <div class="col-6">
            <label>{t(lang, 'lbl_strictness')}</label>
            <select name="strictness">
              <option value="soft">{t(lang, 'strict_soft')}</option>
              <option value="balanced" selected>{t(lang, 'strict_balanced')}</option>
              <option value="strict">{t(lang, 'strict_strict')}</option>
            </select>
            <label>{t(lang, 'lbl_discovery')}</label>
            <select name="discovery">
              <option value="inside">{t(lang, 'disc_inside')}</option>
              <option value="adjacent" selected>{t(lang, 'disc_adjacent')}</option>
              <option value="cross_genre">{t(lang, 'disc_cross')}</option>
            </select>
            <label class="small" style="margin-top:8px">{t(lang, 'lbl_prefs')}</label>
            <div class="prefs">
              <label class="cb"><input type="checkbox" name="prefer_ukrainian" value="1"> {t(lang, 'pref_ukrainian')}</label>
              <label class="cb"><input type="checkbox" name="prefer_instrumental" value="1"> {t(lang, 'pref_instrumental')}</label>
              <label class="cb"><input type="checkbox" name="prefer_vocal" value="1"> {t(lang, 'pref_vocal')}</label>
              <label class="cb"><input type="checkbox" name="prefer_obscure" value="1"> {t(lang, 'pref_obscure')}</label>
              <label class="cb"><input type="checkbox" name="prefer_popular" value="1"> {t(lang, 'pref_popular')}</label>
            </div>
          </div>
        </div>
      </details>
    </section>
"""


def render_presets_section(lang=DEFAULT_LANG):
    if _personal is None or STORE is None:
        return ""
    try:
        presets = STORE.list_presets()
    except Exception:
        return ""
    keep = ["mood", "task", "novelty", "genre_families", "genre_subgenres", "genre_microgenres",
            "exclude_genres", "strictness", "discovery", "prefer_ukrainian", "prefer_instrumental",
            "prefer_vocal", "prefer_obscure", "prefer_popular", "use_lastfm_candidates"]
    data = {p["id"]: {k: p.get(k) for k in keep} for p in presets}
    options = "".join(f'<option value="{esc(p["id"])}">{esc(p["name"])}'
                      f'{" (built-in)" if p.get("builtin") else ""}</option>' for p in presets)
    customs = [p for p in presets if not p.get("builtin")]
    if customs:
        custom_rows = "".join(
            f'<li class="small" style="margin:4px 0">{esc(p["name"])} '
            f'<button type="button" class="pill" onclick="deletePreset(\'{esc(p["id"])}\')">'
            f'{t(lang, "presets_delete")}</button></li>' for p in customs)
        custom_block = (f'<p class="small" style="margin-top:10px"><strong>{t(lang, "presets_custom")}</strong></p>'
                        f'<ul style="margin:4px 0">{custom_rows}</ul>'
                        f'<button type="button" class="pill" onclick="resetPresets()">'
                        f'{t(lang, "presets_reset")}</button>')
    else:
        custom_block = f'<p class="small" style="margin-top:10px">{t(lang, "presets_no_custom")}</p>'
    return f"""
    <section class="col-12">
      <details class="genre-direction">
        <summary><strong>{t(lang, 'presets_title')}</strong> — <span class="small">{t(lang, 'presets_hint')}</span></summary>
        <div style="margin-top:10px">
          <select id="presetSelect">{options}</select>
          <button type="button" onclick="applyPreset()">{t(lang, 'presets_apply')}</button>
        </div>
        <div style="margin-top:10px">
          <input type="text" id="presetName" placeholder="{t(lang, 'presets_name_ph')}" style="max-width:220px">
          <button type="button" onclick="savePreset()">{t(lang, 'presets_save')}</button>
          <span id="presetMsg" class="small"></span>
        </div>
        {custom_block}
      </details>
    </section>
    <script>
    const PRESETS = {json.dumps(data, ensure_ascii=False)};
    const PRESET_KEYS = {json.dumps(keep)};
    function _readForm() {{
      const out = {{}};
      PRESET_KEYS.forEach(k => {{ const el = document.querySelector('[name="'+k+'"]');
        if (!el) return; out[k] = (el.type === 'checkbox') ? (el.checked ? '1' : '') : el.value; }});
      return out;
    }}
    function applyPreset() {{
      const p = PRESETS[document.getElementById('presetSelect').value];
      if (!p) return;
      const setVal = (n, v) => {{ const el = document.querySelector('[name="'+n+'"]');
        if (el && v !== undefined && v !== null && v !== '') el.value = v; }};
      ['mood','novelty','task','strictness','discovery','genre_families','genre_subgenres',
       'genre_microgenres','exclude_genres'].forEach(k => setVal(k, p[k]));
      ['prefer_ukrainian','prefer_instrumental','prefer_vocal','prefer_obscure','prefer_popular',
       'use_lastfm_candidates'].forEach(k => {{ const el = document.querySelector('[name="'+k+'"]');
        if (el) el.checked = !!p[k]; }});
      const m = document.getElementById('mood'); if (m) m.dispatchEvent(new Event('input'));
      const n = document.getElementById('novelty'); if (n) n.dispatchEvent(new Event('input'));
      const d = document.querySelector('.genre-direction'); if (d) d.open = true;
    }}
    function _post(url, payload, done) {{
      fetch(url, {{method:'POST', headers:{{'Content-Type':'application/json'}},
        body: JSON.stringify(payload)}}).then(r => r.json()).then(done)
        .catch(e => {{ const m=document.getElementById('presetMsg'); if(m) m.textContent = 'Error'; }});
    }}
    function savePreset() {{
      const name = (document.getElementById('presetName').value || '').trim();
      const msg = document.getElementById('presetMsg');
      if (!name) {{ if (msg) msg.textContent = 'Name required'; return; }}
      const payload = _readForm(); payload.name = name;
      _post('/preset/save', payload, d => {{ if (d.ok) location.reload();
        else if (msg) msg.textContent = d.error || 'Error'; }});
    }}
    function deletePreset(id) {{ _post('/preset/delete', {{id}}, d => location.reload()); }}
    function resetPresets() {{ _post('/preset/reset', {{}}, d => location.reload()); }}
    </script>
"""


def render_home(lang=DEFAULT_LANG, message="", message_class="ok"):
    message_html = f"<section class='card {message_class}'>{message}</section>" if message else ""
    spotify_path_target = "#src-spotify" if SPOTIFY.connected() else f"/spotify/login?lang={lang}"
    spotify_path = (
        f"<a class='path' href='{spotify_path_target}'><strong>🎧 {t(lang, 'path_spotify')}</strong>"
        f"<span class='small'>{t(lang, 'path_spotify_sub')}</span></a>"
        if SPOTIFY.configured() or SPOTIFY.connected() else
        f"<span class='path' style='opacity:.6'><strong>🎧 {t(lang, 'path_spotify')}</strong>"
        f"<span class='small'>{t(lang, 'spotify_not_configured')}</span></span>"
    )
    body = f"""
<p class="small"><a href="/">&larr; Music DNA 3.0</a> &middot; Classic workspace (2.x tools, kept for power users)</p>
{lang_bar(lang)}
<section class="hero">
  <span class="pill">{t(lang, 'tagline')}</span>
  <h1>{t(lang, 'app_title')}</h1>
  <p>{t(lang, 'hero_lead')}</p>
  <div class="paths">
    <button class="path" type="button" onclick="startDemo()"><strong>▶️ {t(lang, 'path_demo')}</strong><span class="small">{t(lang, 'path_demo_sub')}</span></button>
    {spotify_path}
    <a class="path" href="#upload-anchor" onclick="pickUpload()"><strong>📄 {t(lang, 'path_upload')}</strong><span class="small">{t(lang, 'path_upload_sub')}</span></a>
  </div>
  <div class="steps">
    <div class="step">1. {t(lang, 'step_source')}</div>
    <div class="step">2. {t(lang, 'step_mood')}</div>
    <div class="step">3. {t(lang, 'step_task')}</div>
    <div class="step">4. {t(lang, 'step_novelty')}</div>
    <div class="step">5. {t(lang, 'step_result')}</div>
  </div>
</section>
{message_html}
<section class="card notice">
  <h3>🔒 {t(lang, 'privacy_title')}</h3>
  <p class="small">{t(lang, 'privacy_body')}</p>
</section>
<section class="card">
  <p class="small"><strong>{t(lang, 'home_no_accounts')}</strong>
     · <a href="/sources?lang={esc(lang)}">{t(lang, 'sources_title')}</a>
     · <a href="/self-test?lang={esc(lang)}">Self-Test</a></p>
  <p class="small">{t(lang, 'home_steps')}</p>
</section>
<form class="card" method="post" action="/recommend" enctype="multipart/form-data" id="mainForm">
  <input type="hidden" name="lang" value="{esc(lang)}">
  <div class="grid">
    <section class="col-6">
      <h2>{t(lang, 'h_source')}</h2>
      <p class="small">{t(lang, 'source_intro')}</p>
      <label class="source-option"><input type="radio" name="source" value="sample" checked id="src-sample"><span><strong>{t(lang, 'src_sample')}</strong><br><span class="small">{t(lang, 'src_sample_sub')}</span></span></label>
      <label class="source-option"><input type="radio" name="source" value="owner_demo" id="src-owner-demo"><span><strong>{t(lang, 'src_owner_demo')}</strong><br><span class="small">{t(lang, 'src_owner_demo_sub')}</span></span></label>
      <label class="source-option"><input type="radio" name="source" value="manual"><span><strong>{t(lang, 'src_manual')}</strong><br><span class="small">{t(lang, 'src_manual_sub')}</span></span></label>
      <label class="source-option"><input type="radio" name="source" value="upload_json" id="src-upload-json"><span><strong>{t(lang, 'src_upload_json')}</strong><br><span class="small">{t(lang, 'src_upload_json_sub')}</span></span></label>
      <label class="source-option"><input type="radio" name="source" value="upload_csv" id="src-upload-csv"><span><strong>{t(lang, 'src_upload_csv')}</strong><br><span class="small">{t(lang, 'src_upload_csv_sub')}</span></span></label>
      <label class="source-option"><input type="radio" name="source" value="paste_json"><span><strong>{t(lang, 'src_paste')}</strong><br><span class="small">{t(lang, 'src_paste_sub')}</span></span></label>
{render_spotify_source_block(lang)}
{render_lastfm_source_block(lang)}
{render_multi_source_blocks(lang)}
{render_source_dashboard(lang)}
    </section>

    <section class="col-6" id="upload-anchor">
      <h2>{t(lang, 'h_input')}</h2>
      <label>{t(lang, 'lbl_upload')}</label>
      <input type="file" name="library_file" id="library_file" accept=".json,.csv,application/json,text/csv">

      <label>{t(lang, 'lbl_paste')}</label>
      <textarea name="pasted_json" placeholder='{{"source":"manual","exported_at":"...","tracks":[...]}}'></textarea>

      <label>{t(lang, 'lbl_manual')}</label>
      <p class="small">{t(lang, 'lbl_manual_help')}</p>
      <textarea name="manual_tracks" placeholder="Nightcall — Kavinsky&#10;Marrow by YOB&#10;A Solitary Reign by Amenra&#10;Midnight City - M83"></textarea>

      <label>{t(lang, 'lbl_manual_genres')}</label>
      <input type="text" name="manual_genres" placeholder="synthwave, electronic, indie, ambient">
    </section>

    <section class="col-4">
      <h2>{t(lang, 'h_mood')}</h2>
      <label>{t(lang, 'lbl_mood')} <span id="moodLabel">{t(lang, 'mood_1')}</span></label>
      <input id="mood" name="mood" type="range" min="-2" max="2" step="1" value="1">
      <p class="small">{t(lang, 'mood_scale')}</p>
    </section>

    <section class="col-4">
      <h2>{t(lang, 'h_task')}</h2>
      <label>{t(lang, 'lbl_task')}</label>
      <select name="task">{task_options(lang)}</select>
      <p class="small">{t(lang, 'task_hint')}</p>
    </section>

    <section class="col-4">
      <h2>{t(lang, 'h_novelty')}</h2>
      <label>{t(lang, 'lbl_novelty')} <span id="noveltyLabel">{t(lang, 'nov_3')}</span></label>
      <input id="novelty" name="novelty" type="range" min="1" max="5" step="1" value="3">
      <p class="small">{t(lang, 'novelty_hint')}</p>
    </section>

{render_presets_section(lang)}
{genre_controls_html(lang)}
    <section class="col-12">
      <label>{t(lang, 'lbl_max')}</label>
      <input name="max" type="number" min="3" max="24" value="9">
      <button type="submit" id="goBtn">{t(lang, 'btn_go')}</button>
      <p class="small">{t(lang, 'local_note')}</p>
    </section>
  </div>
</form>
<div id="progress"><div class="box"><div class="spinner"></div><h3>{t(lang, 'progress_title')}</h3><p class="small">{t(lang, 'progress_body')}</p></div></div>
<script>
const mood = document.getElementById('mood');
const moodLabel = document.getElementById('moodLabel');
const moodMap = {json.dumps(mood_labels(lang), ensure_ascii=False)};
mood.oninput = () => moodLabel.textContent = moodMap[mood.value];
const novelty = document.getElementById('novelty');
const noveltyLabel = document.getElementById('noveltyLabel');
const noveltyMap = {json.dumps(novelty_labels(lang), ensure_ascii=False)};
novelty.oninput = () => noveltyLabel.textContent = noveltyMap[novelty.value];
const form = document.getElementById('mainForm');
form.addEventListener('submit', () => {{
  document.getElementById('goBtn').disabled = true;
  document.getElementById('progress').style.display = 'flex';
}});
function startDemo() {{
  document.getElementById('src-sample').checked = true;
  form.requestSubmit();
}}
function pickUpload() {{
  document.getElementById('src-upload-csv').checked = true;
  setTimeout(() => document.getElementById('library_file').focus(), 100);
}}
</script>
"""
    return page(t(lang, "app_title"), body, lang)


# ---------------------------------------------------------------------------
# Input preparation
# ---------------------------------------------------------------------------















def prepare_history(fields, lang):
    """Returns (history_path, source_label, history_dict, wants_spotify_candidates)."""
    source = read_field(fields, "source", "sample")
    OUTPUTS.mkdir(exist_ok=True)
    out = OUTPUTS / "local_input_history.json"

    def write(history):
        out.write_text(json.dumps(history, indent=2, ensure_ascii=False), encoding="utf-8")
        return history

    if source == "sample":
        shutil.copyfile(EXAMPLES / "sample_listening_history.json", out)
        history = json.loads(out.read_text(encoding="utf-8"))
        return out, t(lang, "src_sample"), history, False

    if source == "owner_demo":
        shutil.copyfile(EXAMPLES / "demo_owner_taste.json", out)
        history = json.loads(out.read_text(encoding="utf-8"))
        return out, t(lang, "src_owner_demo"), history, False

    if source == "manual":
        history = write(build_manual_history(read_field(fields, "manual_tracks", ""),
                                             read_field(fields, "manual_genres", ""), lang))
        return out, t(lang, "src_manual"), history, False

    if source == "paste_json":
        pasted = read_field(fields, "pasted_json", "").strip()
        if not pasted:
            raise UserInputError(t(lang, "err_paste_empty"))
        history = write(ensure_history_object(parse_json_or_fail(pasted, lang), lang, "json"))
        return out, t(lang, "src_paste"), history, False

    if source == "spotify":
        if spotify_connector is None or not SPOTIFY.connected():
            raise UserInputError(t(lang, "err_spotify_not_connected"))
        history = spotify_connector.fetch_listening_history(SPOTIFY.session)
        if not history["tracks"]:
            raise UserInputError(t(lang, "err_spotify_empty"))
        (OUTPUTS / "spotify_history.json").write_text(
            json.dumps(history, indent=2, ensure_ascii=False), encoding="utf-8")
        write(history)
        who = SPOTIFY.session.display_name or "Spotify"
        wants_candidates = read_field(fields, "spotify_candidates", "") == "1"
        return out, f"Spotify (OAuth): {who}", history, wants_candidates

    if source == "youtube_takeout":
        if import_youtube_takeout is None:
            raise RuntimeError("Takeout importer module could not be loaded.")
        normalized = OUTPUTS / "youtube_takeout_normalized.json"
        filename, data = read_upload(fields, "takeout_file")
        if data:
            suffix = Path(filename or "takeout.json").suffix or ".json"
            with tempfile.NamedTemporaryFile("wb", suffix=suffix, delete=False) as tmp:
                tmp.write(data)
                tmp_path = Path(tmp.name)
            try:
                history = import_youtube_takeout.import_takeout(tmp_path)
            except (ValueError, FileNotFoundError, UnicodeDecodeError) as exc:
                raise UserInputError(t(lang, "err_takeout_parse", detail=esc(exc))) from exc
            finally:
                tmp_path.unlink(missing_ok=True)
            if not history.get("tracks"):
                raise UserInputError(t(lang, "err_takeout_parse", detail=t(lang, "err_no_tracks")))
            normalized.write_text(json.dumps(history, indent=2, ensure_ascii=False), encoding="utf-8")
        elif normalized.exists():
            history = json.loads(normalized.read_text(encoding="utf-8"))
        else:
            raise UserInputError(t(lang, "err_takeout_empty"))
        write(history)
        return out, f"YouTube Takeout ({len(history['tracks'])})", history, False

    if source == "multi_service":
        if import_multi_service is None:
            raise RuntimeError("Multi-service importer module could not be loaded.")
        svc = read_field(fields, "music_service", "generic")
        filename, data = read_upload(fields, "service_file")
        normalized = OUTPUTS / "multi_service_normalized.json"
        if data:
            suffix = Path(filename or "music-export.csv").suffix or ".csv"
            with tempfile.NamedTemporaryFile("wb", suffix=suffix, delete=False) as tmp:
                tmp.write(data); tmp_path = Path(tmp.name)
            try:
                history = import_multi_service.import_service_export(tmp_path, svc)
            except Exception as exc:
                raise UserInputError(f"Could not import {svc}: {esc(exc)}") from exc
            finally:
                tmp_path.unlink(missing_ok=True)
            normalized.write_text(json.dumps(history, indent=2, ensure_ascii=False), encoding="utf-8")
        elif normalized.exists():
            history = json.loads(normalized.read_text(encoding="utf-8"))
        else:
            raise UserInputError("Choose a CSV or JSON export from your music service.")
        write(history)
        return out, f"{history.get('service_label', svc)} ({len(history['tracks'])})", history, False

    if source == "merged":
        if merge_listening_sources is None:
            raise RuntimeError("Merge module could not be loaded.")
        inputs = merge_listening_sources.discover_default_inputs()
        if not inputs:
            raise UserInputError(t(lang, "err_merge_empty"))
        try:
            history, _coverage, merged_path = merge_listening_sources.merge_sources(inputs)
        except ValueError as exc:
            raise UserInputError(t(lang, "err_merge_empty")) from exc
        labels = ", ".join(source_common.SOURCE_LABELS.get(s_, s_) for s_ in _coverage["sources_used"])
        return merged_path, f"🧬 {labels}", history, False

    if source == "lastfm" and import_lastfm is not None:
        lf_name, lf_data = read_upload(fields, "lastfm_file")
        if lf_data:
            suffix = Path(lf_name or "lastfm.json").suffix or ".json"
            with tempfile.NamedTemporaryFile("wb", suffix=suffix, delete=False) as tmp:
                tmp.write(lf_data)
                tmp_path = Path(tmp.name)
            try:
                history = import_lastfm.parse_export_file(tmp_path)
            except Exception as exc:
                raise UserInputError(t(lang, "err_lastfm", detail=esc(exc))) from exc
            finally:
                tmp_path.unlink(missing_ok=True)
            if not history.get("tracks"):
                raise UserInputError(t(lang, "err_lastfm_empty"))
            (OUTPUTS / "lastfm_normalized.json").write_text(
                json.dumps(history, indent=2, ensure_ascii=False), encoding="utf-8")
            write(history)
            return out, f"Last.fm file: {lf_name or 'export'} ({len(history['tracks'])})", history, False

    if source == "lastfm":
        if _lastfm is None:
            raise UserInputError(t(lang, "err_lastfm_unavailable"))
        username = read_field(fields, "lastfm_username", "").strip()
        client = _lastfm.LastfmClient(username=username or None)
        status = client.config_status()
        if not status["api_key_present"]:
            raise UserInputError(t(lang, "err_lastfm_no_key"))
        if not (username or client.username):
            raise UserInputError(t(lang, "err_lastfm_no_user"))
        try:
            history = client.get_recent_tracks(username=username or None, limit=200)
        except _lastfm.LastfmError as exc:
            raise UserInputError(t(lang, "err_lastfm_fetch", detail=esc(str(exc))))
        if not history["tracks"]:
            raise UserInputError(t(lang, "err_lastfm_empty"))
        (OUTPUTS / "lastfm_normalized.json").write_text(
            json.dumps(history, indent=2, ensure_ascii=False), encoding="utf-8")
        write(history)
        who = history.get("username") or "Last.fm"
        return out, f"Last.fm: {who}", history, False

    filename, data = read_upload(fields, "library_file")
    if source in {"upload_json", "upload_csv"} and not data:
        raise UserInputError(t(lang, "err_upload_empty"))

    if source == "upload_json":
        history = write(ensure_history_object(
            parse_json_or_fail(data.decode("utf-8", errors="replace"), lang), lang, "json"))
        return out, f"{t(lang, 'src_upload_json')}: {filename}", history, False

    if source == "upload_csv":
        if normalize_csv is None:
            raise RuntimeError("CSV importer could not be loaded.")
        with tempfile.NamedTemporaryFile("wb", suffix=".csv", delete=False) as tmp:
            tmp.write(data)
            tmp_path = Path(tmp.name)
        try:
            history = normalize_csv(tmp_path)
        finally:
            tmp_path.unlink(missing_ok=True)
        if not history.get("tracks"):
            raise UserInputError(t(lang, "err_no_tracks"))
        history = validate_history(history, lang, "csv")
        write(history)
        return out, f"{t(lang, 'src_upload_csv')}: {filename}", history, False

    raise UserInputError(f"Unknown source: {source}")


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------

def resolve_catalog(history, wants_spotify_candidates, lang):
    """Returns (catalog_path, note_text, source_name). Falls back honestly.

    source_name is 'spotify_search' only when Spotify Search candidates were
    actually built; otherwise 'local_catalog'.
    """
    default = EXAMPLES / "sample_candidate_catalog.json"
    if not wants_spotify_candidates:
        return default, t(lang, "catalog_local"), "local_catalog"
    try:
        catalog = spotify_connector.build_candidate_catalog(SPOTIFY.session, history)
        path = OUTPUTS / "spotify_candidate_catalog.json"
        path.write_text(json.dumps(catalog, indent=2, ensure_ascii=False), encoding="utf-8")
        return path, t(lang, "catalog_spotify", n=len(catalog["tracks"])), "spotify_search"
    except Exception as exc:  # any failure -> honest fallback
        return default, t(lang, "catalog_fallback", reason=esc(exc)), "local_catalog"


def run_pipeline(history_path, mood, task, novelty, max_items, catalog_path, lang,
                 genre_constraints=None, personal_memory_path=None):
    """Run the local recommendation pipeline in-process.

    Earlier versions launched three nested Python subprocesses for analyze ->
    recommend -> prompt. That worked for daily use but made the full smoke suite
    flaky in constrained POSIX sandboxes after several subprocess-heavy tests.
    Keeping the pipeline in-process removes the fork/exec pressure while
    preserving the exact same output files and user-visible behavior.
    """
    OUTPUTS.mkdir(exist_ok=True)
    taste = OUTPUTS / "local_taste_profile.json"
    recs = OUTPUTS / "local_recommendations.json"
    prompt = OUTPUTS / "local_recommendation_prompt.md"
    feedback = OUTPUTS / "feedback.jsonl"

    try:
        import analyze_taste as analyzer
        import generate_recommendations as recommender
        import generate_recommendation_prompt as prompt_builder

        history = json.loads(Path(history_path).read_text(encoding="utf-8"))
        tracks = history.get("tracks", [])
        if not tracks:
            raise UserInputError(t(lang, "err_pipeline", detail=esc("No tracks found in the listening history.")))

        genre_affinity = analyzer.calculate_genre_affinity(tracks)
        recurring_artists = analyzer.calculate_artist_recurrence(tracks)
        mood_profile = analyzer.calculate_mood_profile(tracks, genre_affinity)
        repetition = analyzer.calculate_repetition_pattern(tracks)
        novelty_tolerance = analyzer.calculate_novelty_tolerance(repetition)
        taste_profile = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "core_genres": genre_affinity,
            "recurring_artists": recurring_artists,
            "mood_profile": mood_profile,
            "energy_level": round(mood_profile["average_energy"], 3),
            "mainstream_vs_niche": 0.5,
            "repetition_pattern": repetition,
            "novelty_tolerance": round(novelty_tolerance, 3),
            "taste_drift": analyzer.calculate_taste_drift(tracks),
            "emotional_tone": analyzer.determine_emotional_tone(mood_profile),
            "possible_use_cases": analyzer.suggest_use_cases(mood_profile, mood_profile["average_energy"]),
        }
        taste.write_text(json.dumps(taste_profile, indent=2, ensure_ascii=False), encoding="utf-8")

        def _split(value):
            return [x.strip() for x in str(value or "").replace(";", ",").split(",") if x.strip()]

        normalized_gc = None
        if genre_constraints:
            gc = genre_constraints
            normalized_gc = {
                "selected_families": _split(gc.get("genre_families")),
                "selected_subgenres": _split(gc.get("genre_subgenres")),
                "selected_microgenres": _split(gc.get("genre_microgenres")),
                "exclude_genres": _split(gc.get("exclude_genres")),
            }
            if gc.get("strictness"):
                normalized_gc["strictness"] = gc.get("strictness")
            if gc.get("discovery"):
                normalized_gc["discovery_direction"] = gc.get("discovery")
            for pref in ("prefer_ukrainian", "prefer_instrumental", "prefer_vocal",
                         "prefer_obscure", "prefer_popular"):
                if gc.get(pref):
                    normalized_gc[pref] = True

        personal_memory = None
        if personal_memory_path:
            try:
                personal_memory = json.loads(Path(personal_memory_path).read_text(encoding="utf-8"))
            except (OSError, ValueError):
                personal_memory = None

        rec_output = recommender.generate_recommendations(
            taste_profile, mood, task, novelty, max_items=max_items, catalog_path=catalog_path,
            feedback_path=feedback if feedback.exists() else None, use_feedback=feedback.exists(),
            genre_constraints=normalized_gc, personal_memory=personal_memory,
        )
        recs.write_text(json.dumps(rec_output, indent=2, ensure_ascii=False), encoding="utf-8")

        prompt_text = prompt_builder.build_prompt(taste_profile, mood, task, novelty,
                                                  max_recommendations=max_items, language=lang)
        prompt.write_text(prompt_text, encoding="utf-8")
    except UserInputError:
        raise
    except Exception as exc:
        raise UserInputError(t(lang, "err_pipeline", detail=esc(str(exc))))

    return (
        json.loads(taste.read_text(encoding="utf-8")),
        json.loads(recs.read_text(encoding="utf-8")),
        prompt.read_text(encoding="utf-8"),
    )


# ---------------------------------------------------------------------------
# Exports
# ---------------------------------------------------------------------------

def build_markdown_export(profile, recs, source_label):
    params = recs.get("parameters", {})
    lines = [
        "# Music DNA Copilot — Recommendations",
        "",
        f"- Generated: {recs.get('generated_at', '')}",
        f"- Source: {source_label}",
        f"- Mood: {params.get('mood_label', params.get('mood_score'))}",
        f"- Task: {params.get('task')}",
        f"- Experimentality: {params.get('novelty_label', params.get('novelty_level'))}",
        "",
        f"**Music DNA:** {recs.get('music_dna_summary', '')}",
        "",
    ]
    pool = params.get("candidate_pool") or {}
    if pool:
        lines.append(f"- Candidate pool: {pool.get('size')} "
                     f"({', '.join(pool.get('sources_used', []) or [])})")
    pq = params.get("profile_quality")
    if pq:
        lines.append(f"- Profile quality: {pq.get('confidence')} "
                     f"({pq.get('tracks_analyzed')} tracks, {pq.get('detected_genres')} genres, "
                     f"pool {pq.get('candidate_pool_size')})")
        lines.append(f"- Sources used: {', '.join(pq.get('sources_used', []) or [])}")
        if pq.get("tips"):
            lines.append(f"- To improve: {pq['tips'][0]}")
    if params.get("genre_constraints"):
        gc = params["genre_constraints"]
        sel_parts = []
        for k in ("genre_families", "genre_subgenres", "genre_microgenres"):
            v = gc.get(k)
            if isinstance(v, list):
                sel_parts += [str(x) for x in v]
            elif isinstance(v, str) and v.strip():
                sel_parts.append(v.strip())
        sel = ", ".join(sel_parts) or "—"
        lines.append(f"- Genre direction: {sel} (strictness {gc.get('strictness', 'balanced')})")
    lines.append("")
    group_titles = {"safe_match": "Safe Match", "adjacent_discovery": "Adjacent Discovery", "wildcard": "Wildcard"}
    by_group = {}
    for rec in recs.get("recommendations", []):
        by_group.setdefault(rec.get("group", "adjacent_discovery"), []).append(rec)
    for group, title in group_titles.items():
        items = by_group.get(group, [])
        if not items:
            continue
        lines += [f"## {title}", ""]
        for rec in items:
            links = rec.get("search_links", {})
            lines += [
                f"### {rec.get('track_title')} — {rec.get('artist')} ({rec.get('confidence_score')}%)",
                "",
                f"- Genres: {', '.join(rec.get('genres', [])) or '-'}",
                f"- Why it may fit: {rec.get('why_like', '')}",
                f"- Possible mismatch: {rec.get('why_not_like', '')}",
                f"- Listen: [Spotify]({links.get('spotify_search', '')}) · "
                f"[YouTube Music]({links.get('youtube_music_search', '')}) · "
                f"[YouTube]({links.get('youtube_search', '')})",
                "",
            ]
    return "\n".join(lines)


def write_exports(profile, recs, source_label):
    OUTPUTS.mkdir(exist_ok=True)
    md_path = OUTPUTS / "recommendations_export.md"
    json_path = OUTPUTS / "recommendations_export.json"
    md_path.write_text(build_markdown_export(profile, recs, source_label), encoding="utf-8")
    json_path.write_text(json.dumps({"source_label": source_label, "profile": profile, **recs},
                                    indent=2, ensure_ascii=False), encoding="utf-8")
    return md_path, json_path


# ---------------------------------------------------------------------------
# Feedback storage
# ---------------------------------------------------------------------------

def save_feedback(record):
    action = record.get("action")
    if action not in FEEDBACK_ACTIONS:
        raise ValueError(f"Unknown feedback action: {action}")
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "track_title": str(record.get("track_title", ""))[:300],
        "artist": str(record.get("artist", ""))[:300],
        "genres": [str(g)[:60] for g in record.get("genres", [])][:10],
        "group": str(record.get("group", ""))[:40],
        "action": action,
        "mood": record.get("mood"),
        "task": str(record.get("task", ""))[:60],
        "experimentality": record.get("experimentality"),
        "source": str(record.get("source", ""))[:120],
    }
    if record.get("reason"):
        entry["reason"] = str(record["reason"])[:500]
    OUTPUTS.mkdir(exist_ok=True)
    with (OUTPUTS / "feedback.jsonl").open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\n")
    return entry


# ---------------------------------------------------------------------------
# Result rendering
# ---------------------------------------------------------------------------

def render_profile(profile, source_label, recs, lang):
    genres = profile.get("core_genres", [])[:8]
    artists = profile.get("recurring_artists", [])[:6]
    mood = profile.get("mood_profile", {})
    drift = profile.get("taste_drift", {})
    params = recs.get("parameters", {})
    nodata = t(lang, "res_nodata")
    return f"""
{lang_bar(lang)}
<section class="hero">
  <span class="pill">{t(lang, 'res_pill')}</span>
  <h1>{t(lang, 'res_title')}</h1>
  <p>{esc(recs.get('music_dna_summary', ''))}</p>
  <div class="grid">
    <div class="col-4 kpi"><span class="small">{t(lang, 'res_source')}</span><strong>{esc(source_label)}</strong></div>
    <div class="col-4 kpi"><span class="small">{t(lang, 'res_mood')}</span><strong>{esc(t(lang, f"mood_{int(round(float(params.get('mood_score', 0))))}"))}</strong></div>
    <div class="col-4 kpi"><span class="small">{t(lang, 'res_novelty')}</span><strong>{esc(t(lang, f"nov_{int(params.get('novelty_level', 3))}"))}</strong></div>
  </div>
</section>
<section class="card">
  <h2>{t(lang, 'res_profile')}</h2>
  <p><strong>{t(lang, 'res_tone')}:</strong> {esc(profile.get('emotional_tone', 'balanced'))}</p>
  <p><strong>{t(lang, 'res_energy')}:</strong> {esc(profile.get('energy_level', 0.5))} / 1.0 · <strong>{t(lang, 'res_valence')}:</strong> {esc(mood.get('average_valence', 0.5))} / 1.0</p>
  <p><strong>{t(lang, 'res_genres')}:</strong> {' '.join(f'<span class="pill">{esc(g.get("genre"))} · {esc(g.get("affinity_score"))}</span>' for g in genres)}</p>
  <p><strong>{t(lang, 'res_artists')}:</strong> {' '.join(f'<span class="pill">{esc(a.get("artist_name"))}</span>' for a in artists)}</p>
  <p><strong>{t(lang, 'res_drift')}:</strong> {t(lang, 'res_drift_stable')}: {esc(', '.join(drift.get('stable_patterns', [])[:5]) or nodata)} · {t(lang, 'res_drift_new')}: {esc(', '.join(drift.get('new_patterns', [])[:5]) or nodata)}</p>
</section>
"""


def render_recommendation_groups(recs, context, lang):
    by_group = {key: [] for key in GROUP_KEYS}
    for rec in recs.get("recommendations", []):
        by_group.setdefault(rec.get("group", "adjacent_discovery"), []).append(rec)

    genre_active = bool(recs.get("parameters", {}).get("genre_constraints"))
    parts = []
    for group, (title_key, sub_key) in GROUP_KEYS.items():
        items = by_group.get(group, [])
        if not items:
            continue
        title = t(lang, title_key)
        parts.append(f"<div class='group-title'><h2>{title}</h2><p class='small'>{t(lang, sub_key)}</p></div>")
        for rec in items:
            links = rec.get("search_links", {})
            payload = esc(json.dumps({
                "track_title": rec.get("track_title"), "artist": rec.get("artist"),
                "genres": rec.get("genres", []), "group": group, **context,
            }, ensure_ascii=False))
            fb_buttons = "".join(
                f"<button type='button' data-action='{action}' data-rec='{payload}' "
                f"onclick='sendFeedback(this)'>{t(lang, 'fb_' + action)}</button>"
                for action in FEEDBACK_ACTIONS
            )
            personal_buttons = "".join(
                f"<button type='button' data-action='{action}' data-rec='{payload}' "
                f"onclick='sendFeedback(this)'>{t(lang, 'act_' + action)}</button>"
                for action in ("favorite", "listen_later", "never", "shortlist")
            )
            gr = rec.get("genre_reasoning")
            genre_block = ""
            if gr:
                sb = rec.get("scoring_breakdown", {})
                matched = ", ".join(gr.get("matched_selected_genres", [])) or "—"
                pct = lambda v: int(round((v or 0) * 100))
                why_not = gr.get("why_it_may_not_match", "")
                why_not_html = (f"<p class='small'><strong>{t(lang, 'genre_why_not')}:</strong> "
                                f"{esc(why_not)}</p>") if why_not else ""
                genre_block = f"""
    <div class="genre-reasoning">
      <span class="pill">{t(lang, 'genre_match')}: {esc(gr.get('strictness_result', ''))}</span>
      <p class="small"><strong>{t(lang, 'genre_matched')}:</strong> {esc(matched)}</p>
      <p class="small"><strong>{t(lang, 'genre_why_match')}:</strong> {esc(gr.get('why_it_matches_genre_request', ''))}</p>
      {why_not_html}
      <p class="small">{t(lang, 'genre_match')} {pct(sb.get('requested_genre_match_score'))}% · taste {pct(sb.get('user_genre_affinity_score'))}% · total {pct(sb.get('total_score'))}%</p>
    </div>"""
            soft_warn = ""
            if genre_active and not rec.get("genres"):
                soft_warn = f"<p class='small warn'>{t(lang, 'genre_soft_warning')}</p>"
            parts.append(f"""
<article class="card rec-card">
  <div>
    <span class="pill">{esc(title)}</span>
    <h3>{esc(rec.get('track_title'))} — {esc(rec.get('artist'))}</h3>
    <p>{esc(rec.get('explanation', ''))}</p>
    <p><strong>{t(lang, 'why_like')}:</strong> {esc(rec.get('why_like', ''))}</p>
    <p class="small"><strong>{t(lang, 'why_not')}:</strong> {esc(rec.get('why_not_like', ''))}</p>
    <p class="small">{t(lang, 'meta_genres')}: {esc(', '.join(rec.get('genres', [])) or '-')} · {t(lang, 'meta_mood')}: {esc(rec.get('mood_match'))} · {t(lang, 'meta_task')}: {esc(rec.get('task_match'))} · {t(lang, 'meta_novelty')}: {esc(rec.get('novelty_level'))}</p>
    {genre_block}
    {soft_warn}
    <div class="link-row">
      <a href="{esc(links.get('spotify_search', '#'))}" target="_blank" rel="noopener">Spotify</a>
      <a href="{esc(links.get('youtube_music_search', '#'))}" target="_blank" rel="noopener">YouTube Music</a>
      <a href="{esc(links.get('youtube_search', '#'))}" target="_blank" rel="noopener">YouTube</a>
    </div>
    <div class="fb-row">{fb_buttons}</div>
    <div class="fb-row">{personal_buttons}</div>
  </div>
  <div class="conf">{esc(rec.get('confidence_score'))}%</div>
</article>
""")
    return "\n".join(parts)


def compute_profile_quality(history, profile, recs, source_label, pool_summary):
    """Derive a user-facing quality assessment + improvement tips."""
    tracks = history.get("tracks", []) if isinstance(history, dict) else (history or [])
    tracks_analyzed = len(tracks)

    def _pc(tr):
        try:
            return max(1, int(tr.get("play_count", 1)))
        except (TypeError, ValueError):
            return 1
    listening_events = sum(_pc(tr) for tr in tracks)
    detected_genres = len(profile.get("core_genres", []))
    pool = pool_summary or {}
    params = recs.get("parameters", {})
    pool_size = pool.get("size", params.get("candidate_pool_size", 0)) or 0
    pool_sources = pool.get("sources_used") or ["local_catalog"]
    enriched = pool.get("enriched_candidate_count", 0)
    tagless = pool.get("tagless_candidate_count", 0)
    metadata_quality = pool.get("genre_metadata_quality", "low" if not pool else "medium")
    used_lastfm = "lastfm_similar" in pool_sources
    sources_used = []
    for s in [source_label] + list(pool_sources):
        if s and s not in sources_used:
            sources_used.append(s)

    if tracks_analyzed < 8 or detected_genres == 0 or pool_size < 20:
        confidence = "low"
    elif tracks_analyzed >= 30 and detected_genres >= 5 and pool_size >= 60:
        confidence = "high"
    else:
        confidence = "medium"

    tips = []
    if tracks_analyzed < 20:
        tips.append("Upload a larger history file (or connect Spotify/Last.fm) for stronger Music DNA.")
    if not used_lastfm and pool_size < 60:
        tips.append("Enable Last.fm similar tracks to expand the candidate pool.")
    if used_lastfm and tagless and (tagless / max(1, pool_size)) > 0.3:
        tips.append("Last.fm candidates were found, but some genre tags are sparse.")
    if detected_genres < 3:
        tips.append("Use the deep genre controls and exclude genres you dislike.")
    tips.append("If strict mode returns too few results, try broader discovery (adjacent/cross-genre).")

    return {
        "sources_used": sources_used,
        "tracks_analyzed": tracks_analyzed,
        "listening_events": listening_events,
        "detected_genres": detected_genres,
        "candidate_pool_size": pool_size,
        "candidate_sources": pool_sources,
        "enriched_candidates": enriched,
        "tagless_candidates": tagless,
        "genre_metadata_quality": metadata_quality,
        "confidence": confidence,
        "tips": tips,
    }


def render_profile_quality(params, lang):
    pq = params.get("profile_quality")
    if not pq:
        return ""
    conf = pq.get("confidence", "medium")
    tips = "".join(f"<li>{esc(tip)}</li>" for tip in pq.get("tips", []))
    return f"""
<section class="card">
  <h2>{t(lang, 'pq_title')}</h2>
  <p>
    <span class="pill">{t(lang, 'pq_confidence')}: {esc(conf)}</span>
    <span class="pill">{t(lang, 'pq_tracks')}: {esc(pq.get('tracks_analyzed'))}</span>
    <span class="pill">{t(lang, 'pq_events')}: {esc(pq.get('listening_events'))}</span>
    <span class="pill">{t(lang, 'pq_genres')}: {esc(pq.get('detected_genres'))}</span>
    <span class="pill">{t(lang, 'pq_pool')}: {esc(pq.get('candidate_pool_size'))}</span>
    <span class="pill">{t(lang, 'pq_meta_quality')}: {esc(pq.get('genre_metadata_quality', '-'))}</span>
  </p>
  <p class="small">{t(lang, 'pq_sources')}: {esc(', '.join(pq.get('sources_used', [])) or '-')} · {t(lang, 'pq_pool_sources')}: {esc(', '.join(pq.get('candidate_sources', [])) or '-')}</p>
  <p class="small">{t(lang, 'pq_enriched')}: {esc(pq.get('enriched_candidates', 0))} · {t(lang, 'pq_tagless')}: {esc(pq.get('tagless_candidates', 0))}</p>
  <p class="small"><strong>{t(lang, 'pq_tips')}:</strong></p>
  <ul class="small">{tips}</ul>
</section>"""


def render_personal_memory_card(lang):
    if _personal is None or STORE is None:
        return ""
    try:
        mem = STORE.personal_memory(feedback_path=OUTPUTS / "feedback.jsonl")
    except Exception:
        return ""
    if not (mem["favorites_count"] or mem["rejects_count"] or mem["listen_later_count"]):
        line = t(lang, "pm_none")
    else:
        line = t(lang, "pm_active", fav=mem["favorites_count"], rej=mem["rejects_count"],
                 ll=mem["listen_later_count"])
    boosted = ", ".join(mem["boosted_genres"][:6]) or "—"
    reduced = ", ".join(mem["reduced_genres"][:6]) or "—"
    return f"""
<section class="card">
  <h2>{t(lang, 'pm_title')}</h2>
  <p class="small">{esc(line)}</p>
  <p class="small">↑ {esc(boosted)} · ↓ {esc(reduced)}</p>
  <p class="small"><a href="/queue">{t(lang, 'nav_queue')}</a></p>
</section>"""


def render_data_page(lang=DEFAULT_LANG):
    if _data_mgmt is None:
        return page("Data", "<section class='card'><p>Data management unavailable.</p></section>", lang)
    rows = []
    for info in _data_mgmt.file_status(OUTPUTS):
        status = "✓" if info["exists"] else "—"
        count = "" if info["count"] is None else f"{info['count']} items · "
        size = f"{info['size']:,} B" if info["exists"] else ""
        mod = f" · {info['modified']}" if info["modified"] else ""
        rows.append(f"<tr><td class='small'>{esc(info['path'])}</td>"
                     f"<td class='small'>{status}</td>"
                     f"<td class='small'>{count}{size}{mod}</td></tr>")
    table = ("<table style='width:100%;border-collapse:collapse'>"
             "<tr><th class='small' style='text-align:left'>File</th>"
             "<th class='small'>Saved</th>"
             "<th class='small' style='text-align:left'>Details</th></tr>"
             + "".join(rows) + "</table>")
    actions = [
        ("shortlist", t(lang, "data_clear_shortlist")),
        ("listen_later", t(lang, "data_clear_listen")),
        ("favorites", t(lang, "data_clear_favorites")),
        ("rejects", t(lang, "data_clear_rejects")),
        ("tag_cache", t(lang, "data_clear_cache")),
        ("generated", t(lang, "data_clear_generated")),
        ("imports", t(lang, "data_clear_imports")),
    ]
    buttons = "".join(
        f"<button type='button' class='pill' onclick=\"clearData('{a}')\">{esc(label)}</button> "
        for a, label in actions)
    body = f"""
<section class="card">
  <h1>{t(lang, 'data_title')}</h1>
  <p class="small">{t(lang, 'data_intro')}
     <a href="/classic?lang={esc(lang)}">← {t(lang, 'btn_go')}</a></p>
</section>
<section class="card">
  <h2>{t(lang, 'data_files')}</h2>
  {table}
</section>
<section class="card">
  <h2>{t(lang, 'data_actions')}</h2>
  <p><a class="pill" href="/data/backup">{t(lang, 'data_backup')}</a></p>
  <div class="link-row">{buttons}</div>
  <p style="margin-top:12px">
    <button type="button" class="pill" onclick="fullReset()">{t(lang, 'data_full_reset')}</button>
    <span id="dataMsg" class="small"></span>
  </p>
</section>
<script>
function _dpost(action, confirmed) {{
  fetch('/data/action', {{method:'POST', headers:{{'Content-Type':'application/json'}},
    body: JSON.stringify({{action: action, confirm: !!confirmed}})}})
    .then(r => r.json()).then(d => {{ if (d.ok) location.reload();
      else {{ const m=document.getElementById('dataMsg'); if(m) m.textContent = d.error || 'Error'; }} }})
    .catch(() => {{ const m=document.getElementById('dataMsg'); if(m) m.textContent='Error'; }});
}}
function clearData(action) {{ _dpost(action, false); }}
function fullReset() {{
  if (confirm({json.dumps(t(lang, 'data_full_reset_confirm'))})) _dpost('full_reset', true);
}}
</script>"""
    return page(t(lang, "data_title"), body, lang)


def _st_status(done, pending="not yet"):
    return ("<span class='pill' style='background:#e8f5e9'>✓ done</span>" if done
            else f"<span class='pill'>{esc(pending)}</span>")


def render_self_test_page(lang=DEFAULT_LANG):
    """Personal testing checklist with live-detected statuses. Owner-facing."""
    recs_done = (OUTPUTS / "local_recommendations.json").exists() or bool(LAST_RUN.get("recs"))
    hist_path = OUTPUTS / "local_input_history.json"
    manual_done = False
    if hist_path.exists():
        try:
            manual_done = json.loads(hist_path.read_text(encoding="utf-8")).get("source") in ("manual", "owner_demo")
        except Exception:
            manual_done = False
    lf_ready = False
    if _lastfm is not None:
        try:
            st = _lastfm.LastfmClient().config_status()
            lf_ready = st["api_key_present"] and st["username_present"]
        except Exception:
            lf_ready = False
    spotify_done = (OUTPUTS / "spotify_token.json").exists()
    feedback_done = any((OUTPUTS / f).exists() for f in
                        ("favorites.jsonl", "feedback.jsonl", "listen_later.jsonl", "rejects.jsonl"))
    report_done = (OUTPUTS / "music_dna_report.md").exists()

    cards = [
        ("1. Demo works",
         "On the home page keep <strong>Use demo library</strong> selected and press "
         "<strong>Generate recommendations</strong>.",
         "Safe Match / Adjacent Discovery / Wildcard groups appear with explanations.",
         _st_status(recs_done),
         "If nothing appears, run <code>python3 scripts/start_app.py --check</code> in a terminal."),
        ("2. Manual paste / owner demo works",
         "Pick <strong>Owner-style demo taste</strong> (60 dark/heavy tracks) or "
         "<strong>Manual favorite tracks</strong> and paste 20–50 lines like "
         "<em>Bell Witch — Mirror Reaper</em> or <em>Marrow by YOB</em>. Generate.",
         "Your Music DNA profile updates to match the pasted taste.",
         _st_status(manual_done),
         "One track per line. Formats: “Track — Artist”, “Track - Artist”, “Track by Artist”."),
        ("3. Last.fm configured",
         "Open <a href='/sources'>Sources &amp; accounts</a> → Last.fm: enter username + API key, "
         "press <strong>Save</strong>, then <strong>Test Last.fm connection</strong>.",
         "Status becomes Ready; test shows “Connected as … — recent tracks loaded”.",
         _st_status(lf_ready, "not configured (optional)"),
         "No key? Create one at last.fm/api/account/create. Missing key/username never crashes the app."),
        ("4. Spotify connected (optional)",
         "Open <a href='/sources'>Sources</a> → Spotify → Connect. Needs only a Client ID "
         "(PKCE — no client secret) and redirect URI http://127.0.0.1:8765/spotify/callback.",
         "Card shows Connected; read-only — playlists are never modified.",
         _st_status(spotify_done, "not connected (optional)"),
         "If not configured, the card shows friendly setup guidance instead of an error."),
        ("5. Recommendations generated",
         "Choose a preset (try <strong>Post-metal / Doom / Sludge</strong> or "
         "<strong>Night Drive</strong>), tune mood/task/novelty/strictness/exclusions, Generate.",
         "Each result explains why it matches and its risk (e.g. “may be too slow”).",
         _st_status(recs_done),
         "Few results in Strict mode? Try Balanced, paste more tracks, or enable Last.fm similar tracks."),
        ("6. Feedback saved",
         "On result cards press <strong>♥ Favorite</strong>, <strong>🕑 Listen later</strong>, "
         "<strong>✕ Never</strong>, or <strong>＋ Shortlist</strong> (plus 👍/👎 style feedback).",
         "Saved items appear on the <a href='/queue'>Queue</a> page and shape future runs.",
         _st_status(feedback_done),
         "Feedback is stored locally in outputs/*.jsonl — nothing is uploaded."),
        ("7. Report exported",
         "After a run, press <strong>Export Music DNA report</strong> (Markdown) or "
         "<strong>JSON</strong> in the export section.",
         "A readable Music DNA report downloads / lands in outputs/.",
         _st_status(report_done),
         "The report includes dominant genres, mood profile, novelty tolerance, and saved tracks."),
        ("8. Local data reset tested",
         "Open <a href='/data'>Local data</a>: export a backup, clear one list, then try "
         "<strong>Full reset personal data</strong> (it must ask for confirmation).",
         "After reset the app starts clean; .env, Spotify login, and code are kept.",
         "<span class='pill'>manual check</span>",
         "Full reset without confirmation is blocked by design."),
    ]
    sections = "".join(
        f"""<section class="card">
  <h2>{title} {status}</h2>
  <p class="small"><strong>What to click:</strong> {click}</p>
  <p class="small"><strong>Expected:</strong> {expected}</p>
  <p class="small" style="opacity:.75"><strong>Hint:</strong> {hint}</p>
</section>""" for title, click, expected, status, hint in cards)
    body = f"""
<section class="card">
  <h1>Self-Test — personal testing checklist</h1>
  <p class="small">Work top to bottom. Statuses update as you use the app.
     <a href="/classic?lang={esc(lang)}">← Home</a> · <a href="/sources">Sources</a> ·
     <a href="/queue">Queue</a> · <a href="/data">Local data</a></p>
  <p class="small">Full 3-day plan: see <strong>SELF_TEST_PLAN.md</strong> in the project folder.</p>
</section>{sections}"""
    return page("Self-Test", body, lang)


def render_sources_page(lang=DEFAULT_LANG):
    lf_status = None
    if _lastfm is not None:
        try:
            lf_status = _lastfm.LastfmClient().config_status()
        except Exception:
            lf_status = None
    if lf_status is None:
        lf_state = t(lang, "src_state_unavailable")
    elif not lf_status["api_key_present"]:
        lf_state = t(lang, "lastfm_state_nokey")
    elif not lf_status["username_present"]:
        lf_state = t(lang, "lastfm_state_nouser")
    else:
        lf_state = t(lang, "lastfm_state_ready")
    lf = _local_config.get_lastfm() if _local_config else {}
    lf_user = esc(lf.get("username", "") or os.environ.get("LASTFM_USERNAME", "") or "")
    has_key = bool(lf.get("api_key") or os.environ.get("LASTFM_API_KEY", "").strip())
    key_ph = t(lang, "lastfm_key_set") if has_key else t(lang, "lastfm_key_ph")
    spotify_block = render_spotify_source_block(lang) if spotify_connector is not None else \
        f"<div class='source-option' style='cursor:default'><span>🎧</span><span><strong>Spotify</strong><br><span class='small'>{t(lang, 'spotify_not_configured')}</span></span></div>"
    ready = t(lang, "src_state_ready")
    body = f"""
<section class="card">
  <h1>{t(lang, 'sources_title')}</h1>
  <p class="small">{t(lang, 'sources_intro')} <a href="/classic?lang={esc(lang)}">← {t(lang, 'btn_go')}</a></p>
</section>
<section class="card">
  <h2>{t(lang, 'sources_ready_now')}</h2>
  <ul class="small">
    <li><strong>{t(lang, 'src_demo')}</strong> — {ready}</li>
    <li><strong>{t(lang, 'src_manual')}</strong> — {ready}</li>
    <li><strong>{t(lang, 'src_file')}</strong> — {ready}</li>
  </ul>
</section>
<section class="card">
  <h2>{t(lang, 'src_lastfm')} — <span class="small">{esc(lf_state)}</span></h2>
  <p class="small">{t(lang, 'lastfm_card_help')}</p>
  <label class="small">{t(lang, 'lastfm_username_label')}</label>
  <input type="text" id="lfUser" value="{lf_user}" placeholder="your_lastfm_name" autocomplete="off">
  <label class="small">{t(lang, 'lastfm_key_label')}</label>
  <input type="password" id="lfKey" placeholder="{esc(key_ph)}" autocomplete="off">
  <div class="link-row" style="margin-top:10px">
    <button type="button" onclick="lfSave()">{t(lang, 'lastfm_save')}</button>
    <button type="button" class="pill" onclick="lfTest()">{t(lang, 'lastfm_test')}</button>
    <button type="button" class="pill" onclick="lfClear()">{t(lang, 'lastfm_clear')}</button>
    <span id="lfMsg" class="small"></span>
  </div>
  <p class="small" style="margin-top:8px">{t(lang, 'lastfm_key_where')}</p>
</section>
<section class="card">
  <h2>Spotify</h2>
  {spotify_block}
  <p class="small">{t(lang, 'spotify_pkce_note')}</p>
</section>
<section class="card">
  <h2>{t(lang, 'sources_import_future')}</h2>
  <ul class="small">
    <li><strong>YouTube Music</strong> — {t(lang, 'src_youtube_importonly')}</li>
    <li><strong>Apple Music / Deezer / TIDAL / SoundCloud / Bandcamp / Yandex Music / Amazon Music / Qobuz / Pandora</strong> — CSV/JSON export import available now; live account connectors are future / planned. YouTube Music remains import only.</li>
  </ul>
</section>
<script>
function _lf(url, payload, done) {{
  fetch(url, {{method:'POST', headers:{{'Content-Type':'application/json'}},
    body: JSON.stringify(payload||{{}})}}).then(r => r.json()).then(done)
    .catch(() => {{ document.getElementById('lfMsg').textContent = 'Error'; }});
}}
function lfSave() {{
  _lf('/lastfm/save', {{username: document.getElementById('lfUser').value,
       api_key: document.getElementById('lfKey').value}},
      d => {{ document.getElementById('lfMsg').textContent = d.message || (d.ok?'Saved':'Error');
        if (d.ok) setTimeout(()=>location.reload(), 600); }});
}}
function lfTest() {{
  document.getElementById('lfMsg').textContent = 'Testing…';
  _lf('/lastfm/test', {{}}, d => {{ document.getElementById('lfMsg').textContent = d.message || (d.ok?'OK':'Failed'); }});
}}
function lfClear() {{
  _lf('/lastfm/clear', {{}}, d => {{ document.getElementById('lfMsg').textContent = d.message || 'Cleared';
    setTimeout(()=>location.reload(), 500); }});
}}
</script>"""
    return page(t(lang, "sources_title"), body, lang)


def render_queue_page(lang=DEFAULT_LANG):
    if _personal is None or STORE is None:
        return page("Queue", "<section class='card'><p>Personal store unavailable.</p></section>", lang)
    sections = []
    total_saved = 0
    for kind, key in (("favorites", "queue_favorites"), ("listen_later", "queue_listen_later"),
                      ("shortlist", "queue_shortlist"), ("rejects", "queue_rejects")):
        recs = STORE.list_records(kind)
        total_saved += len(recs)
        if recs:
            rows = "".join(
                f"<li class='small'>{esc(r.get('artist', '?'))} — {esc(r.get('track_title', '?'))}"
                f"{(' · ' + esc(', '.join(r.get('genres', [])[:3]))) if r.get('genres') else ''}</li>"
                for r in recs[-100:])
            body_list = f"<ul>{rows}</ul>"
        else:
            body_list = f"<p class='small'>{t(lang, 'queue_empty')}</p>"
        export = (f" · <a href='/export/shortlist.csv'>CSV</a>"
                  f" · <a href='/export/shortlist.txt'>TXT</a>") if kind == "shortlist" else ""
        sections.append(f"<section class='card'><h2>{t(lang, key)}{export}</h2>{body_list}</section>")
    empty_hint = (f"<p class='small'>{t(lang, 'queue_all_empty')}</p>" if total_saved == 0 else "")
    body = (f"<section class='card'><h1>{t(lang, 'queue_title')}</h1>"
            f"<p class='small'><a href='/?lang={esc(lang)}'>← {t(lang, 'btn_go')}</a> · "
            f"<a href='/export/dna-report'>{t(lang, 'exp_dna')}</a></p>{empty_hint}</section>"
            + "".join(sections))
    return page(t(lang, "queue_title"), body, lang)


def render_personal_memory_card_noop():
    return ""


def render_next_action(recs, lang):
    if _suggest_next_action is None:
        return ""
    params = recs.get("parameters", {})
    pm = params.get("profile_quality") and STORE.personal_memory() if STORE else {}
    try:
        s = _suggest_next_action(LAST_RUN.get("profile"), recs, pm or {},
                                 params.get("candidate_pool") or {})
    except Exception:
        return ""
    return (f"<p class='pill'>→ {esc(s['label'])}</p>"
            f"<p class='small'>{esc(s['explanation'])}</p>")


def render_reroll_controls(lang):
    if not LAST_RUN.get("rerun"):
        return ""
    btn = lambda mode, label: (f"<a class='pill' href='/reroll?mode={mode}&lang={esc(lang)}'>"
                               f"{esc(label)}</a>")
    return (
        "<section class='card'>"
        f"<h2>{t(lang, 'reroll_title')}</h2>"
        "<div class='link-row'>"
        + btn("safer", t(lang, "reroll_safer"))
        + btn("adventurous", t(lang, "reroll_adventurous"))
        + btn("narrow", t(lang, "reroll_narrow"))
        + btn("broaden", t(lang, "reroll_broaden"))
        + "</div></section>")


def render_pool_status(params, lang):
    """Compact candidate-pool status line + warnings for the results page."""
    pool = params.get("candidate_pool") or {}
    size = pool.get("size", params.get("candidate_pool_size"))
    if size is None:
        return ""
    sources = ", ".join(pool.get("sources_used") or ["local_catalog"])
    after = params.get("candidates_after_genre_filter")
    warnings = list(pool.get("warnings", []))
    line = f"{t(lang, 'pool_label')}: {size} ({sources})"
    if isinstance(after, int) and after != size:
        line += f" → {after} after genre filter"
    out = [f"<span class='pill'>{esc(line)}</span>"]
    if "small_pool" in warnings or (isinstance(after, int) and 0 < after < 5):
        out.append(f"<p class='small warn'>{t(lang, 'pool_small')}</p>")
    if "sparse_genres" in warnings:
        out.append(f"<p class='small warn'>{t(lang, 'pool_sparse')}</p>")
    return "".join(out)


def render_coverage(coverage, lang, enrich_stats=None):
    """Per-source contribution, totals and an honest confidence level."""
    if not coverage:
        return ""
    level = coverage.get("confidence_level", "Medium")
    level_label = t(lang, f"conf_{level}")
    bars = []
    for source, pct in coverage.get("contribution_percent", {}).items():
        label = coverage.get("source_labels", {}).get(source, source)
        bars.append(f"<p class='small' style='margin:0'><strong>{esc(label)}</strong> · {pct}%</p>"
                    f"<div class='bar'><i style='width:{min(100, max(2, pct))}%'></i></div>")
    reasons = [t(lang, REASON_KEYS[r]) if r in REASON_KEYS else r
               for r in coverage.get("confidence_reasons", [])] or [t(lang, "reason_generic")]
    note = ""
    if level in ("Medium", "Low"):
        note = f"<p class='small notice' style='padding:10px;border-radius:10px'>{esc(t(lang, 'conf_note', level=level_label, reasons=', '.join(reasons)))}</p>"
    enrich = ""
    if enrich_stats is not None:
        if enrich_stats.get("missing"):
            enrich = "<p class='small'>🏷️ " + esc(t(lang, "enrich_note", filled=enrich_stats["filled"],
                     missing=enrich_stats["missing"],
                     offline=enrich_stats["same_artist"] + enrich_stats["offline_map"],
                     lastfm=enrich_stats["lastfm_tags"])) + "</p>"
        else:
            enrich = f"<p class='small'>🏷️ {esc(t(lang, 'enrich_none'))}</p>"
    return f"""
<section class="card" id="coverage">
  <h2>{t(lang, 'cov_title')}</h2>
  {''.join(bars)}
  <p class="small">{t(lang, 'cov_tracks')}: <strong>{coverage.get('total_tracks')}</strong> · {t(lang, 'cov_events')}: <strong>{coverage.get('total_listening_events')}</strong> · {t(lang, 'cov_artists')}: <strong>{coverage.get('unique_artists')}</strong> · {t(lang, 'cov_genres')}: <strong>{coverage.get('unique_genres')}</strong></p>
  <p><strong>{t(lang, 'cov_confidence')}:</strong> <span class="pill">{esc(level_label)}</span></p>
  {note}
  {enrich}
</section>"""


def render_portable_dna(lang):
    if export_portable_dna is None:
        return ""
    return f"""
<section class="card" id="portable-dna">
  <h2>{t(lang, 'dna_title')}</h2>
  <p class="small">{t(lang, 'dna_note')}</p>
  <div class="link-row">
    <a href="/export/dna-card?lang={esc(lang)}" target="_blank" rel="noopener"><strong>{t(lang, 'dna_card')}</strong></a>
    <a href="/export/dna-json" download>{t(lang, 'dna_json')}</a>
    <a href="/export/dna-md" download>{t(lang, 'dna_md')}</a>
    <a href="/export/dna-prompt" download>{t(lang, 'dna_prompt')}</a>
  </div>
  <p class="small">{t(lang, 'dna_card_note')}</p>
</section>"""


def render_results(profile, recs, source_label, prompt, catalog_note, lang,
                   coverage=None, enrich_stats=None):
    params = recs.get("parameters", {})
    context = {
        "mood": params.get("mood_score"),
        "task": params.get("task"),
        "experimentality": params.get("novelty_level"),
        "source": source_label,
    }
    feedback_note = ""
    if params.get("feedback_records_used"):
        feedback_note = "<span class='pill'>" + esc(t(
            lang, "feedback_applied",
            n=params["feedback_records_used"],
            shift=f"{params.get('feedback_novelty_shift', 0):+.2f}",
        )) + "</span>"

    ai_block = ""
    if ollama_enhance is not None:
        ai_block = f"""
<section class="card">
  <h2>{t(lang, 'ai_title')}</h2>
  <p class="small">{t(lang, 'ai_note')}</p>
  <button type="button" id="aiBtn" onclick="enhanceAI()">{t(lang, 'ai_btn')}</button>
  <p class="small hidden" id="aiWait">{t(lang, 'ai_wait')}</p>
  <div class="card hidden" id="aiOut" style="box-shadow:none"></div>
</section>"""

    body = render_profile(profile, source_label, recs, lang)
    body += render_coverage(coverage, lang, enrich_stats)
    body += f"""
<section class="card">
  <h2>{t(lang, 'res_recs')}</h2>
  <p>{t(lang, 'res_recs_note')}</p>
  <p class="small">{t(lang, 'res_feedback_note')}</p>
  <p class="small">{esc(catalog_note)} {feedback_note}</p>
  <p>{render_pool_status(params, lang)}</p>
</section>
{render_recommendation_groups(recs, context, lang)}
{render_reroll_controls(lang)}
<section class="card">
  <h2>{t(lang, 'next_action_title')}</h2>
  {render_next_action(recs, lang)}
</section>
{render_profile_quality(params, lang)}
{render_personal_memory_card(lang)}
<section class="card">
  <h2>{t(lang, 'exp_title')}</h2>
  <div class="link-row">
    <a href="/export/markdown" download>{t(lang, 'exp_md')}</a>
    <a href="/export/json" download>{t(lang, 'exp_json')}</a>
    <a href="/export/dna-report" download>{t(lang, 'exp_dna')}</a>
    <a href="/queue">{t(lang, 'nav_queue')}</a>
    <button type="button" class="mini" id="copyBtn" onclick="copyPrompt()">{t(lang, 'exp_prompt')}</button>
  </div>
  <p class="small">{t(lang, 'exp_note')}</p>
</section>
{render_portable_dna(lang)}
{ai_block}
<section class="card">
  <h2>{t(lang, 'prompt_title')}</h2>
  <p class="small">{t(lang, 'prompt_note')}</p>
  <textarea readonly id="promptBox">{esc(prompt[:6000])}</textarea>
  <p><a href="/classic?lang={esc(lang)}">{t(lang, 'run_again')}</a></p>
</section>
<script>
const LANG = {json.dumps(lang)};
function sendFeedback(btn) {{
  const rec = JSON.parse(btn.dataset.rec);
  rec.action = btn.dataset.action;
  btn.disabled = true;
  fetch('/feedback', {{method:'POST', headers:{{'Content-Type':'application/json'}}, body: JSON.stringify(rec)}})
    .then(r => {{ if (!r.ok) throw new Error(r.status);
      btn.classList.add('done'); btn.textContent = FB_SAVED; }})
    .catch(() => {{ btn.disabled = false; btn.textContent = FB_FAILED; }});
}}
const FB_SAVED = {json.dumps(t(lang, 'fb_saved'))};
const FB_FAILED = {json.dumps(t(lang, 'fb_failed'))};
function copyPrompt() {{
  const box = document.getElementById('promptBox');
  box.select();
  (navigator.clipboard ? navigator.clipboard.writeText(box.value) : Promise.reject())
    .catch(() => document.execCommand('copy'));
  document.getElementById('copyBtn').textContent = {json.dumps(t(lang, 'exp_prompt_done'))};
}}
function enhanceAI() {{
  const btn = document.getElementById('aiBtn');
  const wait = document.getElementById('aiWait');
  const out = document.getElementById('aiOut');
  btn.disabled = true; wait.classList.remove('hidden');
  fetch('/enhance', {{method:'POST', headers:{{'Content-Type':'application/json'}}, body: JSON.stringify({{lang: LANG}})}})
    .then(r => r.json())
    .then(data => {{
      wait.classList.add('hidden');
      out.classList.remove('hidden');
      out.textContent = data.text || data.error || '';
      if (data.error) {{ out.classList.add('notice'); btn.disabled = false; }}
    }})
    .catch(err => {{ wait.classList.add('hidden'); out.classList.remove('hidden'); out.textContent = String(err); btn.disabled = false; }});
}}
</script>
"""
    return page(t(lang, "res_title"), body, lang)


def render_error(exc, lang=DEFAULT_LANG):
    body = f"""
{lang_bar(lang)}
<section class="card error">
  <h2>{t(lang, 'err_title')}</h2>
  <p>{esc(exc)}</p>
  <p class="small">{t(lang, 'err_hint')}</p>
  <p><a href="/classic?lang={esc(lang)}">{t(lang, 'back')}</a></p>
</section>
"""
    return page(t(lang, "err_title"), body, lang)


# ---------------------------------------------------------------------------
# HTTP handler
# ---------------------------------------------------------------------------

CURRENT_PORT = [PORT]  # mutable so start_app.py / main() can record the real port

LAST_RUN = {"profile": None, "recs": None, "source_label": "", "prompt": ""}


class Handler(BaseHTTPRequestHandler):
    server_version = "MusicTasteRecommender/4.0-RC"

    # -- helpers -------------------------------------------------------------

    def query(self):
        return parse_qs(urlsplit(self.path).query)

    def lang(self, qs=None):
        qs = qs if qs is not None else self.query()
        cookie = self.headers.get("Cookie", "")
        cookie_lang = ""
        for chunk in cookie.split(";"):
            name, _, value = chunk.strip().partition("=")
            if name == "lang":
                cookie_lang = value
        return pick_lang((qs.get("lang", [""]) or [""])[0], cookie_lang)

    def respond(self, payload, status=200, content_type="text/html; charset=utf-8", lang=None):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        if lang:
            self.send_header("Set-Cookie", f"lang={lang}; Path=/; Max-Age=31536000; SameSite=Lax")
        self.end_headers()
        self.wfile.write(payload)

    def respond_json(self, obj, status=200):
        self.respond(json.dumps(obj, ensure_ascii=False).encode("utf-8"),
                     status=status, content_type="application/json; charset=utf-8")

    def redirect(self, location):
        self.send_response(302)
        self.send_header("Location", location)
        self.end_headers()

    def send_file(self, path, content_type, download_name):
        if not path.exists():
            self.respond(render_error("Nothing to export yet — generate recommendations first.",
                                      self.lang()), status=404)
            return
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Disposition", f'attachment; filename="{download_name}"')
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_text(self, text, content_type, download_name):
        data = text.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Disposition", f'attachment; filename="{download_name}"')
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def dna_card(self, lang):
        """Shareable Music DNA Card (self-contained HTML) from the latest profile."""
        profile_path = OUTPUTS / "local_taste_profile.json"
        if not profile_path.exists():
            return self.respond(render_error(t(lang, "err_no_profile_yet"), lang), status=404)
        try:
            import export_dna_card
            profile = json.loads(profile_path.read_text(encoding="utf-8"))
            coverage = None
            cov_path = OUTPUTS / "source_coverage.json"
            if cov_path.exists():
                try:
                    coverage = json.loads(cov_path.read_text(encoding="utf-8"))
                except (OSError, json.JSONDecodeError):
                    coverage = None
            html_text = export_dna_card.build_card(profile, coverage=coverage, lang=lang)
            (OUTPUTS / "music_dna_card.html").write_text(html_text, encoding="utf-8")
        except Exception as exc:  # the card must never break the app
            return self.respond(render_error(f"DNA card: {exc}", lang), status=500)
        return self.respond(html_text.encode("utf-8"), lang=lang)

    def export_dna_report(self, lang):
        if _dna_report is None:
            return self.respond(render_error("Report module unavailable.", lang), status=404)
        profile = LAST_RUN.get("profile") or {}
        recs = LAST_RUN.get("recs") or {}
        source_label = LAST_RUN.get("source_label", "")
        branding = os.environ.get("REPORT_BRANDING_NAME", "").strip() or None
        try:
            md = _dna_report.build_report(profile, recs, STORE, source_label, branding)
        except Exception as exc:
            return self.respond(render_error(f"Could not build report: {exc}", lang), status=500)
        self._send_text(md, "text/markdown; charset=utf-8", "music_dna_report.md")

    def export_shortlist(self, fmt):
        if _personal is None or STORE is None:
            return self.respond(render_error("Personal store unavailable.", self.lang()), status=404)
        recs = STORE.list_records("shortlist")
        if fmt == "csv":
            rows = ["artist,track_title,genres,source_url"]
            for r in recs:
                g = "; ".join(r.get("genres", []) or [])
                rows.append(",".join('"' + str(x).replace('"', '""') + '"'
                                     for x in (r.get("artist", ""), r.get("track_title", ""),
                                               g, r.get("source_url", "") or "")))
            self._send_text("\n".join(rows), "text/csv; charset=utf-8", "shortlist.csv")
        else:
            lines = [f"{r.get('artist', '?')} — {r.get('track_title', '?')}" for r in recs]
            self._send_text("\n".join(lines) or "(empty)", "text/plain; charset=utf-8", "shortlist.txt")

    # -- 3.0 web app + API ----------------------------------------------------

    def serve_web(self, rel):
        """Static files for the 3.0 app. Only files inside web/ are served."""
        target = (WEB / rel).resolve()
        if WEB.resolve() not in target.parents and target != WEB.resolve() or not target.is_file():
            return self.respond(b"Not found", status=404, content_type="text/plain; charset=utf-8")
        data = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", WEB_TYPES.get(target.suffix, "application/octet-stream"))
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        if target.suffix == ".html":
            self.send_header("Content-Security-Policy",
                             "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; "
                             "connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
            self.send_header("Referrer-Policy", "no-referrer")
        self.end_headers()
        self.wfile.write(data)

    def handle_v3(self, method):
        if dna3_api is None:
            return self.respond_json({"ok": False, "error": {"code": "INTERNAL", "title": "Unavailable",
                                                             "message": "The 3.0 app module could not be loaded."}}, status=500)
        store = Dna3Store(OUTPUTS)
        body, form = b"", None
        if method == "POST":
            try:
                if self.headers.get("Content-Type", "").startswith("multipart/form-data"):
                    if self.headers.get(dna3_api.CLIENT_HEADER) != "3":
                        return self.respond_json({"ok": False, "error": {"code": "FORBIDDEN", "title": "Blocked",
                                                  "message": "Requests must come from the Music DNA app."}}, status=403)
                    form = parse_post_fields(self)
                else:
                    body = _read_limited_body(self, MAX_JSON_BODY_BYTES)
            except RequestTooLargeError as exc:
                return self.respond_json({"ok": False, "error": {"code": "PAYLOAD_TOO_LARGE", "title": "File too large",
                                          "message": "That file is larger than this app accepts.", "detail": str(exc)}}, status=413)
        resp = dna3_api.dispatch(store, method, self.path, self.headers, body, form)
        self.send_response(resp.status)
        self.send_header("Content-Type", resp.content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        for k, v in resp.headers.items():
            self.send_header(k, v)
        if resp.stream is not None:
            self.send_header("Connection", "close")
            self.end_headers()
            for chunk in resp.stream:
                self.wfile.write(chunk)
                self.wfile.flush()
            return
        self.send_header("Content-Length", str(len(resp.body or b"")))
        self.end_headers()
        self.wfile.write(resp.body or b"")

    def do_GET(self):
        parsed = urlsplit(self.path)
        qs = parse_qs(parsed.query)
        if parsed.path.startswith("/api/v3/"):
            return self.handle_v3("GET")
        if parsed.path in ("/", "/index.html"):
            return self.serve_web("index.html")
        if parsed.path.startswith("/assets/"):
            return self.serve_web(parsed.path.lstrip("/"))
        lang = self.lang(qs)
        if parsed.path == "/spotify/login":
            return self.spotify_login(qs, lang)
        if parsed.path == "/spotify/callback":
            return self.spotify_callback(qs)
        if parsed.path == "/spotify/disconnect":
            return self.spotify_disconnect(lang)
        if parsed.path == "/export/markdown":
            return self.send_file(OUTPUTS / "recommendations_export.md",
                                  "text/markdown; charset=utf-8", "recommendations.md")
        if parsed.path == "/export/json":
            return self.send_file(OUTPUTS / "recommendations_export.json",
                                  "application/json; charset=utf-8", "recommendations.json")
        if parsed.path == "/export/dna-json":
            return self.send_file(OUTPUTS / "portable_music_dna.json",
                                  "application/json; charset=utf-8", "portable_music_dna.json")
        if parsed.path == "/export/dna-md":
            return self.send_file(OUTPUTS / "portable_music_dna.md",
                                  "text/markdown; charset=utf-8", "portable_music_dna.md")
        if parsed.path == "/export/dna-prompt":
            return self.send_file(OUTPUTS / "portable_music_dna_prompt.md",
                                  "text/markdown; charset=utf-8", "portable_music_dna_prompt.md")
        if parsed.path == "/export/dna-card":
            return self.dna_card(lang)
        if parsed.path == "/health":
            return self.respond_json({"ok": True, "port": CURRENT_PORT[0]})
        if parsed.path == "/queue":
            return self.respond(render_queue_page(lang), lang=lang)
        if parsed.path == "/data":
            return self.respond(render_data_page(lang), lang=lang)
        if parsed.path == "/sources":
            return self.respond(render_sources_page(lang), lang=lang)
        if parsed.path == "/self-test":
            return self.respond(render_self_test_page(lang), lang=lang)
        if parsed.path == "/data/backup":
            return self.data_backup(lang)
        if parsed.path == "/reroll":
            return self.handle_reroll(qs.get("mode", ["safer"])[0], lang)
        if parsed.path == "/export/dna-report":
            return self.export_dna_report(lang)
        if parsed.path == "/export/shortlist.csv":
            return self.export_shortlist("csv")
        if parsed.path == "/export/shortlist.txt":
            return self.export_shortlist("txt")
        if parsed.path not in ("/classic", "/classic/"):
            return self.respond(render_error("Page not found.", lang), status=404, lang=lang)
        message = ""
        if qs.get("spotify") == ["connected"]:
            message = t(lang, "spotify_msg_connected")
        elif qs.get("spotify") == ["disconnected"]:
            message = t(lang, "spotify_msg_disconnected")
        self.respond(render_home(lang, esc(message)), lang=lang)

    # -- Spotify OAuth (V2) ----------------------------------------------------

    def spotify_login(self, qs, lang):
        if spotify_connector is None:
            return self.respond(render_error("Spotify connector module could not be loaded.", lang))
        try:
            client_id, redirect_uri = spotify_connector.load_config()
        except Exception as exc:
            return self.respond(render_error(exc, lang))
        expected_port = SPOTIFY.redirect_port()
        if expected_port and expected_port != CURRENT_PORT[0]:
            return self.respond(render_error(
                t(lang, "spotify_port_warning", port=CURRENT_PORT[0], expected=expected_port), lang))
        remember = qs.get("remember", ["0"])[0] == "1"
        verifier, challenge = spotify_connector.generate_pkce_pair()
        state = secrets.token_urlsafe(24)
        SPOTIFY.pending[state] = (verifier, remember, lang, qs.get("next", [""])[0] == "v3")
        self.redirect(spotify_connector.build_authorize_url(client_id, redirect_uri, challenge, state))

    def spotify_callback(self, qs):
        state = qs.get("state", [""])[0]
        pending = SPOTIFY.pending.pop(state, None)
        if pending is None:
            SPOTIFY.last_error = "OAuth state mismatch. Try connecting again."
            return self.redirect("/#/sources?spotify=failed")
        verifier, remember, lang, v3 = (tuple(pending) + (False,))[:4]
        home = "/" if v3 else "/classic"
        if "error" in qs:
            SPOTIFY.last_error = f"Spotify authorization failed: {qs['error'][0]}"
            return self.redirect("/#/sources?spotify=failed" if v3 else f"/classic?lang={lang}")
        try:
            client_id, redirect_uri = spotify_connector.load_config()
            session = spotify_connector.SpotifySession(client_id, redirect_uri, remember=remember)
            session.exchange_code(qs.get("code", [""])[0], verifier)
            session.fetch_profile()
            session.save()
            SPOTIFY.session = session
            SPOTIFY.last_error = ""
            return self.redirect("/#/sources?spotify=connected" if v3 else f"/classic?lang={lang}&spotify=connected")
        except Exception as exc:
            SPOTIFY.last_error = str(exc)
            return self.redirect("/#/sources?spotify=failed" if v3 else f"{home}?lang={lang}")

    def spotify_disconnect(self, lang):
        SPOTIFY.session = None
        SPOTIFY.last_error = ""
        if spotify_connector is not None:
            spotify_connector.SpotifySession.delete_saved()
        self.redirect(f"/classic?lang={lang}&spotify=disconnected")

    # -- POST ----------------------------------------------------------------

    def do_POST(self):
        parsed = urlsplit(self.path)
        if parsed.path.startswith("/api/v3/"):
            return self.handle_v3("POST")
        if parsed.path == "/feedback":
            return self.handle_feedback()
        if parsed.path == "/enhance":
            return self.handle_enhance()
        if parsed.path == "/preset/save":
            return self.handle_preset_save()
        if parsed.path == "/preset/delete":
            return self.handle_preset_delete()
        if parsed.path == "/preset/reset":
            return self.handle_preset_reset()
        if parsed.path == "/data/action":
            return self.handle_data_action()
        if parsed.path == "/lastfm/save":
            return self.handle_lastfm_save()
        if parsed.path == "/lastfm/test":
            return self.handle_lastfm_test()
        if parsed.path == "/lastfm/clear":
            return self.handle_lastfm_clear()
        return self.handle_recommend()

    def handle_recommend(self):
        lang = DEFAULT_LANG
        try:
            fields = parse_post_fields(self)
            lang = pick_lang(read_field(fields, "lang", ""), self.lang())
            history_path, source_label, history, wants_candidates = prepare_history(fields, lang)
            mood = float(read_field(fields, "mood", "1"))
            task = read_field(fields, "task", "night_drive")
            novelty = int(read_field(fields, "novelty", "3"))
            max_items = max(3, min(24, int(read_field(fields, "max", "9"))))
            if not (-2 <= mood <= 2) or not (1 <= novelty <= 5):
                raise UserInputError("Mood must be -2..+2 and experimentality 1..5.")
            enrich_stats = None
            if enrich_genres is not None and read_field(fields, "enrich_genres", "") == "1":
                try:
                    client = enrich_genres.maybe_lastfm_client()
                    history, enrich_stats = enrich_genres.enrich_history(history, lastfm_client=client)
                    if enrich_stats["filled"]:
                        history_path = OUTPUTS / "local_enriched_history.json"
                        history_path.write_text(json.dumps(history, indent=2, ensure_ascii=False),
                                                encoding="utf-8")
                except Exception:
                    enrich_stats = None
            genre_constraints = {
                "genre_families": read_field(fields, "genre_families", "").strip(),
                "genre_subgenres": read_field(fields, "genre_subgenres", "").strip(),
                "genre_microgenres": read_field(fields, "genre_microgenres", "").strip(),
                "exclude_genres": read_field(fields, "exclude_genres", "").strip(),
                "strictness": read_field(fields, "strictness", "").strip(),
                "discovery": read_field(fields, "discovery", "").strip(),
                "prefer_ukrainian": bool(read_field(fields, "prefer_ukrainian", "")),
                "prefer_instrumental": bool(read_field(fields, "prefer_instrumental", "")),
                "prefer_vocal": bool(read_field(fields, "prefer_vocal", "")),
                "prefer_obscure": bool(read_field(fields, "prefer_obscure", "")),
                "prefer_popular": bool(read_field(fields, "prefer_popular", "")),
            }
            catalog_path, catalog_note, catalog_source = resolve_catalog(history, wants_candidates, lang)
            # Candidate engine MVP: build a pool from the resolved catalog, drop
            # already-known tracks, and use it for scoring. Falls back safely.
            pool_summary = None
            effective_catalog = catalog_path
            if _candidate_engine is not None:
                try:
                    tax = _load_taxonomy() if _load_taxonomy else None
                    sources = [{"name": catalog_source,
                                "provider": _candidate_engine.make_local_provider(catalog_path)}]
                    request = {"include_familiar": False}
                    if read_field(fields, "use_lastfm_candidates", "") == "1" and _lastfm is not None:
                        lf_user = read_field(fields, "lastfm_username", "").strip() or None
                        client = _lastfm.LastfmClient(username=lf_user)
                        if client.config_status().get("ready") and (lf_user or client.username):
                            sources.append({"name": "lastfm_similar",
                                            "provider": _candidate_engine.make_lastfm_similar_provider(client=client)})
                            request["use_lastfm_candidates"] = True
                    pool = _candidate_engine.build_candidate_pool(
                        profile=None, history=history, request=request,
                        enabled_sources=sources, taxonomy=tax)
                    if pool["candidates"]:
                        pool_path = OUTPUTS / "local_candidate_pool.json"
                        _candidate_engine.write_pool_catalog(pool, pool_path)
                        effective_catalog = pool_path
                        pool_summary = pool["summary"]
                except Exception:
                    effective_catalog = catalog_path
            personal_memory_path = None
            if _personal is not None and STORE is not None:
                try:
                    mem = STORE.personal_memory(feedback_path=OUTPUTS / "feedback.jsonl")
                    if (mem["favorites_count"] or mem["rejects_count"]
                            or mem["boosted_genres"] or mem["reduced_genres"]):
                        personal_memory_path = OUTPUTS / "local_personal_memory.json"
                        personal_memory_path.write_text(json.dumps(mem, ensure_ascii=False),
                                                        encoding="utf-8")
                except Exception:
                    personal_memory_path = None
            profile, recs, prompt = run_pipeline(history_path, mood, task, novelty, max_items,
                                                 effective_catalog, lang, genre_constraints=genre_constraints,
                                                 personal_memory_path=personal_memory_path)
            if pool_summary is not None:
                recs.setdefault("parameters", {})["candidate_pool"] = pool_summary
            try:
                pq = compute_profile_quality(history, profile, recs, source_label, pool_summary)
                recs.setdefault("parameters", {})["profile_quality"] = pq
                recs["parameters"]["sources_used"] = pq["sources_used"]
            except Exception:
                pass
            pqx = recs.get("parameters", {}).get("profile_quality")
            if pqx:
                prompt = prompt + (
                    "\n\n---\nProfile quality: %s. Sources: %s. "
                    "%d tracks, %d genres, candidate pool %d." % (
                        pqx["confidence"], ", ".join(pqx["sources_used"]),
                        pqx["tracks_analyzed"], pqx["detected_genres"],
                        pqx["candidate_pool_size"]))
            LAST_RUN.update(profile=profile, recs=recs, source_label=source_label, prompt=prompt)
            LAST_RUN["rerun"] = {
                "history_path": str(history_path), "source_label": source_label,
                "mood": mood, "task": task, "novelty": novelty, "max_items": max_items,
                "catalog_path": str(effective_catalog),
                "personal_memory_path": str(personal_memory_path) if personal_memory_path else None,
                "genre_constraints": genre_constraints, "lang": lang,
            }
            write_exports(profile, recs, source_label)
            coverage = None
            if source_common is not None:
                try:
                    coverage = source_common.write_coverage(history)
                except Exception:
                    coverage = None
            if export_portable_dna is not None:
                try:
                    export_portable_dna.export_portable(
                        OUTPUTS / "local_taste_profile.json", OUTPUTS / "source_coverage.json",
                        OUTPUTS / "local_recommendations.json", OUTPUTS / "feedback.jsonl")
                except Exception:
                    pass
            LAST_RUN["coverage"] = coverage
            LAST_RUN["enrich_stats"] = enrich_stats
            self.respond(render_results(profile, recs, source_label, prompt, catalog_note, lang,
                                        coverage=coverage, enrich_stats=enrich_stats), lang=lang)
        except RequestTooLargeError:
            self.respond(render_error(t(lang, "err_too_large"), lang), status=413)
        except UserInputError as exc:
            self.respond(render_error(exc, lang))
        except Exception as exc:  # unexpected: still show a clean page
            self.respond(render_error(f"{type(exc).__name__}: {exc}", lang))

    def handle_reroll(self, mode, lang):
        state = LAST_RUN.get("rerun")
        if not state:
            return self.respond(render_error(t(lang, "reroll_none"), lang), status=400)
        mode = mode if mode in ("safer", "adventurous", "narrow", "broaden") else "safer"
        novelty = int(state.get("novelty", 3))
        gc = dict(state.get("genre_constraints") or {})
        strictness = gc.get("strictness", "balanced")
        discovery = gc.get("discovery", "adjacent")
        if mode == "safer":
            novelty = max(1, novelty - 1)
        elif mode == "adventurous":
            novelty = min(5, novelty + 1)
            if strictness != "strict" and discovery == "adjacent":
                discovery = "cross_genre"
        elif mode == "narrow":
            strictness = {"balanced": "strict", "soft": "balanced"}.get(strictness, strictness)
            if discovery == "adjacent":
                discovery = "inside"
        elif mode == "broaden":
            strictness = {"strict": "balanced", "balanced": "soft"}.get(strictness, strictness)
            if discovery == "inside":
                discovery = "adjacent"
        if gc:
            gc["strictness"] = strictness
            gc["discovery"] = discovery
        source_label = state.get("source_label", "")
        try:
            profile, recs, prompt = run_pipeline(
                Path(state["history_path"]),
                int(state.get("mood", 0)), state.get("task", ""),
                novelty, int(state.get("max_items", 12)),
                Path(state["catalog_path"]) if state.get("catalog_path") else None,
                lang, genre_constraints=(gc or None),
                personal_memory_path=(Path(state["personal_memory_path"])
                                      if state.get("personal_memory_path") else None))
        except Exception as exc:
            return self.respond(render_error(f"{type(exc).__name__}: {exc}", lang))
        prompt = f"{prompt}\n\n---\n{t(lang, 'reroll_title')}: {t(lang, 'reroll_' + mode)}"
        LAST_RUN.update(profile=profile, recs=recs, source_label=source_label, prompt=prompt)
        state.update(novelty=novelty, genre_constraints=gc)
        LAST_RUN["rerun"] = state
        write_exports(profile, recs, source_label)
        self.respond(render_results(profile, recs, source_label, prompt, "", lang), lang=lang)

    def handle_feedback(self):
        try:
            body = read_json_body(self)
            action = str(body.get("action", "")).strip()
            if _personal is not None and STORE is not None and action in _personal.ACTION_TO_KIND:
                kind = _personal.ACTION_TO_KIND[action]
                STORE.add_record(kind, body)
                # rejections/likes also feed the transparent feedback log for novelty shaping
                if action in ("never", "reject"):
                    try:
                        save_feedback({**body, "action": "not_for_me"})
                    except Exception:
                        pass
                return self.respond_json({"ok": True, "saved": action, "kind": kind})
            entry = save_feedback(body)
            self.respond_json({"ok": True, "saved": entry["action"]})
        except RequestTooLargeError as exc:
            self.respond_json({"ok": False, "error": str(exc)}, status=413)
        except Exception as exc:
            self.respond_json({"ok": False, "error": str(exc)}, status=400)

    def handle_preset_save(self):
        if _personal is None or STORE is None:
            return self.respond_json({"ok": False, "error": "personal store unavailable"}, status=400)
        try:
            body = read_json_body(self)
            name = str(body.get("name", "")).strip()
            if not name:
                return self.respond_json({"ok": False, "error": "name required"}, status=400)
            preset = STORE.save_preset(body, name=name)
            self.respond_json({"ok": True, "id": preset["id"], "name": preset["name"]})
        except RequestTooLargeError as exc:
            self.respond_json({"ok": False, "error": str(exc)}, status=413)
        except Exception as exc:
            self.respond_json({"ok": False, "error": str(exc)}, status=400)

    def handle_preset_delete(self):
        if _personal is None or STORE is None:
            return self.respond_json({"ok": False, "error": "personal store unavailable"}, status=400)
        try:
            body = read_json_body(self)
            pid = str(body.get("id", "")).strip()
            ok = STORE.delete_preset(pid)
            if not ok:
                return self.respond_json({"ok": False, "error": "cannot delete (built-in or unknown)"},
                                         status=400)
            self.respond_json({"ok": True, "deleted": pid})
        except Exception as exc:
            self.respond_json({"ok": False, "error": str(exc)}, status=400)

    def handle_preset_reset(self):
        if _personal is None or STORE is None:
            return self.respond_json({"ok": False, "error": "personal store unavailable"}, status=400)
        try:
            STORE.reset_presets()
            self.respond_json({"ok": True})
        except Exception as exc:
            self.respond_json({"ok": False, "error": str(exc)}, status=400)

    def data_backup(self, lang):
        if _data_mgmt is None:
            return self.respond(render_error("Data management unavailable.", lang), status=404)
        try:
            name, data = _data_mgmt.export_backup_bytes(OUTPUTS)
        except Exception as exc:
            return self.respond(render_error(f"Backup failed: {exc}", lang), status=500)
        self.send_response(200)
        self.send_header("Content-Type", "application/zip")
        self.send_header("Content-Disposition", f'attachment; filename="{name}"')
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def handle_data_action(self):
        if _data_mgmt is None:
            return self.respond_json({"ok": False, "error": "data management unavailable"}, status=400)
        try:
            body = read_json_body(self)
            action = str(body.get("action", "")).strip()
            if action == "full_reset":
                if not body.get("confirm"):
                    return self.respond_json({"ok": False, "error": "confirmation required"}, status=400)
                removed = _data_mgmt.full_reset(OUTPUTS, confirm=True)
            elif action in _data_mgmt.CLEAR_TARGETS:
                removed = _data_mgmt.clear(OUTPUTS, action)
            else:
                return self.respond_json({"ok": False, "error": "unknown action"}, status=400)
            self.respond_json({"ok": True, "removed": removed})
        except Exception as exc:
            self.respond_json({"ok": False, "error": str(exc)}, status=400)

    def handle_lastfm_save(self):
        if _local_config is None:
            return self.respond_json({"ok": False, "message": "config unavailable"}, status=400)
        try:
            body = read_json_body(self)
            username = str(body.get("username", "")).strip()
            api_key = str(body.get("api_key", "")).strip()
            _local_config.set_lastfm(username or None, api_key or None)
            self.respond_json({"ok": True, "message": "Saved locally."})
        except Exception as exc:
            self.respond_json({"ok": False, "message": str(exc)}, status=400)

    def handle_lastfm_test(self):
        if _lastfm is None:
            return self.respond_json({"ok": False, "message": "Last.fm module unavailable"}, status=400)
        if _local_config is not None:
            _local_config.apply_to_env()
        client = _lastfm.LastfmClient()
        status = client.config_status()
        if not status["api_key_present"]:
            return self.respond_json({"ok": False, "message": "API key missing — paste it and Save first."})
        if not status["username_present"]:
            return self.respond_json({"ok": False, "message": "Username missing — enter it and Save first."})
        try:
            data = client.get_recent_tracks(limit=1)
            n = len(data.get("tracks", [])) if isinstance(data, dict) else 0
            who = data.get("username", client.username) if isinstance(data, dict) else client.username
            self.respond_json({"ok": True, "message": f"Connected as {who} — recent tracks loaded ({n})."})
        except Exception as exc:
            self.respond_json({"ok": False, "message": f"Error: {exc}"})

    def handle_lastfm_clear(self):
        if _local_config is None:
            return self.respond_json({"ok": False, "message": "config unavailable"}, status=400)
        try:
            _local_config.clear_lastfm()
            self.respond_json({"ok": True, "message": "Cleared local Last.fm config."})
        except Exception as exc:
            self.respond_json({"ok": False, "message": str(exc)}, status=400)

    def handle_enhance(self):
        try:
            body = read_json_body(self)
        except Exception:
            body = {}
        lang = pick_lang(body.get("lang", ""), "")
        if ollama_enhance is None:
            return self.respond_json({"error": t(lang, "ai_unavailable", reason="module not loaded")})
        profile, recs = LAST_RUN.get("profile"), LAST_RUN.get("recs")
        if not profile or not recs:
            return self.respond_json({"error": t(lang, "ai_unavailable", reason="no recommendations generated yet")})
        try:
            text = ollama_enhance.enhance(profile, recs, lang=lang)
            self.respond_json({"text": text})
        except RuntimeError as exc:
            self.respond_json({"error": t(lang, "ai_unavailable", reason=str(exc))})

    def log_message(self, format, *args):
        return


# ---------------------------------------------------------------------------
# Server startup with free-port fallback
# ---------------------------------------------------------------------------

def find_free_port(preferred=PORT, host=HOST, attempts=20):
    """Return preferred port if free, otherwise the next free one."""
    import socket
    for offset in range(attempts):
        port = preferred + offset
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                probe.bind((host, port))
                return port
            except OSError:
                continue
    raise OSError(f"No free port found in range {preferred}-{preferred + attempts - 1}.")


def serve(port=None, open_browser=False):
    import os
    OUTPUTS.mkdir(exist_ok=True)
    requested = port or int(os.environ.get("MTR_PORT", PORT))
    actual = find_free_port(requested)
    CURRENT_PORT[0] = actual
    url = f"http://{HOST}:{actual}"

    print("=" * 56)
    print("  Music DNA Copilot — local app")
    print(f"  Open in your browser:  {url}")
    if actual != requested:
        print(f"  (port {requested} was busy, using {actual} instead)")
    expected = SPOTIFY.redirect_port()
    if expected and expected != actual:
        print(f"  NOTE: Spotify connect needs port {expected} (the registered")
        print(f"  redirect URI is fixed). Free that port and restart, or update")
        print(f"  SPOTIFY_REDIRECT_URI in .env AND in the Spotify dashboard.")
    print("  Your data stays in this folder. Press Ctrl+C to stop.")
    print("=" * 56)

    if open_browser:
        import threading
        import webbrowser
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()

    HTTPServer((HOST, actual), Handler).serve_forever()


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Local browser UI for Music DNA Copilot")
    parser.add_argument("--port", type=int, default=None, help=f"Preferred port (default {PORT})")
    parser.add_argument("--open", action="store_true", help="Open the browser automatically")
    args = parser.parse_args()
    serve(port=args.port, open_browser=args.open)


if __name__ == "__main__":
    main()
