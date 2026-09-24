#!/usr/bin/env python3
"""
ollama_enhance.py
=================
Optional, free, local AI enhancement using Ollama (http://127.0.0.1:11434).

Privacy model:
    - Entirely optional. The app is fully functional without Ollama.
    - Only the generated Music DNA summary and the recommendation list are
      sent to the LOCAL Ollama server. Never OAuth tokens, never raw files.
    - No paid API key, no cloud calls.

CLI:
    python scripts/ollama_enhance.py            # enhance latest local outputs
    python scripts/ollama_enhance.py --status   # check availability
"""

import argparse
import json
import os
import sys
from pathlib import Path
from urllib import error, request

ROOT = Path(__file__).resolve().parents[1]
OUTPUTS = ROOT / "outputs"
# Optional local Ollama server; both are read from the environment so the keys
# documented in .env.example actually take effect (defaults keep it zero-config).
OLLAMA_BASE = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
# Only override the auto-detected installed model when explicitly set.
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL") or None

LANG_NAMES = {"en": "English", "ru": "Russian", "uk": "Ukrainian"}


def is_available(timeout: float = 1.5):
    """Return (available, model_name_or_reason)."""
    try:
        with request.urlopen(f"{OLLAMA_BASE}/api/tags", timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        models = [m.get("name") for m in data.get("models", []) if m.get("name")]
        if not models:
            return False, "Ollama is running but no models are installed (try: ollama pull llama3.2)"
        return True, models[0]
    except (error.URLError, OSError, json.JSONDecodeError, TimeoutError):
        return False, "Ollama is not running at http://127.0.0.1:11434"


def _build_prompt(profile: dict, recs: dict, lang: str) -> str:
    slim_recs = [
        {
            "track": r.get("track_title"),
            "artist": r.get("artist"),
            "group": r.get("group"),
            "genres": r.get("genres", [])[:4],
            "confidence": r.get("confidence_score"),
        }
        for r in recs.get("recommendations", [])[:12]
    ]
    payload = {
        "music_dna_summary": recs.get("music_dna_summary", ""),
        "emotional_tone": profile.get("emotional_tone"),
        "core_genres": [g.get("genre") for g in profile.get("core_genres", [])[:6]],
        "parameters": recs.get("parameters", {}),
        "recommendations": slim_recs,
    }
    language = LANG_NAMES.get(lang, "English")
    return (
        "You are a friendly music guide. Based on this locally generated taste profile "
        "and recommendation list, write a short, warm, human summary (max 180 words) in "
        f"{language}: 1) describe the listener's taste in plain words, 2) point out the most "
        "promising 2-3 recommendations and why, 3) one sentence on what the wildcard picks "
        "offer. No markdown headers, no bullet lists, just flowing text.\n\nDATA:\n"
        + json.dumps(payload, ensure_ascii=False)
    )


def enhance(profile: dict, recs: dict, lang: str = "en", model: str | None = None,
            timeout: float = 120.0) -> str:
    """Return enhanced explanation text, or raise RuntimeError with a clean message."""
    available, info = is_available()
    if not available:
        raise RuntimeError(info)
    body = json.dumps({
        "model": model or OLLAMA_MODEL or info,
        "prompt": _build_prompt(profile, recs, lang),
        "stream": False,
        "options": {"temperature": 0.7},
    }).encode("utf-8")
    req = request.Request(f"{OLLAMA_BASE}/api/generate", data=body,
                          headers={"Content-Type": "application/json"}, method="POST")
    try:
        with request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except (error.URLError, OSError, TimeoutError) as exc:
        raise RuntimeError(f"Local Ollama request failed: {exc}") from exc
    text = (data.get("response") or "").strip()
    if not text:
        raise RuntimeError("Ollama returned an empty response.")
    return text


def main():
    parser = argparse.ArgumentParser(description="Optional local-AI explanation enhancer (Ollama)")
    parser.add_argument("--status", action="store_true", help="Only check whether Ollama is available")
    parser.add_argument("--lang", default="en", choices=["en", "ru", "uk"])
    parser.add_argument("--profile", default=str(OUTPUTS / "local_taste_profile.json"))
    parser.add_argument("--recs", default=str(OUTPUTS / "local_recommendations.json"))
    args = parser.parse_args()

    available, info = is_available()
    if args.status:
        print(f"available={available} ({info})")
        sys.exit(0 if available else 1)

    if not available:
        print(f"Ollama unavailable: {info}\nThe heuristic explanations still work without it.")
        sys.exit(1)

    profile = json.loads(Path(args.profile).read_text(encoding="utf-8"))
    recs = json.loads(Path(args.recs).read_text(encoding="utf-8"))
    print(enhance(profile, recs, args.lang))


if __name__ == "__main__":
    main()
