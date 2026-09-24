---
name: music-dna-copilot
description: Maintain the Music DNA Copilot repo (local-first, stdlib-only music taste app). Use when changing code, UI copy, docs, launchers, tests or release packaging in this project.
---

# Music DNA Copilot — project maintenance skill

Version: 2.0.0 (see `VERSION`, `CHANGELOG.md`, `MERGE_NOTES.md`).

## Hard constraints

- Python 3.10+ **standard library only**. No pip deps, no React/Next.js, no database, no Docker.
- Local-first: user data only in `outputs/`. No cloud storage, accounts, payments, telemetry.
- Connectors are read-only. No Spotify write scopes. YouTube Music = Google Takeout **file import only**
  (no cookies, no unofficial login). Apple Music / local folders: placeholders only, never faked.
- Keep the structure: engine in `scripts/`, UI in `scripts/local_interface.py` + `scripts/mtr_app/`,
  hosted demo in `app.py` + `api/_engine.py` + `index.html` (stateless, no writes).
- Every user-visible string exists in EN, RU and UK (`mtr_app/i18n.py`, `mtr_app/i18n_multi.py`).
- Inferred data is labeled as inferred (genre enrichment sets `genres_inferred`).

## Map

| Area | Files |
|---|---|
| Launch | `run_app.py`, `RUN_APP_*`, `start_*` (delegate), `scripts/start_app.py` |
| Import | `normalize_*`, `import_youtube_takeout.py`, `import_lastfm.py`, `lastfm_client.py`, `spotify_connector.py` |
| Merge / coverage | `source_common.py`, `merge_listening_sources.py` |
| Enrichment | `enrich_genres.py`, `data/artist_genre_seed.json`, `genre_taxonomy.py`, `data/genre_taxonomy.json` |
| Engine | `analyze_taste.py`, `generate_recommendations.py`, `candidate_engine.py` |
| Personal | `personal_store.py`, `mtr_app/data_management.py` |
| Exports | `export_portable_dna.py`, `export_dna_card.py`, `music_dna_report.py` |

## Verify before saying "done"

```bash
python -m py_compile run_app.py app.py api/*.py scripts/*.py scripts/mtr_app/*.py
python scripts/smoke_test.py          # runs all suites + live UI flow; must end "N passed, 0 failed"
python scripts/run_demo.py --mood 1 --task night_drive --novelty 4 --max 9
python scripts/make_release_zip.py && python scripts/release_check.py
```

## Release

Bump version in `VERSION`, root `SKILL.md`, `CHANGELOG.md`, footer in `scripts/local_interface.py`.
Release zip = `dist/music-dna-copilot.zip` (whitelist in `make_release_zip.py`; never ships `outputs/`,
`.env`, tokens or personal files). A skill-upload zip must contain exactly one `SKILL.md`.
