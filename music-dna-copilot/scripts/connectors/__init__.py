"""Live, read-only connectors to music services.

Spotify and Last.fm keep their original modules (spotify_connector.py,
lastfm_client.py); this package adds the rest behind one contract plus a
shared manager for one-time setup, sign-in state and tokens. See
connectors/base.py for the honesty and storage rules.
"""
from __future__ import annotations

from .base import Connector, ConnectorError, ConnectorManager
from . import apple_music, deezer, listenbrainz, youtube_music


class SpotifySetup(Connector):
    """Only the one-time setup of Spotify lives here (Client ID from the UI
    instead of .env). The OAuth flow itself stays in spotify_connector.py."""

    id = "spotify"
    label = "Spotify"
    auth = "spotify"
    fields = [{"name": "client_id", "label": "Client ID", "required": True,
               "help": "From your app's page in the Spotify developer dashboard. No secret needed (PKCE)."}]
    dashboard_url = "https://developer.spotify.com/dashboard"
    setup_steps = [
        "Open the Spotify developer dashboard and click “Create app” (free, about two minutes).",
        "Add the Redirect URI shown below exactly, and tick “Web API”.",
        "Open Settings → User Management and add the Spotify accounts that will connect (apps start in development mode).",
        "Paste the Client ID here.",
    ]
    reads = "Top tracks, recently played, saved songs, playlists and followed artists."
    limits = "Spotify apps in development mode only work for accounts added under User Management."


REGISTRY = {c.id: c for c in (listenbrainz.CONNECTOR, deezer.CONNECTOR, youtube_music.CONNECTOR,
                              apple_music.CONNECTOR, SpotifySetup())}

# Providers whose connection is handled by this package end to end.
LIVE_IDS = ("listenbrainz", "deezer", "youtube_music", "apple_music")

MANAGER = ConnectorManager(REGISTRY)

__all__ = ["Connector", "ConnectorError", "ConnectorManager", "REGISTRY", "LIVE_IDS", "MANAGER"]
