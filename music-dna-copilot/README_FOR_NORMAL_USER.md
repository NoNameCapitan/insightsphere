# Simple guide (for anyone)

This app runs on your own computer and helps you understand your music taste and find
new tracks. No account, no sign-up, and nothing leaves your device unless you choose to
connect a service.

## Start it
1. Install **Python 3.10+** (check with `python3 --version`).
2. In this folder run:
   ```
   python3 scripts/start_app.py
   ```
   (or double-click `start_windows.bat`, `start_mac.command`, or `start_linux.sh`)
3. It opens in your browser at `http://127.0.0.1:8765/`.

## Try the demo (no setup)
Pick **Demo** as the source and press **Generate recommendations**. You'll get example
suggestions and a taste summary right away.

## Paste your own tracks
Pick **Manual mini-library** and paste songs, one per line. Any of these work:
```
Marrow by YOB
A Solitary Reign by Amenra
Nightcall — Kavinsky
Midnight City - M83
```
Then press **Generate**.

## Connect Last.fm (optional)
1. Get a free API key at https://www.last.fm/api/account/create
2. Copy `.env.example` to `.env` and fill in `LASTFM_API_KEY` and `LASTFM_USERNAME`.
3. Restart the app and turn on "Use Last.fm similar tracks".
Read-only — it never changes your account. Details in `docs/PROVIDER_SETUP.md`.

## Connect Spotify (optional)
1. Create a free app at https://developer.spotify.com/dashboard
2. Add redirect URI `http://127.0.0.1:8765/spotify/callback`.
3. Put the client ID in `.env` as `SPOTIFY_CLIENT_ID` (no secret needed — it uses PKCE), restart, and click the Spotify login button.
Read-only — it never edits your playlists. Details in `docs/PROVIDER_SETUP.md`.

## Import a CSV or JSON file
Pick **Upload CSV/JSON** and choose your file. A sample is in `examples/`.

## Export your report
After generating, use **Export Music DNA report** (Markdown) and the **Queue** page to
export a shortlist as CSV/TXT.

## Reset or delete your data
Open the **Local data** page to back up, clear individual lists, or fully reset (it asks
first). Everything is stored locally in the `outputs/` folder.

## Troubleshooting
- **Nothing opens:** make sure you ran `python3 scripts/start_app.py` and check the printed
  URL. Run `python3 scripts/start_app.py --check` for a status report.
- **Few results in strict mode:** click **Broaden genre** or turn on Last.fm similar tracks;
  the built-in sample library is small.
- **Last.fm/Spotify says "not configured":** that's fine — they're optional. Demo, paste,
  and file import all work without them.
- **Port already in use:** the app automatically picks the next free port; check the URL it
  prints.
