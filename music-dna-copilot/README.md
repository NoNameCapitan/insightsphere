# Music DNA Copilot 3.0 🧬🎧

> **3.0:** a new consumer app at `http://127.0.0.1:8765/` (guided onboarding, DNA map,
> capsules, history, sources, privacy centre). The 2.x workspace below lives on at
> `/classic`. See **RELEASE_NOTES_3_0.md** and **BASELINE_2_8.md**.


**Merge your listening history from Spotify, YouTube Music (Google Takeout), Last.fm and plain files into one private Music DNA profile — then get explainable, genre-aware recommendations tuned by mood, task and experimentality. 100% local, Python stdlib only.**

`local-first` · `no accounts` · `no cloud` · `no dependencies` · `EN / RU / UK`

2.0 unifies two lines of work (see **MERGE_NOTES.md**):

- **multi-source layer** (v1.4): YouTube Takeout + Last.fm export import, transparent cross-source merge, per-source coverage with an honest High/Medium/Low confidence, Portable Music DNA export, shareable Music DNA Card;
- **deep engine + workspace** (V4): genre taxonomy with strict/balanced/soft genre control, candidate pool engine, Last.fm similar tracks + tag enrichment, personal memory (favorites / rejects / queue / presets), Music DNA report, data management, self-test page, Vercel stateless demo;
- **new bridge:** *genre enrichment* — tracks that arrive without tags (YouTube, manual paste, many CSVs) get genres from the same artist in other sources, an offline genre map, or (optionally) Last.fm tags. Inferred genres are always marked as inferred.

**No account needed. Demo Mode works first. Last.fm and Spotify are optional.** Your data stays local in `outputs/`.

## Fastest way to start

| OS | Do this |
|---|---|
| **Windows** | double-click `RUN_APP_WINDOWS.bat` |
| **macOS** | double-click `RUN_APP_MAC.command` |
| **Linux** | run `./RUN_APP_LINUX.sh` |
| **Developer** | `python run_app.py` |

Browser opens at `http://127.0.0.1:8765` (next free port if busy; `MTR_PORT` overrides).
The older `start_*` launchers still work and call `run_app.py`.

**Two modes:**
- **Local app (full):** everything above, data in local `outputs/`.
- **Vercel demo (hosted, stateless):** `index.html` + `app.py` run the same engine in memory — demo / owner-demo / paste, with offline genre enrichment and a confidence summary. No accounts, nothing stored. See **VERCEL_DEPLOY.md**.

## Supported sources

| Source | How | Status |
|---|---|---|
| Demo / owner-style demo | one click | ✅ |
| Manual paste | "Track — Artist" lines | ✅ (+ genre enrichment) |
| CSV / JSON | upload | ✅ |
| Spotify | OAuth PKCE, read-only, your own Client ID | ✅ (`SPOTIFY_SETUP.md`) |
| Last.fm | username (free API key) **or** export file (offline) | ✅ (`LASTFM_SETUP.md`) |
| YouTube / YouTube Music | **Google Takeout file import** — no password, no cookies | ✅ |
| Merged profile | all imported sources, deduped, play counts summed | ✅ |
| Apple Music | — | ⏳ planned, not implemented |
| Local music folder | — | ⏳ planned, not implemented |

## Tests

```bash
python -m py_compile scripts/*.py
python scripts/smoke_test.py            # runs every suite (≈170 checks)
python scripts/test_multi_source.py
python scripts/test_genre_enrichment.py
python scripts/test_spotify_connector.py
python scripts/run_demo.py --mood 1 --task night_drive --novelty 4 --max 9
python scripts/make_release_zip.py && python scripts/release_check.py
```

---

## One-click local use

**For normal users:** double-click the launcher for your system —
`start_mac.command`, `start_windows.bat`, or `start_linux.sh`. The server
starts, a free port is chosen automatically (8765 by default), and your
browser opens the app. New here? Read **`START_HERE.md`** first.

**For developers:**

```bash
python scripts/local_interface.py [--port N] [--open]
```

Default address: `http://127.0.0.1:8765`.

Then use one screen (in English, Russian, or Ukrainian — switcher top-right):

1. choose a music source;
2. optionally upload/paste data;
3. set mood with a slider;
4. choose a task;
5. set experimentality with a slider;
6. click **Analyze and recommend in one click**.

The app creates:

```text
outputs/local_input_history.json
outputs/local_taste_profile.json
outputs/local_recommendations.json
outputs/local_recommendation_prompt.md
outputs/recommendations_export.md
outputs/recommendations_export.json
outputs/feedback.jsonl                  # your ratings (feedback-aware scoring)
```

### 2. Run the CLI demo

```bash
python scripts/run_demo.py
```

With custom settings:

```bash
python scripts/run_demo.py --mood 1 --task night_drive --novelty 4 --max 9
```

---

## What works now

Working features:

- **Spotify OAuth connector (V2)** — connect a real Spotify account (read-only)
  from the UI or CLI and analyze actual top tracks + recent plays
  (see `SPOTIFY_SETUP.md`);
- **play_count-aware analysis** — genre affinity, artist recurrence, repetition
  pattern, mood profile, and taste drift are weighted by listening events
  (`play_count`), so an aggregated history (e.g. Last.fm) reflects true emphasis
  instead of treating every row as a single play;
- **input validation + upload limits** — uploaded/pasted histories are validated
  and sanitized, and request bodies are size-capped (8 MB uploads, 4 MB JSON,
  100k tracks; tunable via `MTR_MAX_*` env vars) so a malformed or huge file
  fails cleanly instead of crashing;
- local browser interface (EN / RU / UK) with one-click launchers;
- progress indicator, clear localized errors, visible privacy note;
- feedback buttons (Like / Not for me / Too similar / Too strange / More like this)
  saved locally and gently adjusting future runs — transparently capped at ±6
  confidence points and ±0.15 novelty shift;
- optional Spotify candidate mode: candidates from Spotify Search seeded by your
  top artists/genres (honest fallback to the local catalog);
- **Last.fm connector (read-only, API key + username):** import recent scrobbles as a
  history source, and/or use Last.fm "similar tracks" to expand the candidate pool
  (see `LASTFM_SETUP.md`);
- **deep genre direction in the browser UI:** pick families/subgenres/microgenres, exclude
  genres, set strictness (soft/balanced/strict) and discovery (inside/adjacent/cross), with
  friendly per-track genre reasoning on each card;
- **candidate pool summary** (size + sources + small-pool warning) and a **Profile Quality
  card** (sources, tracks, genres, pool, confidence, and how-to-improve tips);
- **personal workspace:** saved presets, per-result Favorite / Listen later / Never /
  Shortlist, a "My Music Queue" page, feedback-aware scoring (hidden tracks excluded,
  favorites nudged), an exportable Music DNA report, and shortlist CSV/TXT export — all
  local files, no accounts;
- Markdown / JSON export and a copyable AI prompt;
- optional local-AI explanation enhancer via Ollama (no API key, fully optional);
- one-click analysis flow;
- demo library mode;
- manual mini-library input;
- normalized JSON upload;
- CSV upload/import;
- Music DNA profile generation;
- mood slider from `-2` to `+2`;
- task selector;
- experimentality slider from `1` to `5`;
- recommendations grouped into:
  - Safe Match;
  - Adjacent Discovery;
  - Wildcard;
- confidence score;
- reason why the user may like each recommendation;
- reason why the user may not like it;
- Spotify / YouTube / YouTube Music search links;
- AI prompt output for use in Manus, Claude, ChatGPT/Codex-style agents, or another LLM.

---

## What “experimentality” means

The experimentality slider controls the distance between the user's existing taste and the recommendation candidate:

```text
1 = only very similar music
2 = slightly new
3 = balanced
4 = more experimental
5 = surprise me
```

Internally this maps to a novelty distance from `0.1` to `1.0`.

A low value favors genre and artist overlap. A high value allows wider jumps across genres, moods, and artist familiarity.

---

## Deep genre mode (engine / CLI)

Deep genre direction is taxonomy-aware (`data/genre_taxonomy.json`). It works in the
**browser UI** (the "Genre direction" section) and via the recommendation engine's CLI
flags or a request file — both feed the same scorer.

Controls:

- **Selection**: `--genre-families`, `--genre-subgenres`, `--genre-microgenres`
  (comma-separated; aliases like `dnb`, `synth wave`, `atmo black metal` are normalized).
- **Strictness**: `--strictness soft|balanced|strict`
  - `soft` — selection is a hint; strong personal matches can still appear.
  - `balanced` (default) — strongly prefer the selection, penalize unrelated.
  - `strict` — only keep tracks inside the selected genres (per discovery direction).
- **Discovery**: `--discovery inside|adjacent|cross_genre`
  - `inside` — stay on the exact selected genres.
  - `adjacent` (default) — allow taxonomy-related genres.
  - `cross_genre` — allow wider jumps (still explained).
- **Exclusions**: `--exclude-genres metalcore,deathcore` (always removed).
- **Preferences**: `--prefer-obscure/--prefer-popular/--prefer-instrumental/--prefer-vocal/--prefer-ukrainian`.
- Or pass a full request file: `--request-json examples/sample_deep_genre_request.json`.

Example — "atmospheric black metal but not deathcore":

```bash
python scripts/generate_recommendations.py outputs/local_taste_profile.json \
  --mood -1 --task dark_mystic_video --novelty 3 \
  --genre-subgenres "atmospheric black metal" --exclude-genres "deathcore,metalcore" \
  --strictness strict --discovery adjacent --output outputs/recs.json
```

Every recommendation then includes a `scoring_breakdown` and a `genre_reasoning`
block (matched genres/subgenres/aliases, taxonomy distance, strictness result, and a
plain-language "why it matches / why it may not match"). Note: with the current small
local catalog, strict narrow selections can return few results; the candidate engine
(local catalog + optional Last.fm similar tracks + Spotify Search) expands the pool when
more sources are enabled.

## Privacy model

By default:

- everything runs locally;
- no account is required;
- no API call is made;
- no OAuth token is stored;
- no listening history is uploaded anywhere;
- imported files stay in the local `outputs/` folder.

When you explicitly connect Spotify (V2):

- the OAuth flow runs through Spotify's own consent screen, read-only scopes only;
- tokens stay in memory unless you choose “remember on this device”, which stores the
  refresh token in `~/.config/music-taste-recommender/spotify_tokens.json` (0600);
- fetched history is written only to local `outputs/spotify_history.json`;
- Disconnect (UI) or `spotify_connector.py logout` (CLI) deletes the stored token.

This repository does **not** fake account access.

---

## Supported input formats

### 0. Spotify account (OAuth, V2)

One-time setup in `SPOTIFY_SETUP.md`, then either connect from the UI, or:

```bash
python scripts/spotify_connector.py login --remember
python scripts/spotify_connector.py fetch
```

Produces `outputs/spotify_history.json` in the normalized schema.

### 1. Demo data

Use the included sample history:

```text
examples/sample_listening_history.json
```

### 2. CSV import

Required columns:

```text
track_name, artist_name
```

Optional columns:

```text
album_name, played_at, play_count, genres, energy, valence, danceability, tempo, acousticness, instrumentalness, time_range
```

Run:

```bash
python scripts/normalize_csv_import.py examples/sample_csv_import.csv outputs/normalized_csv.json
```

### 3. Normalized JSON

Use the schema:

```text
schemas/listening_history.schema.json
```

### 4. Manual input

In the local interface, paste tracks as:

```text
Nightcall — Kavinsky
Midnight City — M83
Intro — The xx
```

Optionally add genre hints:

```text
synthwave, electronic, indie, ambient
```

---

## Project structure

```text
music-taste-recommender/
  SKILL.md
  README.md
  AI_SKILL_USAGE.md
  LOCAL_APP.md
  CONNECTORS.md
  DEMO.md
  requirements.txt
  .env.example
  .gitignore
  schemas/
  scripts/
  examples/
  ux/
  roadmap.md
```

Important scripts:

```text
scripts/local_interface.py              # local browser UI façade (routes + rendering)
scripts/mtr_app/                        # internal modules split out of local_interface:
scripts/mtr_app/i18n.py                 #   UI language strings + helpers
scripts/mtr_app/io_http.py              #   request parsing + upload/body size limits
scripts/mtr_app/spotify_state.py        #   in-process Spotify connection state
scripts/mtr_app/validation.py           #   history validation / sanitization
scripts/spotify_connector.py            # V2 Spotify OAuth connector (PKCE)
scripts/test_spotify_connector.py       # offline tests for the connector
scripts/env_loader.py                   # tiny stdlib .env loader
scripts/run_demo.py                     # one-command CLI demo
scripts/analyze_taste.py                # Music DNA generator (play_count-weighted)
scripts/generate_recommendations.py     # transparent local recommendation engine
scripts/generate_recommendation_prompt.py
scripts/normalize_csv_import.py
scripts/normalize_spotify_export.py
scripts/normalize_lastfm_export.py
scripts/smoke_test.py                   # end-to-end + regression tests
```

---

## Candidate catalog

The local recommendation engine needs a candidate catalog. By default it uses the
bundled local catalog:

```text
examples/sample_candidate_catalog.json
```

Optionally, when you connect Spotify, you can switch on **Spotify-search candidates**:
the app seeds Spotify Search with your top artists/genres to build a fresh candidate
catalog, and falls back to the local catalog if anything fails. This is plain catalog
search scored by the local heuristics — it is **not** Spotify's own recommendation
algorithm (and Spotify's audio-features endpoint is no longer available to new apps,
so matching leans on genres). Other candidate sources (Last.fm similar tracks, Apple
Music, a curated database, or an LLM-generated list scored locally) remain future work.

---

## AI skill mode

Use this repository as an AI skill by giving an agent:

```text
SKILL.md
schemas/
examples/
ux/product_logic.md
scripts/generate_recommendation_prompt.py
```

Then ask:

```text
Use the music-taste-recommender skill. Analyze this listening history, apply mood=1, task=night_drive, novelty=4, and generate explainable recommendations grouped into Safe Match, Adjacent Discovery, and Wildcard.
```

See `AI_SKILL_USAGE.md` for a longer copy-paste instruction.

---

## Limitations

Current limitations:

- no Apple Music connector yet;
- no direct phone media-library scanning;
- no automatic playlist creation yet;
- the Spotify candidate mode uses plain catalog search, not Spotify's
  recommendation algorithm — quality is honest but not Spotify-level;
- Spotify audio features (energy/valence) are unavailable to new apps since Spotify
  deprecated the public endpoint; the analyzer falls back to genre heuristics;
- `play_count`-weighted analysis only reflects real emphasis when the source
  provides `play_count`; sources without it count each row as one listening event;
- uploaded/pasted histories are size-capped (8 MB uploads, 4 MB JSON bodies,
  100k tracks) so very large libraries must be trimmed or imported via the CLI;
- search links open external services but do not auto-play music.

See **`KNOWN_LIMITATIONS.md`** for the full, current list of what is and isn't implemented.

These limitations are intentional. The current goal is a working local skill and prototype, not a full SaaS.

---

## Roadmap

### V1: Current local MVP

- Local UI.
- One-click local pipeline.
- CSV / JSON / manual import.
- Music DNA.
- Mood / task / experimentality controls.
- Explainable recommendations.

### V2–V3 polish: shipped

- [x] Spotify OAuth (PKCE).
- [x] Candidate catalog from Spotify Search (optional, honest fallback).
- [x] Feedback memory (local JSONL + transparent score adjustment).
- [x] One-click launchers, EN/RU/UK UI, exports, optional local AI (Ollama).

### Still ahead (future / planned only)

- Apple Music (requires Apple Developer token + MusicKit auth).
- Spotify playlist export (would request a write scope only when implemented).
- YouTube Music live connection; cloud sync; accounts; payments.

(Last.fm read-only — recent tracks, similar tracks, and tag enrichment — is already implemented.)

### V3: Product version

- Apple Music connector.
- Mobile app or desktop wrapper.
- Local media metadata import.
- AI-video / TikTok / Reels music matching.
- Account system only if needed.


### Vercel entrypoint note

The hosted demo uses `api/index.py` as the default Vercel Python entrypoint, re-exporting `api/recommend.py:handler`. The frontend calls `/api`.

### Vercel root routing note

For the Vercel demo build, the root URL `/` must show the visual demo UI. The API is available at `/api`. If you see raw JSON on the main URL, you deployed an older archive or selected the wrong root folder in Vercel.
