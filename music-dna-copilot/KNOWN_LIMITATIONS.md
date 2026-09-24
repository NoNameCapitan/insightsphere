# Known Limitations

An honest description of what the Music Taste Recommender does and does not do today.
The project is a local-first, privacy-first prototype with a transparent recommendation
engine — not a SaaS and not a Spotify replacement.

## What is implemented

- Local browser UI (EN/RU/UK) and a CLI demo, both fully offline by default.
- Sources: demo library, manual mini-library, normalized JSON upload, CSV upload,
  pasted JSON, and Last.fm/Spotify export normalizers.
- Spotify OAuth (Authorization Code + PKCE, read-only), optional token persistence.
- `play_count`-weighted Music DNA analysis (genre affinity, artist recurrence,
  repetition pattern, mood profile, taste drift).
- Transparent heuristic recommendations grouped into Safe Match / Adjacent Discovery /
  Wildcard, each with a confidence score and "why / why not" explanation.
- Local feedback memory (`outputs/feedback.jsonl`) that gently and transparently
  nudges later runs.
- Input validation/sanitization and request size limits on uploads and JSON bodies.
- Markdown/JSON export, a copyable AI prompt, and optional local-AI (Ollama) text.

## Implemented but with caveats

- **Spotify audio features (energy/valence/tempo) are not available.** Spotify
  deprecated the public audio-features endpoint for new apps, so when analyzing a
  Spotify source the engine falls back to genre-based mood/energy heuristics.
- **Spotify candidate mode is plain Search, not Spotify's recommender.** The optional
  "use Spotify catalog for candidates" mode seeds Spotify Search with your top
  artists/genres. It is honest but not Spotify-algorithm quality, and it falls back to
  the local catalog on any error.
- **Recommendations are limited to the candidate catalog.** With the bundled local
  catalog (~46 tracks), results are drawn from that pool; quality scales with the
  catalog you provide.
- **`play_count` weighting needs `play_count` in the data.** Sources that don't supply
  it (e.g. a plain track list) are treated as one listening event per row.
- **Feedback is a bounded nudge, not learning.** It is capped at ±6 confidence points
  and ±0.15 novelty shift; it cannot override your taste profile.
- **Upload size limits.** Defaults: 8 MB multipart uploads, 4 MB JSON bodies, 100k
  tracks per history (override via `MTR_MAX_UPLOAD_BYTES`, `MTR_MAX_JSON_BYTES`,
  `MTR_MAX_TRACKS`). Larger libraries must be trimmed or processed via the CLI.
- **Search links don't auto-play.** They open Spotify/YouTube/YT Music search results;
  playback happens in those services.

## Not implemented (by design or future work)

- **No user accounts and no server-side storage** — by design, to keep the product
  local-first. The only stored credential is the optional, user-held Spotify token.
- **No Spotify `/recommendations` engine** — the core recommender is intentionally the
  local transparent heuristic; Spotify is only an optional source of history and
  candidate tracks. (That endpoint is deprecated for new apps regardless.)
- **No Apple Music connector** — would require an Apple Developer token + MusicKit.
- **No direct phone/desktop media-library scanning** in this build — safer options are
  user-selected file import, exported playlists, or a future desktop wrapper with
  explicit per-folder permission.
- **No playlist export to Spotify yet** — this is the one planned feature that will
  need a write scope, requested only when it ships.
- **No native mobile app.**

## Deep genre mode (V4)

- The deep genre taxonomy (`data/genre_taxonomy.json`) + operations
  (`scripts/genre_taxonomy.py`) are implemented and tested.
- Deep genre works **through the recommendation engine and the browser UI**: the
  "Genre direction" section feeds families/subgenres/microgenres, exclusions,
  strictness, discovery direction, and prefer_* toggles into scoring; result cards show
  `genre_reasoning`. Strict filtering, exclusion, and adjacency are covered by tests.
- Still limited: candidate-pool size. Strict/narrow selections can return few results
  because the live discovery sources are not wired yet (see below).

## Candidate pool (V4)

- `scripts/candidate_engine.py` builds the pool with taxonomy genre normalization, dedup,
  per-source confidence, and known-track removal (kept only with `include_familiar`). The
  UI shows pool size, sources, genre-metadata quality, and warnings.
- **Live sources:** the local catalog; **Spotify Search** candidates when Spotify is
  connected (labeled `spotify_search`, plain Search scored by local heuristics — not
  Spotify's `/recommendations`, no audio-features, no write scopes); and **Last.fm similar
  tracks** when `LASTFM_API_KEY` + a username are configured and the user enables them.
- **Candidate quality depends on metadata and pool size.** A small pool (e.g. local-only)
  or sparse genre tags will narrow or weaken strict deep-genre results — the app says so
  via the small-pool warning, `genre_metadata_quality`, and the Profile Quality card.
- **Last.fm tag enrichment improves genre coverage but does not guarantee precision.**
  Not every track/artist has tags, tags can be noisy or non-genre, and enrichment is
  bounded per run; tagless candidates remain usable at lower confidence.

## Privacy posture

Everything runs locally; no analytics, no uploads. Spotify is reached only through its
own consent screen with read-only scopes, and disconnecting deletes any stored token.


## Multi-source + genre enrichment (2.0)

- YouTube Takeout history has no genres and noisy titles; non-music videos are skipped heuristically and
  uncertain rows get lower confidence. Genres for these rows are **inferred** (enrichment) and marked so.
- The offline artist→genre seed is small and hand-curated; unknown artists stay without genres unless
  Last.fm tags are enabled (`LASTFM_API_KEY`), capped at 40 lookups per run (cached afterwards).
- Merging dedups by normalized "title + artist"; different recordings with identical names will merge.
- Very large Takeout files (>64 MB) must be trimmed or raise `MTR_MAX_UPLOAD_BYTES`; whole-archive `.zip`
  import is planned (roadmap 2.4).
