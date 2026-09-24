---
name: music-taste-recommender
description: >-
  Local-first, privacy-first Music DNA analyzer and explainable recommender.
  Use to analyze listening history from Spotify, Last.fm, YouTube Music (Google
  Takeout), CSV, JSON or a pasted track list — separately or merged into one
  multi-source profile — build a plain-language Music DNA with source coverage
  and confidence, and recommend Safe Match / Adjacent Discovery / Wildcard picks
  tuned by mood (-2..+2), task, experimentality (1..5) and genre constraints.
  Python 3.10+, standard library only. Never fakes streaming-account access.
---

# Music DNA Copilot — Music Taste Skill

## Metadata

- **Name:** `music-taste-recommender`
- **Version:** 2.0.0 (Music DNA Copilot unified: multi-source + deep genre engine)
- **Mode:** local AI skill + polished local browser app: Spotify OAuth, feedback memory, EN/RU/UK UI, exports, optional local-AI (Ollama) enhancement
- **Requires:** Python 3.10+
- **Dependencies:** standard library only
- **Core principle:** privacy-first, explainable, connector-ready, no fake account access

## Multi-source workflow (2.0)

```bash
python scripts/import_youtube_takeout.py path/to/watch-history.json   # -> outputs/youtube_takeout_normalized.json
python scripts/import_lastfm.py --file path/to/lastfm_export.csv       # -> outputs/lastfm_normalized.json
python scripts/merge_listening_sources.py                              # -> merged history + source_coverage.json
python scripts/enrich_genres.py outputs/merged_listening_history.json outputs/enriched.json [--lastfm]
python scripts/analyze_taste.py outputs/enriched.json outputs/taste_profile.json
python scripts/export_portable_dna.py                                  # portable_music_dna.json/.md/_prompt.md
python scripts/export_dna_card.py                                      # shareable HTML card
```

Always report source coverage and confidence (High/Medium/Low) honestly, and
say when genres were inferred by enrichment rather than provided by a source.

## Purpose

Use this skill to analyze a user's listening history, generate a plain-language Music DNA profile, and recommend music according to:

- current mood;
- task / use case;
- experimentality level;
- known genres/artists;
- taste drift;
- novelty tolerance.

The skill is not a streaming app. It is a recommendation intelligence layer that can run locally or be attached to another AI/coding agent.

## Activation Triggers

Activate this skill when the user asks to:

- analyze music taste;
- analyze Spotify / Last.fm / CSV / JSON listening history;
- create a Music DNA profile;
- recommend tracks based on mood;
- recommend music for a task such as focus, workout, night drive, TikTok, AI video, etc.;
- control how experimental the recommendations should be;
- explain why a track was recommended;
- build a local music recommendation tool.

## Supported Inputs

### Working local inputs

- sample listening history;
- manual mini-library input;
- normalized JSON matching `schemas/listening_history.schema.json`;
- CSV file with at least `track_name` and `artist_name`;
- Spotify export normalized through `normalize_spotify_export.py`;
- Last.fm export normalized through `normalize_lastfm_export.py`;
- **Spotify account via OAuth (V2, implemented)** — `scripts/spotify_connector.py`
  fetches top tracks (3 time ranges) and recently played, resolves artist genres,
  and outputs normalized history. Requires a one-time `SPOTIFY_CLIENT_ID` setup
  (`SPOTIFY_SETUP.md`).

### Connector-ready inputs (not yet implemented)

- Apple Music / MusicKit data;
- phone or desktop media library metadata.

Do not claim these connector-ready sources work until the relevant connector is implemented.

## User Parameters

### Mood slider

Range: `-2` to `+2`.

```text
-2 = very negative / dark / introspective
-1 = calm / sad / reflective
 0 = neutral / balanced
+1 = energetic / bright / motivating
+2 = euphoric / uplifting / danceable
```

### Task selector

Accepted tasks:

```text
work_focus
walking
workout
night_drive
sad_mood
romantic_mood
party
relaxation
tiktok_reels
ai_video
playlist_creation
discovering_new_artists
surprise_me
```

### Experimentality slider

Range: `1` to `5`.

```text
1 = Only similar music
2 = Slightly new
3 = Balanced
4 = More experimental
5 = Surprise me
```

Internally this maps to a novelty distance from `0.1` to `1.0`. It controls how far recommendations may move away from the user's known genre/artist patterns.

## Recommended Workflow

### Local one-screen UI

Non-technical users: double-click `start_mac.command` / `start_windows.bat`
/ `start_linux.sh`. Developers:

```bash
python scripts/local_interface.py
```

Open:

```text
http://127.0.0.1:8765
```

The user can then:

1. select data source (including “Connect Spotify” when configured);
2. upload/paste/manual-enter listening data;
3. set mood;
4. select task;
5. set experimentality;
6. click one button;
7. receive Music DNA and grouped recommendations;
8. rate picks (local feedback memory adjusts future runs, capped and shown
   in the scoring breakdown);
9. export Markdown/JSON or copy an AI prompt;
10. optionally enhance explanations with a local Ollama model.

### CLI demo

```bash
python scripts/run_demo.py --mood 1 --task night_drive --novelty 4 --max 9
```

### Spotify OAuth pipeline (V2)

```bash
python scripts/spotify_connector.py login --remember
python scripts/spotify_connector.py fetch --output outputs/spotify_history.json
python scripts/analyze_taste.py outputs/spotify_history.json outputs/taste_profile.json
python scripts/generate_recommendations.py outputs/taste_profile.json --mood 1 --task night_drive --novelty 4 --catalog examples/sample_candidate_catalog.json --output outputs/recommendations.json
```

`login` without `--remember` keeps tokens in memory and fetches in the same step.

### Manual pipeline

```bash
python scripts/normalize_csv_import.py examples/sample_csv_import.csv outputs/normalized_csv.json
python scripts/analyze_taste.py outputs/normalized_csv.json outputs/taste_profile.json
python scripts/generate_recommendations.py outputs/taste_profile.json --mood 1 --task night_drive --novelty 4 --catalog examples/sample_candidate_catalog.json --output outputs/recommendations.json
python scripts/generate_recommendation_prompt.py outputs/taste_profile.json --mood 1 --task night_drive --novelty 4 --output outputs/recommendation_prompt.md
```

## Recommendation Logic

The engine scores each candidate track using transparent heuristics:

- genre affinity score;
- artist recurrence score;
- mood match score;
- task match score;
- novelty distance score;
- popularity / recency proxy;
- long-term consistency score.

Recommendations are grouped into:

1. **Safe Match** — close to known taste;
2. **Adjacent Discovery** — nearby discovery;
3. **Wildcard** — wider experimental jump allowed by the experimentality slider.

Each recommendation includes:

- track title;
- artist;
- genres;
- group;
- confidence score;
- why the user may like it;
- why the user may not like it;
- mood match;
- task match;
- novelty score;
- scoring breakdown;
- Spotify / YouTube / YouTube Music search links.

## Candidate Catalog

The MVP uses:

```text
examples/sample_candidate_catalog.json
```

In future connector versions, replace this with a catalog generated from Spotify / Last.fm / Apple Music search results or a curated database.

## Privacy Rules

- Only analyze data explicitly provided by the user.
- Do not silently scan local device files.
- Do not fake access to Spotify, Apple Music, or phone media libraries.
- Keep OAuth tokens in memory by default. Persist only the refresh token, only after
  explicit user consent (“remember on this device” / `--remember`), only in a
  `0600`-permission file under the user's config directory, and provide a working
  disconnect/delete action.
- Request only read-only scopes the feature actually needs.
- Keep local imports in `outputs/` unless the user chooses another storage path.
- Clearly explain requested permissions before adding a real connector.
- Keep recommendation explanations human-readable.

## Example User Requests

```text
Analyze this CSV library. Mood = -1, task = work_focus, experimentality = 2.
```

```text
Use my Music DNA and recommend night-drive tracks. I want novelty level 4.
```

```text
Generate Safe Match, Adjacent Discovery, and Wildcard recommendations for TikTok/Reels.
```

```text
Create a prompt I can paste into another AI to get richer music recommendations from this taste profile.
```
