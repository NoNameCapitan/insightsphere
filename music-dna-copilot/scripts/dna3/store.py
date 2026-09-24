"""Local persistence for the 3.0 product layer.

Everything lives under one base folder (default: <project>/outputs). The base
is injectable so tests run against a temporary directory.

Layout (3.0 files; legacy 2.x files keep their names so both UIs agree):

    outputs/
      spotify_history.json, lastfm_normalized.json,
      youtube_takeout_normalized.json         <- imports (2.x names)
      imports/<service>.json                  <- per-service exports (3.0)
      feedback.jsonl                          <- shared with the 2.x brain
      beta_events.jsonl                       <- privacy-first local analytics
      capsule_history.jsonl                   <- completed capsule metrics
      v3/settings.json
      v3/dna.json                             <- latest Music DNA
      v3/capsules/<capsule_id>.json
      v3/import_registry.json                 <- file hashes (duplicate guard)
      v3/diagnostics.jsonl                    <- errors for Advanced mode
"""
from __future__ import annotations

import json
import os
import secrets
import tempfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_BASE = ROOT / "outputs"

PROVIDER_CHOICES = ("spotify", "apple_music", "youtube_music", "deezer", "tidal", "soundcloud")

DEFAULT_SETTINGS = {
    "onboarding_completed": False,
    "preferred_provider": "spotify",
    "fallback_order": ["apple_music", "youtube_music", "deezer"],
    "analytics_enabled": True,      # local-only; never leaves this device
    "advanced_mode": False,
    "motion": "system",             # system | reduced | full
    "demo_mode": False,
    "session_reset_at": None,
    "anonymous_seed": None,
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_dt(value):
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class CorruptedDataError(Exception):
    """A local data file could not be parsed. It has been moved aside."""

    def __init__(self, path, moved_to):
        super().__init__(f"{Path(path).name} was unreadable and was moved to {Path(moved_to).name}")
        self.path = str(path)
        self.moved_to = str(moved_to)


class Store:
    def __init__(self, base=None):
        self.base = Path(base) if base else DEFAULT_BASE
        self.v3 = self.base / "v3"
        self.capsules_dir = self.v3 / "capsules"
        self.imports_dir = self.base / "imports"

    # -- paths ---------------------------------------------------------------
    def path(self, *parts) -> Path:
        return self.base.joinpath(*parts)

    @property
    def feedback_path(self) -> Path:
        return self.base / "feedback.jsonl"

    @property
    def beta_path(self) -> Path:
        return self.base / "beta_events.jsonl"

    @property
    def capsule_history_path(self) -> Path:
        return self.base / "capsule_history.jsonl"

    @property
    def dna_path(self) -> Path:
        return self.v3 / "dna.json"

    # -- json helpers --------------------------------------------------------
    def write_json(self, path, data):
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=".tmp-", suffix=".json")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            os.replace(tmp, path)
        finally:
            if os.path.exists(tmp):
                os.unlink(tmp)
        return data

    def read_json(self, path, default=None, *, quarantine=True):
        """Read JSON; a corrupted file is moved aside (never silently deleted)."""
        path = Path(path)
        if not path.exists():
            return default
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (ValueError, UnicodeDecodeError):
            if not quarantine:
                return default
            moved = path.with_name(path.name + f".corrupt-{datetime.now():%Y%m%d%H%M%S}")
            try:
                path.rename(moved)
            except OSError:
                moved = path
            self.log_diagnostic("corrupted_data", f"{path.name} could not be parsed", {"moved_to": moved.name})
            raise CorruptedDataError(path, moved)

    def read_jsonl(self, path):
        path = Path(path)
        if not path.exists():
            return []
        rows = []
        for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except ValueError:
                continue  # one bad line never poisons the whole log
            if isinstance(row, dict):
                rows.append(row)
        return rows

    def append_jsonl(self, path, row):
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
        return row

    # -- settings ------------------------------------------------------------
    def settings(self) -> dict:
        try:
            data = self.read_json(self.v3 / "settings.json", {}) or {}
        except CorruptedDataError:
            data = {}
        merged = dict(DEFAULT_SETTINGS)
        merged.update({k: v for k, v in data.items() if k in DEFAULT_SETTINGS})
        if not merged.get("anonymous_seed"):
            merged["anonymous_seed"] = secrets.token_hex(16)
            self.write_json(self.v3 / "settings.json", merged)
        return merged

    def update_settings(self, changes: dict) -> dict:
        current = self.settings()
        clean = {}
        for key, value in (changes or {}).items():
            if key not in DEFAULT_SETTINGS or key == "anonymous_seed":
                continue
            if key == "preferred_provider":
                if value not in PROVIDER_CHOICES:
                    raise ValueError(f"Unknown provider: {value}")
            elif key == "fallback_order":
                if not isinstance(value, list) or any(v not in PROVIDER_CHOICES for v in value):
                    raise ValueError("fallback_order must be a list of known providers")
                value = list(dict.fromkeys(value))[:5]
            elif key == "motion":
                if value not in ("system", "reduced", "full"):
                    raise ValueError("motion must be system, reduced or full")
            elif key in ("onboarding_completed", "analytics_enabled", "advanced_mode", "demo_mode"):
                value = bool(value)
            clean[key] = value
        current.update(clean)
        self.write_json(self.v3 / "settings.json", current)
        return current

    # -- diagnostics ---------------------------------------------------------
    def log_diagnostic(self, code, message, detail=None):
        row = {"ts": now_iso(), "code": code, "message": str(message)[:500]}
        if detail:
            row["detail"] = detail if isinstance(detail, dict) else str(detail)[:2000]
        try:
            self.append_jsonl(self.v3 / "diagnostics.jsonl", row)
        except OSError:
            pass
        return row

    def diagnostics(self, limit=50):
        return self.read_jsonl(self.v3 / "diagnostics.jsonl")[-limit:]
