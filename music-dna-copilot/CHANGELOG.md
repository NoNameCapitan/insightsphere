# Changelog

## 2.4.0 — Adaptive Music DNA Brain

### Added
- Time-decayed behavior learning with separate history and feedback half-lives.
- Bounded genre, artist and context affinity vectors; repeated listening uses logarithmic weighting.
- Explicit/implicit signals: completed, save, replay, skip, not_for_me plus existing feedback.
- Adaptive novelty shift and bounded per-track learning adjustment.
- Explainable `dna_change_explanations` and learning confidence/evidence metadata.
- Regression tests for recency decay, positive/negative learning, novelty learning and explanation generation.
- Roadmap for 2.5 Capsules, 2.6 evaluation and 3.0 product UX.

### Safety/quality properties
- A single skip cannot dominate the profile; affinity uses tanh saturation and score movement is capped.
- Older behavior decays rather than disappearing abruptly.
- Learning remains local-first and transparent.


## 2.2.0 — Unified sources foundation + Music Capsules

### Added
- Spotify read-only scopes and ingestion for saved library, playlists and followed artists, in addition to top/recent listening.
- Last.fm deep-history pagination and optional timestamp range support.
- ISRC-first cross-service identity merge while retaining provider IDs per source.
- Music Capsules engine: Common (5), Rare (10), Legendary (15).
- Regression tests for cross-service identity and capsule sizing.
- `NEXT_VERSION_PLAN.md` for 2.3 → 3.0.

### Verified
- Full offline smoke/regression suite: 173 passed, 0 failed.


## 2.0.0 — Music DNA Copilot unified

Merges the multi-source branch (v1.4.0) into the V4 deep-genre/workspace branch. See `MERGE_NOTES.md`.

### Added
- YouTube / YouTube Music via Google Takeout file import in the local UI (json/html/csv; no login, no cookies).
- Last.fm export-file upload (offline) next to the existing username/API mode.
- Merged multi-source profile with transparent dedup, per-source coverage and High/Medium/Low confidence.
- Portable Music DNA export (JSON / Markdown / AI prompt) and the shareable Music DNA Card (`/export/dna-card`).
- **Genre enrichment** (`scripts/enrich_genres.py`, `data/artist_genre_seed.json`): fills genres for tagless
  tracks (same artist → offline map → optional Last.fm tags), marks them `genres_inferred`. On by default in the UI;
  offline-only in the Vercel demo (pasted lists now yield a real genre profile + confidence summary).
- `run_app.py` + `RUN_APP_WINDOWS.bat` / `RUN_APP_MAC.command` / `RUN_APP_LINUX.sh`; `start_*` delegate to it.
- Data page: "Clear imported sources"; full reset + release whitelist cover multi-source files.
- Tests: `test_genre_enrichment.py`; smoke now runs multi-source + enrichment suites and a live Takeout → merged UI run.

### Changed
- Brand: Music Taste Recommender → **Music DNA Copilot** (UI title in EN/RU/UK, launchers, release zip name).
  Spotify token directory name unchanged so existing saved logins keep working.
- Upload cap 8 → 64 MB (localhost only), for real Takeout exports.
- `test_multi_source.py` wrapped in `main()` (callable in-process by the smoke runner).


## Unreleased — V4 (in progress): deep genre engine + connectors

This is a multi-step upgrade. Landed so far; the rest is still planned (see roadmap).

### Added
- **Vercel demo UX + i18n pass.** `index.html` rewritten: calm dark theme, mobile-first
  (48px touch targets, sliders, chips), simple 3-step flow (Add your taste → Choose mood →
  Get recommendations), trilingual UI (Ukrainian default, Russian, English; auto-detect via
  browser language, remembered in localStorage). Ten one-tap presets (Post-metal/Doom/
  Sludge, Atmospheric Black Metal, Darkwave Night Walk, Dungeon Synth/Ambient, Night Drive,
  Dark Mystic Video, Focus: No Vocals, Heavy but Not Metalcore, Melancholic but Beautiful,
  Experimental Discovery) auto-fill mood/novelty/task/strictness/include/exclude. Advanced
  settings live in a collapsible; friendly localized error messages; honest collapsible
  "What works in this online demo" block. API and backend unchanged. Release artifact:
  `dist/music-taste-recommender-vercel-ux-i18n.zip`.
### Added
- **Vercel demo mode (hosted, stateless).** New `api/recommend.py` — a Vercel-native Python
  serverless function (`BaseHTTPRequestHandler` subclass `handler`, zero pip dependencies) —
  plus `api/_engine.py`, an in-memory wrapper that imports the existing
  `analyze_taste`/`generate_recommendations` functions directly: no HTTPServer, no
  127.0.0.1 binding, no writes to `outputs/`, no credentials. Static responsive `index.html`
  demo UI (demo / owner-demo / paste sources, mood/task/novelty/strictness/include/exclude,
  Music DNA summary, Safe/Adjacent/Wildcard with why+risk, copy JSON/Markdown).
  `vercel.json` bundles `scripts/`, `examples/`, `data/`, `schemas/` into the function.
  New `VERCEL_DEPLOY.md` explains why the local app failed on Vercel, the two modes, and why
  hosted Last.fm/Spotify needs a real auth/session/storage design (providers are honestly
  labeled local/self-test only in the demo). README documents both modes. The local
  self-test app is unchanged. Release artifact: `dist/music-taste-recommender-vercel-root-fixed.zip`.
### Added
- **Self-test pass (owner testing build).** New **/self-test** checklist screen with 8 guided
  cards (what to click, expected result, live-detected status, troubleshooting hint) covering
  demo, paste/owner-demo, Last.fm, Spotify, generation, feedback, report export, and data
  reset. New **Owner-style demo taste** source (`examples/demo_owner_taste.json`, 60 safe
  demo tracks across post-metal/doom/sludge, atmospheric black metal, darkwave, dungeon
  synth, dark ambient, industrial, and Ukrainian alternative) selectable on the home page.
  `START_HERE.md` rewritten as a practical 15-section guide; new `SELF_TEST_PLAN.md` (3-day
  plan + scoring table). "Not enough candidates" warning is now actionable. Release artifact
  renamed to `dist/music-taste-recommender-self-test.zip`; nested `.zip` files excluded.
### Added
- **Daily-use polish iteration.** Manual paste now accepts "Track by Artist", en-dash,
  tab-separated, and lines with leading list markers/quotes (in addition to "Track — Artist"
  / "Track - Artist"), with a clearer help line and placeholder. Five more built-in presets
  (Post-metal / Doom / Sludge, Dungeon Synth / Ambient, Focus: No Vocals, Heavy but Not
  Metalcore, Melancholic but Beautiful → 20 total). New `README_FOR_NORMAL_USER.md` and
  `docs/PROVIDER_SETUP.md` (Last.fm/Spotify setup, honest YouTube Music import-only and
  Apple Music future notes). Release script now bundles the new docs, excludes editor
  backups (`.bak`/`.tmp`/`.swp`), and stray backup files were removed from the tree.

  `dist/music-taste-recommender-rc.zip` (with `--dry-run`) that includes code, docs,
  examples, schemas, `data/genre_taxonomy.json`, `.env.example`, and start scripts — and
  **excludes** `.env`, `outputs/`, token files, caches, `__pycache__`, and all personal
  data (favorites/rejects/listen-later/shortlist/feedback/presets/reports).
  `scripts/release_check.py` is a safety gate that fails if any secret or personal file
  would ship. New `START_FOR_FRIEND.md` (non-technical quick start). Home now shows a
  "No accounts needed — try Demo Mode first" note and a quick-path line; Queue/Data pages
  have clearer empty states; footer is labeled "V4 RC · local-first · no accounts". App
  works fully offline with no `.env`/credentials (Demo, manual, CSV/JSON, presets).

  file with item counts/size/modified, export a personal-data **backup .zip**, clear
  individual lists or **Full reset** (confirmation required; keeps `.env`, Spotify token,
  code, examples, built-in presets). New `scripts/mtr_app/data_management.py`. New
  **manual quality check** (`scripts/manual_quality_check.py` -> `outputs/manual_quality_check.md`)
  running seven real scenarios with exclude/strict verification and blank verdict lines.
  `start_app.py --check` prints a full status report. Five more built-in presets (Calm
  Ambient, Aggressive Energy, Melancholy Evening, Workout, Experimental Discovery -> 15
  total). `suggest_next_action` gained detectors for small history, tagless candidates,
  Last.fm-unavailable, repeated rejects, and generic broad-mode results. New `DAILY_USE.md`.
  Smoke hardened against subprocess hangs: clean per-subprocess env, `start_new_session`
  + `os.killpg` on timeout, start/end progress logs with elapsed seconds, and a process-wide
  watchdog. New tests: `test_data_management.py` (18), `test_manual_quality_check.py` (11).
- **Personal Music DNA workspace.** Local presets (`personal_store.py`: 10 built-ins +
  custom, built-ins undeletable), per-result actions **Favorite / Listen later / Never /
  Shortlist** saved to `outputs/*.jsonl`, a **My Music Queue** page (`/queue`), a
  **Personal memory** card, and **feedback-aware scoring** (`generate_recommendations
  --personal-memory`): rejected exact tracks excluded, rejected artists/genres penalized,
  favorites/likes nudged up — never overriding strict genre exclusions. New **Music DNA
  report** (`music_dna_report.py`, 14 sections) exportable at `/export/dna-report`;
  shortlist exports as CSV/TXT. A light, payment-free **monetization layer**
  (`MONETIZATION.md`, `SUPPORT_URL` footer, `REPORT_BRANDING_NAME` on reports). Smoke test
  hardened against hangs (per-request timeouts, progress prints, `server_close`). New
  tests: `test_personal_store.py` (20), `test_personal_memory.py` (9),
  `test_music_dna_report.py` (23).
- **Last.fm tag enrichment** (`lastfm_client`: `get_track_top_tags`, `get_artist_top_tags`,
  `enrich_track_candidate`, `batch_enrich_candidates`) with a local cache at
  `outputs/cache/lastfm_tags_cache.json` (checked before network, bounded calls, de-duped
  lookups, never stores secrets). Sparse Last.fm candidates get track tags (fallback
  artist tags) so deep-genre filtering and strict mode work on them. Candidate confidence
  now ranks track-tagged > artist-tagged > tagless. The candidate-pool summary reports
  `enriched_candidate_count`, `tagless_candidate_count`, `tag_sources`, and
  `genre_metadata_quality` (high/medium/low), plus `lastfm_unavailable` /
  `tag_enrichment_failed` warnings. Spotify Search candidates are now honestly attributed
  as `spotify_search` (were mislabeled `local_catalog`). Profile Quality surfaces enriched
  vs. tagless counts and metadata quality; result cards show a soft note when a match
  leans on artist/tag similarity. New tests: `test_lastfm_tag_enrichment.py` (14),
  `test_user_scenarios.py` (15); `test_candidate_engine.py` now 25.
- **Live Last.fm connector** (`scripts/lastfm_client.py`, read-only; API key + username
  only — no password, no secret, no OAuth). Methods: `config_status`,
  `get_recent_tracks` (history source), `get_top_tracks`/`get_top_artists` (seeds),
  `get_similar_tracks`/`get_similar_artists` (discovery). All network calls have timeouts
  and degrade to clean errors; missing config never crashes the app. Tests:
  `scripts/test_lastfm_connector.py` (19, fully mocked/offline).
- **Last.fm wired into discovery.** `candidate_engine.make_lastfm_similar_provider`
  gained a `client=` path that seeds from recent history and fetches `track.getSimilar`
  (bounded by `lastfm_seed_limit`/`lastfm_candidate_limit`, deduped, known-tracks removed,
  source-attributed). Inactive unless a configured client is supplied — no fakes.
- **Last.fm in the browser UI**: a source card (username field + "use similar tracks"
  toggle + live status), usable as a history source and/or discovery source, with clean
  user-facing errors that point to Demo/Upload/Spotify on failure.
- **Music sources dashboard** clarifying what works now vs. planned (YouTube/Takeout
  import-only; Apple Music planned-only, no button).
- **Profile Quality card** after recommendations: sources used, tracks analyzed,
  listening events, detected genres, candidate-pool size + sources, high/medium/low
  confidence, and improvement tips. Exposed in `parameters.profile_quality` /
  `parameters.sources_used`; summarized in the Markdown and prompt exports.
- **Deep genre controls in the browser UI.** A collapsible "Genre direction" section
  (families/subgenres/microgenres with taxonomy-backed datalists, exclude genres,
  strictness soft/balanced/strict, discovery inside/adjacent/cross_genre, prefer_*
  toggles) feeds the engine through the existing pipeline. Result cards render
  `genre_reasoning` in a friendly form (matched genres, strictness result, why it
  matches / may not, compact score) instead of raw JSON. Old no-genre flow unchanged.
- **Candidate engine MVP** (`scripts/candidate_engine.py`): builds a pool from the local
  catalog with taxonomy genre normalization, dedup, per-source confidence, and
  known-track removal (kept only with `include_familiar`). Injectable, mock-tested hooks
  for Spotify Search and Last.fm similar exist but are inactive until a fetch function is
  provided (no fake connectors). The UI now shows a candidate-pool status line and a
  small-pool warning. Tests: `scripts/test_candidate_engine.py` (17),
  UI genre submission + candidate-pool checks added to `smoke_test.py`.
- **Deep genre mode wired through the recommendation engine (CLI/request level).**
  `generate_recommendations.py` accepts genre constraints via flags
  (`--genre-families/--genre-subgenres/--genre-microgenres/--exclude-genres`,
  `--strictness`, `--discovery`, `--prefer-*`) or a `--request-json` file. Output now
  carries a per-track `scoring_breakdown` (user_genre_affinity, requested_genre_match,
  taxonomy_distance, excluded_genre_penalty, mood/task/novelty, feedback, source
  confidence, diversity, total) and `genre_reasoning` (matched genres/subgenres/aliases,
  taxonomy distance, strictness result, why it matches / may not match). Strict mode
  filters out-of-scope tracks; exclusions are always removed; discovery direction
  (inside/adjacent/cross_genre) bounds how far results stray. Backward compatible: with
  no constraints the output is unchanged. Tests: `scripts/test_deep_genre_recommendations.py`.
- `examples/sample_deep_genre_request.json`; `.env.example` now includes Last.fm and
  Ollama-model keys (still no paid-API keys).
- **Deep genre taxonomy** (`data/genre_taxonomy.json`): 28 families (rock, metal,
  punk, electronic, hip-hop, pop, r&b, soul, jazz, classical, ambient, experimental,
  folk, country, reggae, latin, world, soundtrack, industrial, gothic, alternative,
  indie, k-pop, j-pop, ukrainian, phonk, synthwave, hyperpop) with subgenres,
  microgenres, aliases, mood tags, energy/valence ranges, contexts, and
  related/distant genres.
- **Taxonomy operations** (`scripts/genre_taxonomy.py`, stdlib only): alias
  normalization, family ↔ subgenre/microgenre resolution, parent→subtree expansion,
  related/adjacent expansion, strict matching, genre exclusion, and a taxonomy
  distance (0 exact → 0.25 sibling → 0.5 adjacent → 0.85 distant → 1.0 unrelated).
- **Schema** `schemas/genre_taxonomy.schema.json` and offline tests
  `scripts/test_genre_taxonomy.py` (23 checks), wired into `smoke_test.py`.

### Verified (Phase 0 reliability gate)
- `run_demo`, `smoke_test` (43/43, no hang), and `test_spotify_connector` (28/28) all
  pass; UI `/recommend` subprocesses are already bounded by `PIPELINE_STEP_TIMEOUT`
  (120s, `MTR_PIPELINE_TIMEOUT` override) and HTTP tests use a global socket timeout.

### Still planned for V4 (not yet implemented — do not assume present)
- Connector framework (`scripts/connectors/`) + registry/merge with source attribution.
- Source-coverage block inside the taste profile (the Profile Quality card now covers the
  user-facing summary).
- **`candidate_engine.make_spotify_search_provider` hook** remains mock/injectable only.
  (The live Spotify Search candidate path runs via `build_candidate_catalog` and is now
  correctly attributed as `spotify_search` in the candidate-pool summary.)
- Optional Spotify playlist export (opt-in write scopes); Apple Music (planned only).

## 3.0.1 — Audit fixes (reliability, data contracts, docs)

### Fixed
- **Reliable tests**: `smoke_test.py` subprocess calls now run with a hard
  timeout and print captured stdout/stderr on timeout (returning a synthetic
  failure instead of hanging); a global socket timeout prevents localhost HTTP
  calls from hanging; the lightweight schema validator now supports array-form
  JSON Schema types (e.g. `["number","null"]`).
- **Feedback data contract**: `schemas/feedback.schema.json` now matches exactly
  what `save_feedback()` writes to `outputs/feedback.jsonl` (`timestamp` + `action`
  required, plus `track_title/artist/genres/group/mood/task/experimentality/source/
  reason`). `examples/sample_feedback.json` updated to the same shape.
- **play_count correctness**: `analyze_taste.py` now weights genre affinity, artist
  recurrence, repetition pattern, mood profile, and taste drift by listening events
  (`play_count`) instead of treating every row equally.

### Added
- **Input validation + size limits**: uploaded/pasted/CSV histories are validated and
  sanitized (`validate_history`); request bodies are size-capped (8 MB uploads, 4 MB
  JSON, 100k tracks; `MTR_MAX_*` env overrides) and oversize requests return HTTP 413.
- **Regression tests**: play_count weighting, feedback-schema compatibility, and an
  oversize-body (413) check.
- **`KNOWN_LIMITATIONS.md`**: consolidated, honest implemented-vs-not list.

### Changed
- **Refactor**: `scripts/local_interface.py` split into `scripts/mtr_app/`
  (`i18n`, `io_http`, `spotify_state`, `validation`) with a thin façade; all routes
  and UI are unchanged.
- **Docs**: `README.md`, `roadmap.md`, `CONNECTORS.md` updated to match the
  implementation; removed the Spotify `/recommendations`-as-future-core-engine
  reference (it is deprecated and never the engine; Spotify remains an optional
  source only).

## 3.0.0 — V3: Product polish (local-first, still stdlib-only)

### Added
- **One-click launchers**: `scripts/start_app.py` + `start_mac.command`,
  `start_windows.bat`, `start_linux.sh`. Auto-open browser; if port 8765 is
  busy the next free port is used and announced; clear terminal banner with
  a Spotify fixed-redirect-URI note when the port differs.
- **UI languages**: English (default), Russian, Ukrainian — simple Python
  dictionaries, switcher in the top-right, choice kept via cookie. Headings,
  buttons, sources, mood/novelty/task labels, privacy text, errors, result
  and group titles are translated.
- **UX polish**: three clear entry paths (Start with demo / Connect Spotify /
  Upload my file), visible privacy note (what is analyzed, where it is
  stored, why Spotify asks permission), progress overlay during generation,
  localized actionable error messages, improved mobile layout.
- **Feedback buttons** under every recommendation (Like / Not for me /
  Too similar / Too strange / More like this) → appended to
  `outputs/feedback.jsonl` with timestamp, track, artist, genres, group,
  action, mood, task, experimentality, source, optional reason.
- **Feedback-aware scoring** in `generate_recommendations.py`
  (`--feedback`, `--no-feedback`): liked/“more like this” genres & artists
  boosted, “not for me” reduced, “too similar”/“too strange” shift novelty.
  Transparent caps: ±0.30/genre, ±0.40/artist, ±6 confidence points,
  ±0.15 novelty; adjustment visible in every `scoring_breakdown`.
  Documented in `ux/product_logic.md`.
- **Spotify candidate mode** (`spotify_connector.build_candidate_catalog`):
  optional checkbox when connected; seeds Spotify Search with top artists
  and genres, excludes already-known tracks, batch-resolves genres, honest
  fallback to `examples/sample_candidate_catalog.json` on any failure. No
  deprecated audio-features endpoints; no write scopes; limitations stated
  in the UI and docs.
- **Optional local AI**: `scripts/ollama_enhance.py` + “Enhance explanations
  with local AI” button. Detects Ollama at `127.0.0.1:11434`; sends only the
  Music DNA summary and recommendation list (never tokens/files); clean
  fallback message when unavailable; no paid API key.
- **Exports**: `outputs/recommendations_export.md` / `.json` written on every
  run; download links, copy-AI-prompt button, and search links on the result
  page.
- **Docs**: new `START_HERE.md` for non-technical users (start, demo,
  Spotify, uploads, slider meanings, data location, full deletion);
  README/DEMO/LOCAL_APP/SPOTIFY_SETUP updated.
- **Smoke tests**: `scripts/smoke_test.py` — 31 checks covering compilation,
  demo pipeline, CSV import, schema validation of the recommendation output,
  offline Spotify connector tests, UI rendering in all three languages,
  feedback/export/enhance endpoints, and free-port fallback. No credentials
  or network needed.

### Fixed
- Feedback JS used English labels regardless of UI language.
- `local_interface.py` rebuilt from interrupted in-progress fragments
  (`_ui_part1.py`/`_ui_part2.py` removed); all V2 routes preserved.

### Unchanged (constraints honored)
- Standard library only; no SaaS, accounts, payments, cloud storage,
  databases, Docker, or JS frameworks.
- V1/V2 CLI flags and pipeline untouched (`run_demo.py`, normalizers,
  `analyze_taste.py`, prompt generator all work as before).
- No fake Apple Music / phone-media access; Spotify remains explicit OAuth.


## 2.0.0 — V2: Real Spotify OAuth connector

### Added
- `scripts/spotify_connector.py` — Spotify OAuth via Authorization Code + PKCE
  (stdlib only, no client secret on the user's machine). CLI commands:
  `login [--remember] [--no-browser]`, `status`, `fetch`, `logout`.
  - Fetches `/me/top/tracks` (short/medium/long term) and `/me/player/recently-played`.
  - Batch-resolves artist genres via `/artists` (50 ids per call).
  - Aggregates repeated recent plays into `play_count`.
  - Outputs normalized history conforming to `schemas/listening_history.schema.json`.
- Spotify source in the local UI (`scripts/local_interface.py`):
  honest three-state block (not configured / connect / connected),
  `/spotify/login`, `/spotify/callback`, `/spotify/disconnect` routes,
  one-click pipeline from a live Spotify account.
- `scripts/env_loader.py` — tiny stdlib `.env` loader.
- `scripts/test_spotify_connector.py` — 28 offline tests (PKCE, token store,
  normalization with mocked API, pipeline compatibility). No network required.
- `SPOTIFY_SETUP.md` — step-by-step setup, scopes table, troubleshooting.
- `CHANGELOG.md`.

### Changed
- Token policy refined: tokens in memory by default; refresh token persisted only
  with explicit consent ("remember on this device" / `--remember`) to a
  `0600`-permission file in `~/.config/music-taste-recommender/`; disconnect deletes it.
- `.env.example`: PKCE notes, default redirect URI now
  `http://127.0.0.1:8765/spotify/callback` (same port as the local UI).
- Docs updated: `README.md`, `SKILL.md` (v2.0.0), `CONNECTORS.md`, `LOCAL_APP.md`,
  `roadmap.md`, `requirements.txt`.

### Fixed
- Pre-existing V1 bug: the local UI home page crashed on every request due to
  unescaped `{}` braces in an f-string placeholder (`pasted_json` textarea).

### Unchanged (architecture preserved)
- Standard-library-only constraint.
- Pipeline: normalize -> `analyze_taste.py` -> `generate_recommendations.py` -> prompt.
- All schemas (the `source` enum already included `"spotify"`).
- Local candidate catalog, scoring heuristics, UX docs, V1 import sources.

## 2.3.0
- Added unified Provider Adapter capability manifest.
- Added per-provider incremental sync cursor/state foundation.
- Added Identity Graph v2 with ISRC, MusicBrainz/provider IDs and conservative explainable fuzzy matching.
- Added Apple Music live-connector preparation without embedding credentials or pretending live authorization is complete.
- Added regression tests for provider adapter and Identity Graph v2.

## 2.5.0 — Capsules Core Loop
- Promoted Music Capsules from static packaging to stateful sessions.
- Added Common (5), Rare (10), Legendary (15), and Mystery (10) capsules.
- Added opened → started → completed/abandoned lifecycle validation.
- Added per-track completed/skip/save/replay/not_for_me events and capsule metrics.
- Added local JSONL capsule-history summaries.
- Added artist-diversity and recent-track/recent-artist exploration guardrails.
- Added preferred-provider metadata and cross-provider search/deep-link fallbacks.
- Mystery capsules redact artist/title until reveal while preserving learning identity.

## 2.6.0 — Recommendation Quality Lab
- Added independent offline recommendation evaluation: relevance proxy, diversity, novelty, catalog coverage, artist concentration, context fit and optional calibration.
- Added capsule outcome aggregation by rarity and context.
- Added bounded session-preference vectors that cannot mutate durable Music DNA.
- Recommendation output now includes an observational `quality_lab` block without changing ranking behavior.
- Added dedicated regression tests and quality documentation.


## 2.7.0 — Live Playback & Provider Routing
- Added deterministic Track Resolver with provider-ID/URI, ISRC, exact metadata and conservative fuzzy resolution.
- Added preferred-provider routing with enabled-provider fallback chain.
- Search fallback is explicitly distinguished from verified track resolution.
- Added resolver quality metrics for exact/fuzzy/search/unresolved outcomes.
- Capsules now include a per-track playback route and an explicit playback contract.
- Spotify known IDs/URIs deep-link directly; other providers use verified links when available.
- Apple Music remains credential-gated and is not falsely marked live.

## 2.8.0 — Privacy-first Beta Instrumentation
- Added local-only, allow-listed beta event instrumentation with no requirement for PII, raw listening history or track titles.
- Added the product funnel from session start through DNA generation, capsule use and completion.
- Added capsule outcome aggregation by rarity, 7-day return proxy and provider resolver-health reporting.
- Added deterministic control/challenger algorithm assignment for stable beta experiments.
- Added generated Beta Report data model and dedicated regression tests.
- Added `BETA_INSTRUMENTATION.md` with privacy, funnel and experiment contracts.
