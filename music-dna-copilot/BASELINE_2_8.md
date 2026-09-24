# Baseline audit — Music DNA Copilot 2.8.0

Recorded before any 3.0 change, from the unmodified 2.8.0 archive (Python 3.11).
Rule followed: *documentation is not implementation*. Each capability was checked in code.

## Test baseline

| Suite | Result |
|---|---|
| `scripts/smoke_test.py` (runs most suites + live local UI) | **188 passed, 0 failed** |
| `test_music_capsules.py` | 18 / 18 |
| `test_beta_instrumentation.py` | 10 / 10 |
| `test_track_resolver.py` | 7 / 7 |
| `test_music_dna_brain.py` | 7 / 7 |
| `test_recommendation_quality.py` | 9 / 9 |
| `test_provider_adapter.py` | 6 / 6 |
| `test_identity_graph_v2.py` | 5 / 5 |
| `test_cross_service_identity.py` | 3 / 3 |
| `test_release.py` | 16 / 16 |
| `test_candidate_engine.py` | 25 / 25 |

Not run by smoke in 2.8: resolver, beta instrumentation, provider adapter, identity v2 (3.0 adds them).

## Capability map (verified in code)

| Capability | Status in 2.8 | Where |
|---|---|---|
| Spotify OAuth (PKCE, read-only) + history/library/playlists | Implemented, wired to UI | `spotify_connector.py`, `local_interface.py` |
| Last.fm API (paged) + export import | Implemented, wired to UI | `lastfm_client.py`, `import_lastfm.py` |
| YouTube Music via Google Takeout | Implemented, wired to UI | `import_youtube_takeout.py` |
| Apple Music | **Preparation only**: config status, never live. Imports via generic column importer | `apple_music_connector.py`, `import_multi_service.py` |
| Deezer/TIDAL/SoundCloud/Amazon/Qobuz/Bandcamp/Yandex/Pandora | Generic CSV/JSON column importer (not format-specific parsers) | `import_multi_service.py` |
| Spotify Extended Streaming History | Normaliser existed but was **not reachable from the UI** | `normalize_spotify_export.py` |
| Unified provider adapter + incremental sync | Library only (manifest + cursor file); not used by UI | `provider_adapter.py` |
| Identity graph (ISRC → MusicBrainz → provider id → conservative fuzzy) | Implemented, used by merge | `identity_graph.py`, `merge_listening_sources.py` |
| Music DNA (genres, artists, mood, repetition, drift) | Implemented | `analyze_taste.py` |
| Adaptive brain (time decay, bounded affinities, novelty shift) | Implemented; used by ranker via `feedback.jsonl` | `music_dna_brain.py` |
| Candidate retrieval → ranking | Implemented | `candidate_engine.py`, `generate_recommendations.py` |
| Reranking (session taste, tier identity) | **Not implemented** (only `blend_session_preferences` helper, unused) | `recommendation_quality.py` |
| Capsules (Common/Rare/Legendary/Mystery, lifecycle, metrics) | Library only; **no UI, no persistence of capsules** | `music_capsules.py` |
| Track Resolver + fallback routing | Library only; not in UI | `track_resolver.py` |
| Quality Lab | Computed per run, not shown | `recommendation_quality.py` |
| Beta instrumentation / A/B / beta report | Library only; **no events were ever emitted** | `beta_instrumentation.py` |
| Local capsule history | `append_history` helper only | `music_capsules.py` |

The 2.x UI (`local_interface.py`) was a single-form workspace (source → mood → task →
experimentality → grouped recommendations). None of the 2.2–2.8 capsule, resolver,
beta or provider-adapter work was reachable by a user.

## Defects found during the audit (fixed in 3.0)

1. **Search presented as exact resolution.** `build_capsule` attached provider *search*
   links before calling the resolver, and the resolver treated any link as a direct
   track URL, so every capsule track reported `status: resolved, method: provider_id,
   confidence: 1.0` for a Spotify search page.
2. **Provider identity dropped before routing.** `normalize_candidate` strips ISRC and
   provider ids, so exact routing could never happen downstream of ranking.
3. **Identity merge was quadratic.** Fuzzy matching compared every new track with every
   merged track: 1,500 rows took ~113 s, so real Last.fm histories were unusable.
4. **Multi-service imports overwrote each other** (single `multi_service_normalized.json`).
5. `mainstream_vs_niche` was hard-coded to 0.5 in the taste profile.
6. `.gitignore` hid shipped files (`data/artist_genre_seed.json`, `vercel.json`).
