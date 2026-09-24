# Start here (for a friend)

This is a small music recommendation app that runs **entirely on your own computer**.
No account, no sign-up, no internet required to try it. Your data stays on your machine.

## What it does
You give it some music you like (or just use the built-in demo). It analyzes your taste,
then suggests tracks grouped as **Safe match**, **Adjacent discovery**, and **Wildcard**,
and explains *why* each was picked. You can save the good ones and export a list.

## Start it (no accounts needed)
1. Make sure you have **Python 3.10 or newer** (`python3 --version`).
2. In a terminal, go into this folder and run:
   ```
   python3 scripts/start_app.py
   ```
   (or double-click `start_mac.command`, `start_windows.bat`, or `start_linux.sh`).
3. Your browser opens the app at a local address like `http://127.0.0.1:8765/`.
4. Not sure if things are set up? Run `python3 scripts/start_app.py --check` for a status report.

## Use Demo Mode (the easiest start)
On the home page, pick **Demo** as the source and press **Generate recommendations**.
That's it — no data or setup required.

## Use a preset
Open **My presets**, pick one (try **Night Drive** or **Focus / Deep Work**), click
**Apply**, then **Generate**. Presets fill in mood, energy, and genre direction for you.

## Generate recommendations
Choose a source (Demo to start), optionally a preset or mood/genre, then **Generate**.
Each result card shows the track, why it fits, and quick buttons.

## Save tracks to Listen Later
On any result, click **🕑 Listen later** (or **♥ Favorite**, or **＋ Shortlist**). Find
everything you saved on the **Queue** page.

## Export your shortlist
Open **Queue** and export your shortlist as **CSV** or **TXT** to listen in any player.
You can also export a **Music DNA report** describing your taste.

## Optional: connect Last.fm (only if you want)
Copy `.env.example` to `.env`, add `LASTFM_API_KEY` and `LASTFM_USERNAME`, then enable
"Use Last.fm similar tracks" before generating. See `LASTFM_SETUP.md`. Read-only — it
never posts anything.

## Optional: connect Spotify (only if you want)
Add your Spotify app credentials to `.env` and use the Spotify login button. See
`SPOTIFY_SETUP.md`. Read-only — it does not change your Spotify account or playlists.

## Reset or delete your local data
Open the **Local data** page (`/data`) to see what's saved, **export a backup**, clear
individual lists, or **Full reset** (it asks for confirmation first). Nothing is ever sent
anywhere.

## Privacy
Everything stays on your computer in the `outputs/` folder. The app makes **no network
calls** unless *you* choose to configure Last.fm or Spotify. There are no accounts, no
cloud, no tracking, and no payments.

## Good to know
- Demo, manual entry, and CSV/JSON upload all work with no internet.
- Apple Music and Spotify playlist export are **not** included (planned for the future).
- If a strict, narrow genre search returns few results, try **Broaden genre** or a
  different preset — the bundled sample library is small.
