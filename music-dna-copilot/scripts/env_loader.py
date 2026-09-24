#!/usr/bin/env python3
"""
env_loader.py
=============
Minimal .env loader using only the standard library.

Loads KEY=VALUE pairs from the project root `.env` file (if present)
into a dict, with `os.environ` taking precedence so users can override
file values per shell session.

This keeps the project dependency-free (no python-dotenv required).
"""

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_env(env_path: Path | None = None) -> dict:
    """Read .env (if it exists) and merge with os.environ (environ wins)."""
    env_path = env_path or (ROOT / ".env")
    values: dict[str, str] = {}

    if env_path.exists():
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key:
                values[key] = value

    # Real environment variables override the file.
    for key in list(values):
        if key in os.environ:
            values[key] = os.environ[key]
    for key, value in os.environ.items():
        values.setdefault(key, value)

    return values


def get_env(key: str, default: str = "") -> str:
    return load_env().get(key, default)
