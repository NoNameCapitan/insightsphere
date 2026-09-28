"""Shared plumbing for live music-service connectors (standard library only).

Honesty rules (same as the rest of the app)
-------------------------------------------
* A connector reports `connected` only after the service itself accepted our
  credentials (a token exchange or a real API call). Nothing is simulated.
* Credentials are the user's own: every service except ListenBrainz requires
  a developer app registered by the person running this app. We store what
  they paste in `connectors.json` inside the private config directory with
  0600 permissions, next to the Spotify token file.
* Tokens are persisted only when the user leaves "stay connected on this
  computer" on. Otherwise they live in memory until the app stops.
* Every request is read-only.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import secrets
import stat
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib import error, parse, request


class ConnectorError(RuntimeError):
    """A provider call failed. `kind` feeds the product error classifier."""

    def __init__(self, message, *, kind="provider", status=None):
        super().__init__(message)
        self.kind = kind          # setup | auth | rate_limit | offline | provider | not_found
        self.status = status


def config_dir() -> Path:
    return Path(os.environ.get("MTR_CONFIG_DIR", Path.home() / ".config" / "music-taste-recommender"))


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def epoch_to_iso(ts):
    try:
        return datetime.fromtimestamp(int(ts), timezone.utc).isoformat()
    except (TypeError, ValueError, OverflowError, OSError):
        return None


def pkce_pair():
    """(code_verifier, code_challenge) per RFC 7636, S256."""
    verifier = base64.urlsafe_b64encode(secrets.token_bytes(48)).rstrip(b"=").decode("ascii")
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return verifier, base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------

# Tests replace this with a fake; production uses urllib directly.
urlopen = request.urlopen
USER_AGENT = "MusicDNACopilot/3.2 (local app; read-only)"


def http_json(url, *, method="GET", params=None, form=None, headers=None, timeout=30):
    """Call a JSON endpoint and classify failures into ConnectorError kinds."""
    if params:
        url += ("&" if "?" in url else "?") + parse.urlencode(params)
    data = None
    hdrs = {"Accept": "application/json", "User-Agent": USER_AGENT}
    if form is not None:
        data = parse.urlencode(form).encode("ascii")
        hdrs["Content-Type"] = "application/x-www-form-urlencoded"
        method = "POST" if method == "GET" else method
    hdrs.update(headers or {})
    req = request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
    except error.HTTPError as exc:
        detail = ""
        try:
            detail = exc.read().decode("utf-8", errors="replace")[:500]
        except Exception:
            pass
        kind = {401: "auth", 403: "auth", 404: "not_found", 429: "rate_limit"}.get(exc.code, "provider")
        raise ConnectorError(f"HTTP {exc.code} from {parse.urlsplit(url).netloc}: {detail}",
                             kind=kind, status=exc.code) from exc
    except (error.URLError, TimeoutError, OSError) as exc:
        reason = getattr(exc, "reason", exc)
        raise ConnectorError(f"Could not reach {parse.urlsplit(url).netloc}: {reason}", kind="offline") from exc
    if not raw.strip():
        return {}
    try:
        return json.loads(raw)
    except ValueError as exc:
        raise ConnectorError(f"{parse.urlsplit(url).netloc} returned something that is not JSON: {raw[:120]}",
                             kind="provider") from exc


# ---------------------------------------------------------------------------
# Connector contract
# ---------------------------------------------------------------------------

class Connector:
    """One service. Subclasses fill in the class attributes and hooks.

    auth:
      "oauth"    -> browser redirect to the service, code comes back to
                    /connect/<id>/callback
      "musickit" -> Apple's MusicKit JS page returns a Music User Token
      "username" -> public listening data by user name (no password, no OAuth)
    """

    id = ""
    label = ""
    auth = "oauth"
    fields: list[dict] = []          # setup form: name, label, secret, required, help, multiline
    dashboard_url = ""
    setup_steps: list[str] = []
    reads = ""                       # plain-language list of what we read
    limits = ""                      # honest caveats shown on the card
    needs_redirect_registration = True

    # -- setup ---------------------------------------------------------------
    def validate_config(self, cfg: dict) -> dict:
        """Return the cleaned config or raise ConnectorError(kind='setup')."""
        out = {}
        for f in self.fields:
            value = str(cfg.get(f["name"]) or "").strip()
            if f.get("required", True) and not value:
                raise ConnectorError(f"{f['label']} is required.", kind="setup")
            if value:
                out[f["name"]] = value
        return out

    def is_configured(self, cfg: dict) -> bool:
        return all(cfg.get(f["name"]) for f in self.fields if f.get("required", True))

    # -- OAuth hooks -----------------------------------------------------------
    def authorize_url(self, cfg, redirect_uri, state, challenge):  # pragma: no cover - abstract
        raise NotImplementedError

    def exchange_code(self, cfg, code, redirect_uri, verifier) -> dict:  # pragma: no cover - abstract
        raise NotImplementedError

    def refresh(self, cfg, token) -> dict:
        raise ConnectorError(f"{self.label} session expired. Connect again.", kind="auth")

    def token_expired(self, token) -> bool:
        exp = token.get("expires_at")
        return bool(exp) and time.time() >= float(exp)

    # -- data ------------------------------------------------------------------
    def account_name(self, cfg, token) -> str | None:  # pragma: no cover - abstract
        raise NotImplementedError

    def fetch_history(self, cfg, token) -> dict:  # pragma: no cover - abstract
        raise NotImplementedError

    def describe(self):
        return {"auth": self.auth, "fields": [{k: v for k, v in f.items()} for f in self.fields],
                "dashboard_url": self.dashboard_url, "setup_steps": list(self.setup_steps),
                "reads": self.reads, "limits": self.limits,
                "needs_redirect_registration": self.needs_redirect_registration}


def token_payload(payload: dict, previous: dict | None = None) -> dict:
    """Normalize an OAuth token response."""
    access = payload.get("access_token")
    if not access:
        raise ConnectorError(f"The service did not return an access token: {str(payload)[:200]}", kind="auth")
    tok = {"access_token": access}
    refresh = payload.get("refresh_token") or (previous or {}).get("refresh_token")
    if refresh:
        tok["refresh_token"] = refresh
    expires_in = payload.get("expires_in", payload.get("expires"))
    try:
        expires_in = int(expires_in or 0)
    except (TypeError, ValueError):
        expires_in = 0
    if expires_in > 0:
        tok["expires_at"] = time.time() + expires_in - 60
    return tok


# ---------------------------------------------------------------------------
# Manager: pending OAuth states, credentials and tokens
# ---------------------------------------------------------------------------

PENDING_TTL = 600  # seconds a started login stays valid


class ConnectorManager:
    def __init__(self, registry: dict):
        self.registry = registry
        self._lock = threading.Lock()
        self.pending: dict[str, dict] = {}
        self.memory_tokens: dict[str, dict] = {}   # tokens for "don't remember" sessions
        self.last_error: dict[str, str] = {}

    # -- storage ---------------------------------------------------------------
    @property
    def path(self) -> Path:
        return config_dir() / "connectors.json"

    def _load(self) -> dict:
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
            return data if isinstance(data, dict) else {}
        except (OSError, ValueError):
            return {}

    def _save(self, data: dict):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, stat.S_IRUSR | stat.S_IWUSR)
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2)
        os.replace(tmp, self.path)
        try:
            os.chmod(self.path, stat.S_IRUSR | stat.S_IWUSR)
        except OSError:
            pass

    def get(self, pid) -> dict:
        return self._load().get(pid) or {}

    def _update(self, pid, **changes):
        with self._lock:
            data = self._load()
            entry = data.get(pid) or {}
            for k, v in changes.items():
                if v is None:
                    entry.pop(k, None)
                else:
                    entry[k] = v
            if entry:
                data[pid] = entry
            else:
                data.pop(pid, None)
            self._save(data)
            return entry

    def connector(self, pid) -> Connector:
        conn = self.registry.get(pid)
        if conn is None:
            raise ConnectorError(f"No live connector for '{pid}'.", kind="setup")
        return conn

    # -- setup -----------------------------------------------------------------
    def save_setup(self, pid, cfg: dict) -> dict:
        conn = self.connector(pid)
        old = self.get(pid).get("config") or {}
        cfg = {k: v for k, v in (cfg or {}).items() if str(v or "").strip()}
        # Secret fields left blank keep their stored value, so re-saving the
        # form doesn't force the user to paste a secret again.
        for f in conn.fields:
            if f.get("secret") and f["name"] not in cfg and old.get(f["name"]):
                cfg[f["name"]] = old[f["name"]]
        clean = conn.validate_config(cfg)
        changed = {k for k in set(clean) | set(old) if clean.get(k) != old.get(k)}
        entry = self._update(pid, config=clean, configured_at=now_iso())
        if changed and (entry.get("token") or pid in self.memory_tokens):
            # New credentials invalidate the old session.
            self.disconnect(pid)
        return self.status(pid)

    def clear_setup(self, pid):
        self.memory_tokens.pop(pid, None)
        with self._lock:
            data = self._load()
            data.pop(pid, None)
            self._save(data)
        return {"provider": pid, "cleared": True}

    def config(self, pid) -> dict:
        return self.get(pid).get("config") or {}

    # -- tokens ----------------------------------------------------------------
    def token(self, pid) -> dict | None:
        return self.memory_tokens.get(pid) or self.get(pid).get("token")

    def _store_token(self, pid, token, remember, account=None):
        if remember:
            self.memory_tokens.pop(pid, None)
            self._update(pid, token=token, remember=True, account=account, connected_at=now_iso())
        else:
            self.memory_tokens[pid] = token
            self._update(pid, token=None, remember=False, account=account, connected_at=now_iso())

    def disconnect(self, pid):
        self.memory_tokens.pop(pid, None)
        self._update(pid, token=None, account=None, connected_at=None)
        self.last_error.pop(pid, None)
        return {"provider": pid, "disconnected": True}

    def status(self, pid) -> dict:
        conn = self.connector(pid)
        entry = self.get(pid)
        cfg = entry.get("config") or {}
        tok = self.token(pid)
        return {"provider": pid, "configured": conn.is_configured(cfg), "connected": bool(tok),
                "account": entry.get("account") if tok else None,
                "remembered": bool(entry.get("token")), "connected_at": entry.get("connected_at") if tok else None,
                "last_sync": entry.get("last_sync"), "error": self.last_error.get(pid),
                "config_public": {f["name"]: (("•" * 6) if f.get("secret") else cfg.get(f["name"]))
                                  for f in conn.fields if cfg.get(f["name"])}}

    # -- connect flow ----------------------------------------------------------
    def redirect_uri(self, pid, base_url):
        return f"{base_url.rstrip('/')}/connect/{pid}/callback"

    def _prune(self):
        cutoff = time.time() - PENDING_TTL
        for key in [k for k, v in self.pending.items() if v["created"] < cutoff]:
            self.pending.pop(key, None)

    def start(self, pid, base_url, remember=True) -> dict:
        """Begin a connection. Returns {"redirect": url} or {"state": s} (MusicKit)."""
        conn = self.connector(pid)
        cfg = self.config(pid)
        if not conn.is_configured(cfg):
            raise ConnectorError(f"{conn.label} needs a one-time setup first.", kind="setup")
        self._prune()
        state = secrets.token_urlsafe(24)
        verifier, challenge = pkce_pair()
        redirect_uri = self.redirect_uri(pid, base_url)
        self.pending[state] = {"pid": pid, "verifier": verifier, "remember": bool(remember),
                               "redirect_uri": redirect_uri, "created": time.time()}
        if conn.auth == "oauth":
            return {"redirect": conn.authorize_url(cfg, redirect_uri, state, challenge), "state": state}
        return {"state": state}

    def pending_for(self, pid, state) -> dict | None:
        self._prune()
        p = self.pending.get(state or "")
        return p if p and p["pid"] == pid else None

    def finish(self, pid, state, *, code=None, error_text=None, user_token=None) -> dict:
        """Complete a connection from the OAuth callback or the MusicKit page."""
        conn = self.connector(pid)
        pend = self.pending_for(pid, state)
        if pend is None:
            raise ConnectorError("This sign-in link expired or was already used. Start again.", kind="auth")
        self.pending.pop(state, None)
        if error_text:
            raise ConnectorError(f"{conn.label} sign-in was cancelled or refused ({error_text}).", kind="auth")
        cfg = self.config(pid)
        if conn.auth == "musickit":
            if not user_token:
                raise ConnectorError("Apple Music did not return an authorization.", kind="auth")
            token = {"music_user_token": user_token}
        else:
            if not code:
                raise ConnectorError(f"{conn.label} did not return an authorization code.", kind="auth")
            token = conn.exchange_code(cfg, code, pend["redirect_uri"], pend["verifier"])
        account = conn.account_name(cfg, token)   # proves the token works
        self._store_token(pid, token, pend["remember"], account=account)
        self.last_error.pop(pid, None)
        return self.status(pid)

    def connect_username(self, pid, remember=True) -> dict:
        """ListenBrainz-style: the configured user name is the connection."""
        conn = self.connector(pid)
        cfg = self.config(pid)
        if not conn.is_configured(cfg):
            raise ConnectorError(f"Enter your {conn.label} user name first.", kind="setup")
        token = {"username": cfg.get("username")}
        account = conn.account_name(cfg, token)
        self._store_token(pid, token, remember, account=account)
        self.last_error.pop(pid, None)
        return self.status(pid)

    # -- data ------------------------------------------------------------------
    def _refresh(self, pid, conn, cfg, token):
        token = conn.refresh(cfg, token)
        entry = self.get(pid)
        if entry.get("token"):
            self._update(pid, token=token)
        else:
            self.memory_tokens[pid] = token
        return token

    def fetch(self, pid) -> dict:
        conn = self.connector(pid)
        cfg = self.config(pid)
        token = self.token(pid)
        if not token:
            raise ConnectorError(f"{conn.label} isn't connected.", kind="setup")
        try:
            if conn.token_expired(token):
                token = self._refresh(pid, conn, cfg, token)
            try:
                history = conn.fetch_history(cfg, token)
            except ConnectorError as exc:
                # An access token can be revoked before its stated expiry:
                # refresh once and retry, when the service gave us a refresh token.
                if exc.kind != "auth" or not token.get("refresh_token"):
                    raise
                token = self._refresh(pid, conn, cfg, token)
                history = conn.fetch_history(cfg, token)
        except ConnectorError as exc:
            self.last_error[pid] = str(exc)
            raise
        self._update(pid, last_sync=now_iso())
        self.last_error.pop(pid, None)
        return history
