# Start Here 👋

## 1. What this app is
A **local-first Music DNA assistant**. It analyzes music taste on your own computer, explains it, and recommends tracks in three honest groups (Safe Match / Adjacent Discovery / Wildcard) with a reason and a risk for each. No account, no cloud, no payment.

## 2. What this app is not
Not a Spotify replacement, not a streaming player, not a SaaS. It never modifies your Spotify playlists, never uploads your data, and doesn't pretend to connect to YouTube Music or Apple Music (import-only / future).

## 3. Fastest way to test it
Launch → keep **Use demo library** selected → press **Generate recommendations**. That's it. Then open **Self-Test** (link at the top of the home page) for the guided checklist.

## 4. Launch on Windows
Double-click `start_windows.bat` (needs Python 3.10+ from python.org, "Add to PATH" checked).

## 5. Launch on macOS
Double-click `start_mac.command` (first time: right-click → Open). Or run `python3 scripts/start_app.py` in Terminal.

## 6. Launch on Linux
`./start_linux.sh` or `python3 scripts/start_app.py`.

## 7. What URL to open
The launcher opens your browser automatically at **http://127.0.0.1:8765/**. If the port is busy, it picks the next free one and prints the actual URL in the terminal. `python3 scripts/start_app.py --check` shows a status report.

## 8. First 10-minute test
1. Generate with **Use demo library**. 2. Switch to **Owner-style demo taste** (60 dark/heavy tracks) and generate again — notice the DNA change. 3. Apply the **Post-metal / Doom / Sludge** preset, generate. 4. Save 3 favorites (♥), reject 2 (✕). 5. Press **Export Music DNA report**. 6. Open **/self-test** and see your checkmarks.

## 9. How to paste your own tracks
Pick **Manual favorite tracks** and paste one track per line. Accepted formats:
```
Bell Witch — Mirror Reaper
YOB - Marrow
A Solitary Reign by Amenra
```
Leading numbers/bullets are ignored.

## 10. How to connect Last.fm
Open **Sources & accounts** → Last.fm card → enter username + API key (create a free key at last.fm/api/account/create) → **Save** → **Test Last.fm connection**. Stored locally only. Then enable "Use Last.fm similar tracks" before generating.

## 11. How to connect Spotify
Optional. Create an app at developer.spotify.com/dashboard, add redirect URI `http://127.0.0.1:8765/spotify/callback`, put `SPOTIFY_CLIENT_ID` in `.env` (PKCE — **no client secret needed**), restart, click the Spotify connect link. Read-only.

## 12. If something does not work
Run `python3 scripts/start_app.py --check`. Few results in Strict mode → try Balanced, paste more tracks, or enable Last.fm similar tracks. Port busy → use the URL printed in the terminal. Last.fm errors → re-check key/username on the Sources page and press Test. Nothing else? Run `python3 -u scripts/smoke_test.py` and note the first FAIL line.

## 13. What files are safe to share
The whole release zip: code, `scripts/`, `examples/`, `schemas/`, `data/`, docs, `.env.example`. It contains no personal data.

## 14. What files are private
Everything in `outputs/` (favorites, feedback, reports, `local_config.json` with your Last.fm key, Spotify token) and your `.env`. These never go into a release archive — keep them to yourself.

## 15. What to write down while testing
Use **SELF_TEST_PLAN.md** (3-day plan + scoring table). Note: which recommendations were actually good, which genres were wrong, which presets you reused, what confused you in the UI, and whether you'd use it weekly.
