#!/usr/bin/env python3
"""
local_config.py
===============
A tiny local-only settings store so users can set Last.fm credentials from the UI
without hand-editing .env. Written to outputs/local_config.json, which is excluded
from git and from the release archive. Never committed, never uploaded.

Resolution order for credentials: real environment (.env) wins; this file fills in
anything the environment doesn't already provide.
"""

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = ROOT / "outputs" / "local_config.json"


def load():
    try:
        return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save(data):
    CONFIG_PATH.parent.mkdir(exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")
    try:
        os.chmod(CONFIG_PATH, 0o600)  # best-effort: keep secrets user-only
    except OSError:
        pass
    return data


def set_lastfm(username, api_key):
    data = load()
    lf = data.setdefault("lastfm", {})
    if username is not None:
        lf["username"] = username.strip()
    if api_key is not None:
        lf["api_key"] = api_key.strip()
    save(data)
    apply_to_env()
    return lf


def clear_lastfm():
    data = load()
    data.pop("lastfm", None)
    save(data)
    for key in ("LASTFM_API_KEY", "LASTFM_USERNAME"):
        os.environ.pop(key, None)
    return True


def get_lastfm():
    return load().get("lastfm", {})


def apply_to_env():
    """Fill LASTFM_* env vars from local config where the environment is empty.

    .env / real environment always wins; this only fills gaps."""
    lf = get_lastfm()
    if lf.get("api_key") and not os.environ.get("LASTFM_API_KEY", "").strip():
        os.environ["LASTFM_API_KEY"] = lf["api_key"]
    if lf.get("username") and not os.environ.get("LASTFM_USERNAME", "").strip():
        os.environ["LASTFM_USERNAME"] = lf["username"]
