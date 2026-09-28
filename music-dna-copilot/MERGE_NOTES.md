# Merge notes — Music DNA Copilot 2.0

2.0 unifies two branches that grew apart from one shared ancestor.

| | **A: music-dna-copilot v1.4.0** | **B: music-taste-recommender V4 (vercel-ux-i18n)** |
|---|---|---|
| Focus | *where* taste data comes from | *how well* we reason about it |
| Sources | Takeout, Last.fm export file, merge, coverage/confidence | Last.fm live API + similar tracks + tags, owner demo |
| Engine | older `analyze_taste` (1 row = 1 play) | `play_count`-weighted analysis, genre taxonomy, strict/balanced/soft, candidate pool |
| Outputs | Portable Music DNA (json/md/prompt), DNA Card (HTML) | Music DNA report, shortlist CSV/TXT |
| Workspace | feedback only | favorites / rejects / listen-later / shortlist / presets, `/data`, `/queue`, `/self-test` |
| Code shape | 1 862-line `local_interface.py`, inline i18n | split `mtr_app/` (i18n, http io, validation, data mgmt) |
| Delivery | `run_app.py` + `RUN_APP_*` launchers (in docs) | `start_*` launchers, Vercel stateless demo |
| Tests | 50 + 43 + 28 | 144 smoke + 13 suites |

Shared files (`spotify_connector`, normalizers, prompt, run_demo) were identical.

## Decision

**Base = B** (newer engine and structure), **port A's multi-source layer into it**.
Nothing from B was removed. Where both had an answer, B's was kept:

- Last.fm: B's live client stays for username mode; A's `parse_export_file` is added for offline export files (same card, extra upload field).
- Profile quality (B) and source coverage (A) both render: quality = how much the run had, coverage = where it came from.
- i18n: A's strings live in `scripts/mtr_app/i18n_multi.py` and are merged into `STRINGS` at import.

## What moved over from A

`source_common.py`, `import_youtube_takeout.py`, `import_lastfm.py`, `merge_listening_sources.py`,
`export_portable_dna.py`, `export_dna_card.py`, `test_multi_source.py` (wrapped in `main()` so the
smoke runner can call it in-process), four example files, `run_app.py` + `RUN_APP_*` launchers.

UI: YouTube Takeout card, Last.fm export upload, merged-profile source, honest Apple Music placeholder,
coverage card, Portable DNA block, routes `/export/dna-json|dna-md|dna-prompt|dna-card`.
Data page: new "Clear imported sources" action; full reset and release whitelist know the new files.
Upload cap raised 8 → 64 MB (Takeout exports are large; app is localhost-only).

## New in the merge: genre enrichment (`scripts/enrich_genres.py`)

The gap between the branches: A imports YouTube history **without genres**, B's engine **needs genres**.
Enrichment fills genres only for tagless rows, in this order: same artist elsewhere in the history →
offline map (bundled examples + `data/artist_genre_seed.json`) → optional Last.fm artist tags
(normalized through the taxonomy, cached, capped at 40 lookups). Rows get `genres_inferred: true` and
`genre_source`; the UI reports "N of M tagless tracks got genres". The Vercel demo uses the offline path,
so pasted track lists now produce a real genre profile instead of an empty one.

## Verification

`py_compile` clean · smoke 167/167 (includes every suite + live HTTP Takeout → merged run) ·
multi-source 43/43 · enrichment 18/18 · spotify 28/28 · all other suites green · `run_demo.py` OK ·
`run_app.py` starts and serves `/health`.
