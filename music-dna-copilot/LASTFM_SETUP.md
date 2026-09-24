# Last.fm setup

The Last.fm connector is **read-only** and uses only an **API key + username**. It
never asks for your password, never uses the API secret, and implements no OAuth.
It is entirely optional — the app works without it (demo, manual, CSV/JSON, Spotify).

## What it gives you

- **History source:** import your recent scrobbles (`user.getRecentTracks`) and run
  the normal recommendation pipeline on them.
- **Discovery source:** use **Last.fm similar tracks** (`track.getSimilar`, seeded
  from your recent tracks) to expand the candidate pool beyond the local catalog.

## Steps

1. Get a Last.fm API key: https://www.last.fm/api/account/create
2. Add it to your `.env` (copy `.env.example` to `.env` if needed):
   ```
   LASTFM_API_KEY=your_key_here
   ```
3. Add your username (or type it into the UI each time):
   ```
   LASTFM_USERNAME=your_lastfm_name
   ```
4. Start the local app:
   ```
   python3 scripts/local_interface.py
   ```
5. In the browser:
   - Pick **Last.fm** as the source and enter your username to import scrobbles, **and/or**
   - Tick **"Use Last.fm similar tracks…"** on any run to expand discovery.

## States you may see

| State | What it means |
|-------|----------------|
| *API key is not configured* | `LASTFM_API_KEY` is missing from `.env`. |
| *Enter your Last.fm username* | Key is set; supply a username (UI field or `.env`). |
| *Last.fm is ready* | Key + username present. |
| *Last.fm request failed…* | Network/API problem — the app stays usable; try Demo/Upload/Spotify. |

## Privacy

- Everything stays on your machine. Imported history is written under `outputs/`.
- Your API key lives only in your local `.env`; it is never uploaded anywhere by the app.
- Last.fm calls are made only when you choose the Last.fm source or enable similar-track
  discovery. No hidden network calls happen otherwise.
- To remove data: delete files under `outputs/` (and `outputs/cache/` if present). To
  revoke access, remove `LASTFM_API_KEY` from `.env` or reset the key on Last.fm.

## Notes / limits

- `get_top_tracks` / `get_top_artists` are implemented and used as optional seeds.
- Similar-track expansion is bounded (`lastfm_seed_limit`, `lastfm_candidate_limit`) to
  keep runs fast. Already-known tracks are removed from the pool by default.

## Tag enrichment

Last.fm's similar-track endpoint does not return genres, so those candidates start
tagless. To make deep-genre filtering useful, the app **enriches** sparse candidates:

1. it fetches **track top tags** (`track.getTopTags`) first (most specific);
2. if none, it falls back to **artist top tags** (`artist.getTopTags`, lower confidence);
3. if neither returns anything, the candidate stays usable but is marked as tagless.

Enriched tags are normalized through the genre taxonomy, drive strict/exclude/adjacent
logic, and feed the candidate-pool's `genre_metadata_quality` (high / medium / low) shown
on the Profile Quality card. Track-tag candidates score higher than artist-tag, which
score higher than tagless.

### Cache

- Tag lookups are cached locally at `outputs/cache/lastfm_tags_cache.json`.
- The cache is checked **before** any network call; lookups are de-duplicated by
  `artist+track` (track tags) and `artist` (artist tags), and calls are bounded per run.
- The cache stores only tags, a timestamp, the source (track/artist), and a confidence
  value — **never** your API key or any secret.
- To clear it: delete `outputs/cache/lastfm_tags_cache.json` (it is rebuilt on demand). A
  missing or invalid cache file is handled cleanly.

### Why some tracks still have sparse genre data

Not every track/artist has Last.fm tags, tags can be noisy or non-genre ("seen live"),
and enrichment is bounded. When metadata is thin, result cards show a soft note that the
match is based mostly on artist/tag similarity, and the Profile Quality card suggests
broadening discovery or adding history.
