"""
mtr_app.spotify_state
=====================
In-process Spotify connection state for the local UI. The Spotify connector
is optional; when it is unavailable every method degrades to "not configured".
"""

from urllib.parse import urlsplit

try:  # optional connector module (lives in scripts/)
    import spotify_connector
except Exception:  # pragma: no cover - connector module optional
    spotify_connector = None

class SpotifyState:
    """In-process Spotify connection state for the local UI."""

    def __init__(self):
        self.session = None          # spotify_connector.SpotifySession
        self.pending = {}            # oauth state -> (code_verifier, remember)
        self.last_error = ""

    def configured(self):
        if spotify_connector is None:
            return False
        try:
            spotify_connector.load_config()
            return True
        except Exception:
            return False

    def redirect_port(self):
        """Port that the registered Spotify redirect URI points to (or None)."""
        if spotify_connector is None:
            return None
        try:
            _, redirect_uri = spotify_connector.load_config()
        except Exception:
            return None
        parsed = urlsplit(redirect_uri)
        return parsed.port or (443 if parsed.scheme == "https" else 80)

    def restore_saved(self):
        if self.session is not None or spotify_connector is None:
            return
        try:
            client_id, redirect_uri = spotify_connector.load_config()
        except Exception:
            return
        saved = spotify_connector.SpotifySession.load_saved(client_id, redirect_uri)
        if saved:
            self.session = saved

    def connected(self):
        self.restore_saved()
        return self.session is not None and self.session.connected

SPOTIFY = SpotifyState()
