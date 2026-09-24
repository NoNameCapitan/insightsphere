# Product Roadmap: Music DNA Copilot

This document outlines the development phases for the Music Taste Recommender. It
is local-first and privacy-first by design: the core recommendation engine is a
transparent, explainable heuristic that runs entirely on the user's machine. The
roadmap is about widening inputs and polish around that engine — not replacing it
with a black box.

## 2.x — where the idea goes next

2.0 answered "one private profile from all my sources". The next step is making that
profile **useful over time, between people, and inside AI tools** — without accounts,
servers, or write access to anyone's streaming library.

| # | Feature | Why | New code | Surface | Size |
|---|---|---|---|---|---|
| 2.1 | **DNA Timeline** | taste changes; merged history already has timestamps | `scripts/dna_timeline.py` — bucket history by quarter → mini-profiles → drift (genre deltas, energy/valence trend) | `GET /timeline`, card "then vs now" | M |
| 2.2 | **DNA Compare / Blend** | Portable DNA is a file — two files can meet | `scripts/dna_compare.py` — genre cosine, shared/unique artists, "bridge" recs scored against both profiles | `POST /compare` (upload friend's `portable_music_dna.json`), Blend card | M |
| 2.3 | **Playlist export (files only)** | "now what do I do with 9 picks?" | `scripts/export_playlist.py` — M3U8, CSV, Markdown with Spotify/YouTube Music search links | buttons on results + queue | S |
| 2.4 | **Whole-Takeout import** | users download a .zip, not one JSON | `import_youtube_takeout.import_zip()` via `zipfile`; streaming JSON for >64 MB | same Takeout card accepts `.zip` | S |
| 2.5 | **Local MCP server** | ask Claude "what's my Music DNA?" / "3 tracks for night drive" | `mcp_server.py` — stdio JSON-RPC, stdlib; tools: `get_dna`, `recommend`, `explain`, `add_feedback` | Claude Desktop / Claude Code config snippet | M |
| 2.6 | **Creator mode** | tiktok_reels / ai_video tasks exist but give generic picks | task presets with tempo/energy windows + "check licensing" reminder in output | preset chips | S |

Constraints stay the same: stdlib only, local only, read-only connectors, no fake Apple Music.

### Technical debt to pay alongside

- `local_interface.py` (~2.4k lines): move page renderers to `mtr_app/render_*.py` (routes unchanged).
- Two Last.fm paths: fold `import_lastfm` API mode into `lastfm_client`; keep only file parsing there.
- Coverage (sources) vs profile quality (run) — show as one "Profile health" card with two tabs.
- Grow `data/artist_genre_seed.json` from users' own enriched runs (opt-in "save these genres locally").

## Phase 1: MVP — DONE
The MVP established the core logic, data structures, and recommendation heuristics
without paid APIs or backend infrastructure.

- [x] Define JSON schemas for data interchange.
- [x] Create mock data and example outputs.
- [x] Implement Spotify export / mock Spotify input normalizer.
- [x] Implement Last.fm / CSV / JSON import normalizers.
- [x] `analyze_taste.py` generates the Music DNA profile (now `play_count`-weighted).
- [x] Mood slider (-2..+2), task selector, and novelty slider (1..5) logic.
- [x] `generate_recommendations.py` with transparent heuristic scoring.
- [x] Explainable recommendations grouped into Safe Match, Adjacent Discovery, Wildcard.
- [x] Document UX flows and UI copy.

## Phase 2: Connected & polished — MOSTLY DONE
This phase turned the prototype into a usable local app with a real, opt-in
account connection.

- [x] **Real Spotify OAuth**: Authorization Code + PKCE, local UI and CLI,
  opt-in token persistence, read-only scopes (`scripts/spotify_connector.py`).
- [x] **Feedback memory**: Like / Not for me / Too similar / Too strange / More
  like this, stored locally in `outputs/feedback.jsonl` and aggregated into the
  next run's scoring, transparently capped (±6 confidence points, ±0.15 novelty).
- [x] **Local web UI**: mobile-friendly single screen, EN/RU/UK, one-click launchers,
  Markdown/JSON export, copyable AI prompt, optional local-AI (Ollama) explanations.
- [x] **Candidate catalog from Spotify Search** (optional): seeded by the user's top
  artists/genres, with an honest fallback to the local catalog.
- [ ] **Playlist export**: write generated recommendations back to Spotify as a
  playlist. This is the one feature that needs a write scope, which will be
  requested only when the feature ships.

### Explicitly NOT planned (keeps the product local-first)
- **No user accounts / no server-side profiles.** Profiles live in local files; the
  only credential is the optional, user-held Spotify refresh token.
- **No Spotify `/recommendations` engine.** The core engine stays the transparent
  local heuristic. (Spotify has also deprecated `/recommendations` and the
  audio-features endpoint for new apps, so it is not a viable dependency anyway.)
  Spotify is used only as an optional *source* of listening history and candidate
  tracks, never as the recommender.

## Phase 3: Ecosystem expansion — FUTURE
- [ ] **Apple Music connector**: MusicKit integration (requires Apple Developer account).
- [ ] **Local music file metadata import**: scan local MP3/FLAC libraries with explicit,
  per-folder user permission to build profiles from offline collections.
- [x] **Last.fm account connector** (read-only API: recent tracks + similar tracks +
  tag enrichment; API key + username only). See `LASTFM_SETUP.md`.
- [ ] **Desktop wrapper / mobile app**: package the local experience with explicit
  system permissions, preserving the local-first model.
- [ ] **Content-creator flows**: AI video, TikTok, and Reels music matching.
- [ ] **Adaptive playlists**: auto-update by time of day, mood, or shifting taste drift.

## Phase 4 (V4): Deep genre engine + serious connectors — IN PROGRESS
A larger upgrade toward a connector-ready, deep-genre recommendation copilot.

- [x] **Deep genre taxonomy**: `data/genre_taxonomy.json` (28 families with
  subgenres/microgenres/aliases/mood/energy/valence/contexts/related/distant),
  `scripts/genre_taxonomy.py` operations, schema, and tests.
- [x] **Reliability gate**: bounded pipeline subprocesses + non-hanging HTTP tests.
- [ ] **Connector framework**: `scripts/connectors/` (base, registry, providers for
  Spotify/Last.fm/file/manual/YouTube-Takeout/Apple) with capabilities + merge and
  per-track source attribution. (Spotify real; YouTube/Apple import-only or planned —
  never faked.)
- [x] **Source coverage & profile quality**: a Profile Quality card after recommendations
  with sources used, tracks/events/genres, candidate-pool size + sources, high/medium/low
  confidence, and concrete "how to improve" tips.
- [x] **Deep-genre UI + scoring**: family/subgenre/microgenre selection, strictness
  (soft/balanced/strict), genre exclusion, discovery direction (inside/adjacent/cross),
  wired into the recommendation request schema and the scorer with genre-reasoning
  fields in the output.
- [x] **Candidate engine**: `scripts/candidate_engine.py` pooling local + (live) Last.fm
  similar + injectable Spotify-Search hook, deduped and taxonomy-normalized.
- [x] **Last.fm API source** (optional, API key + username; read-only, no fake auth):
  `scripts/lastfm_client.py` — recent tracks as history + similar tracks for discovery.
- [ ] **Optional Spotify playlist export** behind explicit opt-in write scopes.

See `KNOWN_LIMITATIONS.md` for the current, honest list of what is and isn't implemented.
