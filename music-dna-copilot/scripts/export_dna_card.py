#!/usr/bin/env python3
"""
export_dna_card.py
==================
Render a shareable **Music DNA Card** — a single self-contained HTML file
(inline CSS + SVG, zero external resources, zero JavaScript dependencies)
that turns a taste profile into a visual "music identity" you can open,
screenshot, print, or keep. Everything is generated locally.

Open card format (v1) — for other projects too
----------------------------------------------
Any tool can render this card from its own data. The generator accepts:

1. a Music DNA taste profile (output of `analyze_taste.py`), or
2. a portable Music DNA package (`portable_music_dna.json`,
   `format == "portable_music_dna"` — the nested `profile` and `sources`
   are used automatically), or
3. **any JSON object** with this minimal contract:

   {
     "core_genres":      [{"genre": str, "affinity_score": 0..1}, ...],
     "recurring_artists":[{"artist_name": str}, ...],          # optional
     "mood_profile":     {"average_valence": 0..1,
                          "average_energy": 0..1},             # optional
     "emotional_tone":   str,                                  # optional
     "novelty_tolerance": 0..1,                                # optional
     "mainstream_vs_niche": 0..1                               # optional
   }

   Optional coverage (adds the sources strip + confidence badge):

   {
     "contribution_percent": {"spotify": 62, "lastfm": 38, ...},
     "confidence_level": "High" | "Medium" | "Low"
   }

Unknown fields are ignored; missing fields degrade gracefully — so a
third-party project only needs `core_genres` to get a working card.

CLI
---
    python scripts/export_dna_card.py [PROFILE.json]
        [--coverage source_coverage.json]
        [--output outputs/music_dna_card.html]
        [--lang en|ru|uk]
        [--title "Custom card title"]

Defaults: PROFILE = outputs/local_taste_profile.json,
output = outputs/music_dna_card.html, lang = en.
"""

import argparse
import html
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUTPUTS = ROOT / "outputs"

CARD_T = {
    "en": {
        "eyebrow": "MUSIC DNA",
        "subtitle": "A local, portable snapshot of one music taste",
        "genres": "Core genres",
        "artists": "Artists I keep returning to",
        "mood": "Mood",
        "energy": "Energy",
        "scale_main": "Mainstream",
        "scale_niche": "Niche",
        "scale_safe": "Stays close",
        "scale_explore": "Explores",
        "sources": "Built from",
        "confidence": "profile confidence", "lvl": {"High": "High", "Medium": "Medium", "Low": "Low"},
        "footer": "Generated locally · nothing was uploaded",
        "hint": "Tip: screenshot this card or press Ctrl/Cmd+S to keep it.",
        "untitled": "My Music DNA",
    },
    "ru": {
        "eyebrow": "MUSIC DNA",
        "subtitle": "Локальный портативный снимок музыкального вкуса",
        "genres": "Ключевые жанры",
        "artists": "Артисты, к которым возвращаюсь",
        "mood": "Настроение",
        "energy": "Энергия",
        "scale_main": "Мейнстрим",
        "scale_niche": "Нишевое",
        "scale_safe": "Ближе к знакомому",
        "scale_explore": "Исследует",
        "sources": "Источники",
        "confidence": "уверенность профиля", "lvl": {"High": "Высокая", "Medium": "Средняя", "Low": "Низкая"},
        "footer": "Создано локально · ничего не загружалось",
        "hint": "Подсказка: сделайте скриншот или нажмите Ctrl/Cmd+S, чтобы сохранить.",
        "untitled": "Моя Music DNA",
    },
    "uk": {
        "eyebrow": "MUSIC DNA",
        "subtitle": "Локальний портативний знімок музичного смаку",
        "genres": "Ключові жанри",
        "artists": "Артисти, до яких повертаюся",
        "mood": "Настрій",
        "energy": "Енергія",
        "scale_main": "Мейнстрім",
        "scale_niche": "Нішеве",
        "scale_safe": "Ближче до знайомого",
        "scale_explore": "Досліджує",
        "sources": "Джерела",
        "confidence": "впевненість профілю", "lvl": {"High": "Висока", "Medium": "Середня", "Low": "Низька"},
        "footer": "Створено локально · нічого не завантажувалося",
        "hint": "Порада: зробіть скриншот або натисніть Ctrl/Cmd+S, щоб зберегти.",
        "untitled": "Моя Music DNA",
    },
}

GENRE_HUES = [266, 199, 327, 158, 36, 218, 0, 290]  # vivid but harmonious

SOURCE_LABELS = {
    "spotify": "Spotify", "lastfm": "Last.fm", "youtube_takeout": "YouTube",
    "csv": "CSV", "json": "JSON", "manual": "Manual", "sample": "Demo",
    "demo": "Demo", "merged": "Merged",
}


def esc(value):
    return html.escape(str(value), quote=True)


def clamp01(value, default=None):
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        return default


def unwrap_profile(data):
    """Accept a taste profile or a portable_music_dna package."""
    coverage = None
    if isinstance(data, dict) and data.get("format") == "portable_music_dna":
        coverage = data.get("sources") or None
        data = data.get("profile") or {}
    return data, coverage


def _genre_bars(genres, hues=GENRE_HUES):
    rows = []
    top = genres[:6]
    max_aff = max((clamp01(g.get("affinity_score"), 0) or 0 for g in top), default=1) or 1
    for i, g in enumerate(top):
        name = esc(g.get("genre", "?"))
        aff = (clamp01(g.get("affinity_score"), 0) or 0) / max_aff
        pct = max(8, round(aff * 100))
        hue = hues[i % len(hues)]
        rows.append(
            f'<div class="grow"><div class="glabel"><span>{name}</span>'
            f'<span class="gpct">{round(aff * 100)}</span></div>'
            f'<div class="gtrack"><div class="gbar" style="--w:{pct}%;'
            f'--h:{hue};"></div></div></div>'
        )
    return "\n".join(rows)


def _ring(value, label, hue):
    """SVG circular gauge, value in 0..1."""
    v = clamp01(value, None)
    if v is None:
        return ""
    r = 34
    c = 2 * 3.14159 * r
    dash = c * v
    return f"""<div class="ring">
  <svg viewBox="0 0 84 84" width="84" height="84">
    <circle cx="42" cy="42" r="{r}" class="ring-bg"/>
    <circle cx="42" cy="42" r="{r}" class="ring-fg" style="--c:{c:.1f};--d:{dash:.1f};--h:{hue}"/>
    <text x="42" y="47" class="ring-val">{round(v * 100)}</text>
  </svg>
  <span class="ring-label">{esc(label)}</span>
</div>"""


def _scale(value, left, right, hue):
    v = clamp01(value, None)
    if v is None:
        return ""
    return f"""<div class="scale">
  <span>{esc(left)}</span>
  <div class="strack"><div class="sdot" style="--x:{3 + v * 94:.0f}%;--h:{hue}"></div></div>
  <span>{esc(right)}</span>
</div>"""


def _sources_strip(coverage, tr):
    if not coverage:
        return ""
    contrib = coverage.get("contribution_percent") or {}
    chips = []
    for src, pct in sorted(contrib.items(), key=lambda kv: -(kv[1] or 0)):
        label = SOURCE_LABELS.get(src, src)
        chips.append(f'<span class="chip">{esc(label)} {round(pct or 0)}%</span>')
    conf = coverage.get("confidence_level")
    badge = ""
    if conf in ("High", "Medium", "Low"):
        badge = f'<span class="chip conf conf-{conf.lower()}">{esc(tr.get("lvl", {}).get(conf, conf))} {tr["confidence"]}</span>'
    if not chips and not badge:
        return ""
    return (f'<div class="sect-title">{tr["sources"]}</div>'
            f'<div class="chips">{"".join(chips)}{badge}</div>')


def build_card(profile, coverage=None, lang="en", title=None):
    """Return the full HTML of a Music DNA Card. Pure function, no I/O."""
    profile, inner_cov = unwrap_profile(profile or {})
    coverage = coverage or inner_cov
    tr = CARD_T.get(lang, CARD_T["en"])

    genres = profile.get("core_genres") or []
    artists = [a.get("artist_name") for a in (profile.get("recurring_artists") or [])
               if a.get("artist_name")][:5]
    mood = profile.get("mood_profile") or {}
    tone = profile.get("emotional_tone") or ""
    headline = esc(title or (tone.replace("-", " · ").title() if tone else tr["untitled"]))
    date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    artist_chips = "".join(f'<span class="chip">{esc(a)}</span>' for a in artists)
    rings = (_ring(mood.get("average_valence"), tr["mood"], 327)
             + _ring(mood.get("average_energy"), tr["energy"], 199))
    scales = (_scale(profile.get("mainstream_vs_niche"), tr["scale_main"], tr["scale_niche"], 266)
              + _scale(profile.get("novelty_tolerance"), tr["scale_safe"], tr["scale_explore"], 158))

    eq_bars = "".join(
        f'<span class="eq" style="animation-delay:{i * 0.13:.2f}s"></span>' for i in range(5)
    )

    return f"""<!doctype html>
<html lang="{esc(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{headline} — Music DNA Card</title>
<style>
:root {{ color-scheme: dark; }}
* {{ box-sizing: border-box; margin: 0; }}
body {{
  min-height: 100vh; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 14px; padding: 24px 12px; background: #0b0b10;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  color: #f5f3ee;
}}
.card {{
  width: min(560px, 100%); border-radius: 28px; padding: 34px 34px 26px;
  position: relative; overflow: hidden; border: 1px solid rgba(255,255,255,.09);
  background:
    radial-gradient(120% 90% at 0% 0%, hsla(266, 70%, 22%, .85), transparent 55%),
    radial-gradient(110% 90% at 100% 0%, hsla(199, 80%, 22%, .8), transparent 55%),
    radial-gradient(130% 100% at 50% 110%, hsla(327, 70%, 20%, .7), transparent 60%),
    #101018;
  box-shadow: 0 30px 80px rgba(0,0,0,.55);
}}
.card::before {{
  content: ""; position: absolute; top:-40%; right:-40%; bottom:-40%; left:-40%;
  background: conic-gradient(from 0deg, transparent 0 70%, hsla(266, 90%, 60%, .14) 80%, transparent 90%);
  animation: drift 14s linear infinite; pointer-events: none;
}}
@keyframes drift {{ to {{ transform: rotate(1turn); }} }}
.inner {{ position: relative; }}
.eyebrow {{ display:flex; align-items:center; gap:10px; letter-spacing:.34em;
  font-size:12px; font-weight:700; color:hsl(266, 90%, 78%); }}
.eqwrap {{ display:inline-flex; gap:3px; align-items:flex-end; height:14px; }}
.eq {{ width:3px; height:6px; border-radius:2px; background:hsl(199, 90%, 65%);
  animation:bounce 1.1s ease-in-out infinite alternate; }}
@keyframes bounce {{ from {{ height:4px; opacity:.55; }} to {{ height:14px; opacity:1; }} }}
h1 {{ font-size: clamp(30px, 7vw, 44px); letter-spacing:-.04em; line-height:1.02;
  margin: 10px 0 4px; }}
.sub {{ color:#b9b4ab; font-size:13.5px; }}
.date {{ position:absolute; top:2px; right:0; font-size:12px; color:#8d897f; }}
.sect-title {{ margin: 22px 0 10px; font-size:12px; font-weight:700;
  letter-spacing:.18em; text-transform:uppercase; color:#9c97c9; }}
.glabel {{ display:flex; justify-content:space-between; font-size:13.5px; margin-bottom:4px; }}
.gpct {{ color:#8d897f; font-variant-numeric: tabular-nums; }}
.gtrack {{ height:10px; border-radius:6px; background:rgba(255,255,255,.07); overflow:hidden; }}
.gbar {{ height:100%; width:var(--w); border-radius:6px;
  background:linear-gradient(90deg, hsl(var(--h), 85%, 62%), hsl(calc(var(--h) + 40), 85%, 58%));
  transform-origin:left; animation:grow .9s cubic-bezier(.2,.8,.2,1); }}
@keyframes grow {{ from {{ transform:scaleX(0); }} }}
.grow + .grow {{ margin-top:10px; }}
.meters {{ display:flex; align-items:center; gap:18px; flex-wrap:wrap; margin-top:6px; }}
.ring {{ display:flex; flex-direction:column; align-items:center; gap:2px; }}
.ring-bg {{ fill:none; stroke:rgba(255,255,255,.08); stroke-width:8; }}
.ring-fg {{ fill:none; stroke:hsl(var(--h), 85%, 62%); stroke-width:8; stroke-linecap:round;
  stroke-dasharray: var(--d) calc(var(--c) - var(--d));
  transform: rotate(-90deg); transform-origin:center;
  animation: ring 1.1s cubic-bezier(.2,.8,.2,1); }}
@keyframes ring {{ from {{ stroke-dasharray: 0 var(--c); }} }}
.ring-val {{ fill:#f5f3ee; font-size:18px; font-weight:700; text-anchor:middle; }}
.ring-label {{ font-size:12px; color:#b9b4ab; }}
.scales {{ flex:1; min-width:220px; display:flex; flex-direction:column; gap:14px; }}
.scale {{ display:flex; align-items:center; gap:10px; font-size:12px; color:#b9b4ab; }}
.strack {{ flex:1; height:4px; border-radius:3px; background:rgba(255,255,255,.1); position:relative; }}
.sdot {{ position:absolute; top:50%; left:var(--x); width:14px; height:14px; border-radius:50%;
  transform:translate(-50%,-50%); background:hsl(var(--h), 85%, 62%);
  box-shadow:0 0 0 4px hsla(var(--h), 85%, 62%, .25); }}
.chips {{ display:flex; flex-wrap:wrap; gap:8px; }}
.chip {{ padding:6px 12px; border-radius:999px; font-size:13px;
  background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.1); }}
.conf-high {{ background:hsla(150, 60%, 22%, .8); }}
.conf-medium {{ background:hsla(40, 70%, 24%, .8); }}
.conf-low {{ background:hsla(0, 60%, 24%, .8); }}
.footer span + span {{ margin-left:10px; }}
.footer {{ margin-top:24px; padding-top:14px; border-top:1px solid rgba(255,255,255,.09);
  display:flex; justify-content:space-between; gap:10px; font-size:11.5px; color:#8d897f; }}
.hint {{ font-size:12.5px; color:#6f6b62; text-align:center; }}
@media print {{ body {{ background:#0b0b10; }} .hint {{ display:none; }} }}
</style>
</head>
<body>
<figure class="card"><div class="inner">
  <div class="date">{date}</div>
  <div class="eyebrow"><span class="eqwrap">{eq_bars}</span>{tr["eyebrow"]}</div>
  <h1>{headline}</h1>
  <p class="sub">{tr["subtitle"]}</p>

  <div class="sect-title">{tr["genres"]}</div>
  {_genre_bars(genres)}

  <div class="sect-title">{tr["mood"]} / {tr["energy"]}</div>
  <div class="meters">{rings}<div class="scales">{scales}</div></div>

  {f'<div class="sect-title">{tr["artists"]}</div><div class="chips">{artist_chips}</div>' if artist_chips else ''}

  {_sources_strip(coverage, tr)}

  <div class="footer"><span>{tr["footer"]}</span><span>Music DNA Copilot · card v1</span></div>
</div></figure>
<p class="hint">{tr["hint"]}</p>
</body>
</html>"""


def main():
    parser = argparse.ArgumentParser(description="Render a shareable Music DNA Card (self-contained HTML).")
    parser.add_argument("profile", nargs="?", default=str(OUTPUTS / "local_taste_profile.json"))
    parser.add_argument("--coverage", default=None,
                        help="Optional source_coverage.json (sources strip + confidence badge).")
    parser.add_argument("--output", default=str(OUTPUTS / "music_dna_card.html"))
    parser.add_argument("--lang", default="en", choices=sorted(CARD_T))
    parser.add_argument("--title", default=None, help="Custom headline for the card.")
    args = parser.parse_args()

    try:
        profile = json.loads(Path(args.profile).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"Could not read profile '{args.profile}': {exc}", file=sys.stderr)
        return 1

    coverage = None
    cov_path = Path(args.coverage) if args.coverage else None
    if cov_path and cov_path.exists():
        try:
            coverage = json.loads(cov_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            coverage = None  # the card degrades gracefully without it

    html_text = build_card(profile, coverage=coverage, lang=args.lang, title=args.title)
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html_text, encoding="utf-8")
    print(f"Music DNA Card written to: {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
