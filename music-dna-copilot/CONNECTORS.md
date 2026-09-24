# Connector Plan

This repository is connector-ready, but the current MVP intentionally avoids fake access to private music accounts.

## Source status (authoritative)

| Source | Status |
|--------|--------|
| Demo data | **Live** |
| Manual input | **Live** |
| CSV / JSON upload | **Live** |
| Last.fm export file | **Live** (importer) |
| Spotify OAuth history | **Live** when Spotify is configured + connected (read-only) |
| Spotify Search candidates | **Live** when Spotify is connected (plain Search, labeled `spotify_search` in the pool); honest fallback to local catalog on any failure. Not Spotify's `/recommendations`, no audio-features, no write scopes. |
| Last.fm recent tracks | **Live** when `LASTFM_API_KEY` + username are set |
| Last.fm similar tracks | **Live** when configured (seeded from recent history, tag-enriched) |
| YouTube Music / Google Takeout | **Import-only / planned** — no live account connection |
| Apple Music | **Planned only** — requires Apple Developer token + MusicKit; no button |

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

## Apple Music connector (FUTURE / PLANNED — not implemented)

This is **not built** and there is no connect button in the app. If it is ever added it would require:

- Apple Developer token.
- MusicKit user authorization.
- Recently played / library / catalog access depending on granted permissions.
- Same normalized output schema as Spotify.

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
- Apple Music search (planned only);
- a curated genre database;
- an LLM-generated candidate list scored by local heuristics.

The recommendation engine itself always stays the transparent local heuristic; these
sources only widen the pool of candidate tracks it scores.

See `KNOWN_LIMITATIONS.md` for the current implemented-vs-not list.

## 2.2 connector matrix
- Spotify: live OAuth, read-only; top/recent + saved library + playlists + followed artists.
- Last.fm: live public API by username/API key; deep paginated scrobble history supported.
- YouTube / YouTube Music: Google Takeout import.
- Apple Music, Deezer, TIDAL, SoundCloud, Bandcamp, Yandex Music, Amazon Music, Qobuz, Pandora: local CSV/JSON export import today; live Apple Music is planned for 2.3 because it requires Apple developer authorization/credentials.

All sources normalize into one local Music DNA. Cross-service identity uses ISRC first when supplied, then conservative normalized title+artist matching.
