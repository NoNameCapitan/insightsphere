# Daily use

A short, practical guide to using the Music Taste Recommender as a personal
**Music DNA workspace**. Everything runs locally; nothing is uploaded.

## 1. Start the app
```
python3 scripts/start_app.py          # opens the local UI in your browser
python3 scripts/start_app.py --check  # prints status (Python, config, saved data, URL)
```
Or double-click `start_linux.sh` / `start_mac.command` / `start_windows.bat`.

## 2. Best first preset to try
Open **My presets** and apply **Night Drive** (broad and pleasant) or **Focus / Deep
Work** if you want low-distraction instrumentals. Then press **Generate**. Presets fill
mood, task, novelty, and genre direction for you — they're the fastest way in.

## 3. Using Last.fm (optional, read-only)
Add `LASTFM_API_KEY` and `LASTFM_USERNAME` to `.env` (see `LASTFM_SETUP.md`), then enable
**"Use Last.fm similar tracks"** before generating. This expands the candidate pool with
similar-track discovery and enriches genre tags. No write access, no scrobbling.

## 4. Save favorites
On any result card, click **♥ Favorite** for tracks you like. Favorites are stored locally
and gently boost similar genres/artists in future runs.

## 5. Reject bad tracks
Click **✕ Never** on tracks or directions you don't want. Rejected exact tracks are
excluded from future runs and their genres/artists are de-emphasized (strict genre
exclusions are never overridden).

## 6. Listen Later
Click **🕑 Listen later** to park tracks for review. Find them all on the **Queue** page.

## 7. Export a shortlist
Click **＋ Shortlist** to collect tracks, then open **Queue** and export as **CSV** or
**TXT** for manual listening in your player of choice.

## 8. Generate a Music DNA report
From the results page or Queue, choose **Export Music DNA report** (`/export/dna-report`)
for a readable Markdown summary of your taste, top genres/artists, and recent saves.

## 9. Reset / backup data
Open the **Local data** page (`/data`) to see what's stored, **export a backup .zip**, clear
individual lists (shortlist / listen-later / favorites / rejects / tag cache / generated
recommendations), or **Full reset** (asks for confirmation; keeps `.env`, Spotify login, and
code).

## 10. Recommended personal workflows
1. **Quick session:** apply a preset → Generate → save 2–3 favorites → done.
2. **Discovery session:** apply **Wild Discovery** or **Experimental Discovery**, enable
   Last.fm similar, save the surprises to Listen Later, reject misses.
3. **Creator session:** apply **Creator Mode** / **Dark Mystic Video**, shortlist 20–40
   tracks, export CSV with search links for your video/Reels work.
4. **Refine loop:** after results, use **Safer / More adventurous / Narrow / Broaden** to
   nudge the next run without re-entering settings; follow the **Recommended next action**.
5. **Weekly:** export a Music DNA report, back up your data, and reset generated files.

## What stays local / out of scope
Local-first and private: no accounts, no cloud sync, no database, no payments. Apple Music
and Spotify playlist export are **planned/future**, not active. Last.fm and Spotify data are
used read-only and are never resold.
