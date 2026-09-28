# Connector Plan

This repository is connector-ready, but the current MVP intentionally avoids fake access to private music accounts.

## Source status (authoritative, 3.1)

| Source | Live connection | Setup once | What is read |
|--------|-----------------|------------|--------------|
| Spotify | ✅ OAuth PKCE (`spotify_connector.py`) | free Spotify app Client ID (paste on Sources page or `.env`) | top, recent, saved, playlists, followed artists |
| Last.fm | ✅ API (`lastfm_client.py`) | username + free API key | recent scrobbles, similar tracks |
| ListenBrainz | ✅ public API (`connectors/listenbrainz.py`) | user name only | latest 5,000 listens |
| Deezer | ✅ OAuth (`connectors/deezer.py`) | your Deezer app ID + secret | listening history + favourite tracks |
| YouTube Music | ✅ Google OAuth PKCE + YouTube Data API (`connectors/youtube_music.py`) | Google "Desktop app" OAuth client | liked videos in the Music category |
| Apple Music | ✅ MusicKit JS sign-in (`connectors/apple_music.py`) | Apple Developer MusicKit key (.p8) or a developer token | recently played, heavy rotation, library songs |
| TIDAL / SoundCloud / Amazon Music / Qobuz / Bandcamp / Yandex Music / Pandora | ❌ no usable public API (each card says why) | — | export import only |
| Demo, manual, CSV/JSON, Google Takeout, Apple/Spotify/Last.fm exports | import | — | the file you choose |

All live connectors are **read-only**. After the one-time setup, **Connect** is one click:
the service shows its own consent screen, sends the browser back to
`http://127.0.0.1:<port>/connect/<service>/callback` (Spotify: `/spotify/callback`), and
the first sync runs automatically.

### Why "one click" needs a one-time setup
Every service above except ListenBrainz and Last.fm-by-username only lets *registered
apps* read an account. A local app has no central server, so each person registers a
free app once. The setup form shows the exact redirect address to register, with a Copy
button, and links to the developer page. A hosted zero-setup version would require one
operator-owned app per service, public OAuth callbacks and encrypted per-user token
storage; that contradicts the local-first design and is not built.

### Storage and privacy
- Credentials you paste and (when "Stay connected on this computer" is on) tokens are in
  `~/.config/music-taste-recommender/connectors.json` (`MTR_CONFIG_DIR` overrides), mode 0600.
  Without "stay connected", tokens live in memory until the app stops.
- Sign-in states are single-use and expire after 10 minutes. OAuth uses PKCE where the
  service supports it (Spotify, Google).
- Live syncs are written to `outputs/live/<service>.json`, separate from imports.
- Settings → Privacy & Data → **Forget all connections** deletes every saved credential and
  token; revoke on the service's side from your account's connected-apps page.

### Apple Music specifics
The developer token (ES256 JWT, six months) is signed on your computer from the .p8 key
(`connectors/es256.py`, RFC 6979 deterministic nonces, verified against OpenSSL). The
MusicKit page (`web/connect-apple.html`) is the only page allowed to load a third-party
script: `https://js-cdn.music.apple.com` (Content-Security-Policy scoped to that page).

## Current working inputs

- Demo library.
- Manual mini-library.
- Normalized JSON upload.
- CSV upload.
- Last.fm / Spotify export normalization scripts.
- **Spotify OAuth connector (V2, implemented).**

## Spotify V2 connector — IMPLEMENTED

Implemented in `scripts/spotify_connector.py` + the local UI (`scripts/local_interface.py`):

- OAuth Authorization Code with PKCE (no client secret on the user's machine).
- Read-only scopes: `user-top-read`, `user-read-recently-played`.
- Token storage: in-memory by default; refresh token persisted only after explicit
  consent ("remember on this device" / `--remember`), file written with `0600` permissions.
- Spotify's own consent screen + honest connector states in the UI.
- Disconnect action in the UI and `logout` CLI command; full revocation via the
  Spotify account page.

Output is normalized listening history compatible with:

```text
schemas/listening_history.schema.json
```

Setup guide: `SPOTIFY_SETUP.md`. Still on the roadmap for Spotify: playlist export
and a Spotify-search-based candidate catalog.

## Apple Music connector — IMPLEMENTED in 3.1

See "Apple Music specifics" above and `scripts/connectors/apple_music.py`. It needs an
Apple Developer MusicKit key (Apple's requirement); without one, import the Apple
privacy export (Play Activity CSV).

## Local device media

Direct scanning of local phone storage is not part of the web MVP. Safer options:

- user-selected file import;
- exported playlists;
- CSV / JSON import;
- desktop wrapper with explicit folder selection;
- mobile app with explicit system permissions.

## Candidate catalog

To recommend tracks, the engine needs candidate tracks to score.

Current candidate sources:

- **Local catalog** (default): `examples/sample_candidate_catalog.json`.
- **Spotify Search** (optional, implemented): when Spotify is connected, the app can
  seed Spotify Search with your top artists/genres to build a fresh candidate catalog
  (`build_candidate_catalog`), with an honest fallback to the local catalog on any
  failure. This is plain search scored by the local heuristics — **not** Spotify's own
  `/recommendations` algorithm, which is deprecated for new apps and is intentionally
  not a dependency. No audio features are used (that endpoint is also deprecated), so
  matching leans on genres.

- **Last.fm similar** (optional, implemented): when `LASTFM_API_KEY` + a username are
  configured and you enable "use Last.fm similar tracks", the app seeds from your recent
  scrobbles and fetches `track.getSimilar` to widen the pool (bounded, deduped,
  known-tracks removed, source-attributed). Read-only; API key + username only. See
  `LASTFM_SETUP.md`.

Future candidate sources:

- live Spotify Search candidate fetch (hook present, mock-tested, not yet wired live);
- Apple Music catalog search (not built; the Apple connector reads your library and history only);
- a curated genre database;
- an LLM-generated candidate list scored by local heuristics.

The recommendation engine itself always stays the transparent local heuristic; these
sources only widen the pool of candidate tracks it scores.

See `KNOWN_LIMITATIONS.md` for the current implemented-vs-not list.

## 2.2 connector matrix
- Spotify: live OAuth, read-only; top/recent + saved library + playlists + followed artists.
- Last.fm: live public API by username/API key; deep paginated scrobble history supported.
- YouTube / YouTube Music: Google Takeout import.
- Apple Music, Deezer, TIDAL, SoundCloud, Bandcamp, Yandex Music, Amazon Music, Qobuz, Pandora: local CSV/JSON export import (2.2). Live Apple Music and Deezer arrived in 3.1; see the table at the top.

All sources normalize into one local Music DNA. Cross-service identity uses ISRC first when supplied, then conservative normalized title+artist matching.
