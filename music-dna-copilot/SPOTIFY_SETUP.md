# Spotify OAuth Setup (V2)

The V2 connector uses **Authorization Code with PKCE** — no client secret has to live on your machine, only a public Client ID. Access is **read-only**: top tracks and recently played.

## 1. Create a Spotify app (one time, ~2 minutes)

1. Open https://developer.spotify.com/dashboard and log in with your Spotify account.
2. Click **Create app**.
3. Fill in:
   - **App name:** anything, e.g. `Music Taste Recommender (local)`
   - **Redirect URI:** `http://127.0.0.1:8765/spotify/callback`
   - **API used:** Web API
4. Save, open the app, and copy the **Client ID**.

## 2. Configure the project

```bash
cp .env.example .env
```

Edit `.env` and set:

```text
SPOTIFY_CLIENT_ID=<your client id>
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8765/spotify/callback
```

`SPOTIFY_CLIENT_SECRET` is **not required** for the PKCE flow and can stay empty.

## 3. Connect

### Option A — local UI (recommended)

```bash
python scripts/local_interface.py
```

Open http://127.0.0.1:8765, find the **Spotify (OAuth) — V2** source option and click:

- **Connect** — token kept in memory for this app session only;
- **Connect and remember on this device** — explicit consent to store the refresh token in
  `~/.config/music-taste-recommender/spotify_tokens.json` with `0600` permissions.

After authorizing in the browser you are redirected back, the source becomes selectable, and one click runs the full pipeline: fetch → normalize → Music DNA → recommendations.

### Option B — CLI

```bash
# One-shot: authorize and fetch in the same process (nothing stored)
python scripts/spotify_connector.py login

# Or persist the connection (explicit consent), then fetch any time:
python scripts/spotify_connector.py login --remember
python scripts/spotify_connector.py fetch --output outputs/spotify_history.json

# Then run the usual pipeline:
python scripts/analyze_taste.py outputs/spotify_history.json outputs/taste_profile.json
python scripts/generate_recommendations.py outputs/taste_profile.json --mood 1 --task night_drive --novelty 4 --catalog examples/sample_candidate_catalog.json --output outputs/recommendations.json
```

Note: if the local UI is already running on port 8765, use Option A — the CLI cannot bind the same callback port.

## 4. Disconnect / delete data

- UI: click **Disconnect** in the Spotify source option.
- CLI: `python scripts/spotify_connector.py logout`
- Full revocation: remove the app at https://www.spotify.com/account/apps/
- Fetched history lives only in `outputs/spotify_history.json` — delete it whenever you want.

## What the connector requests and why

| Scope | Used for |
|---|---|
| `user-top-read` | `/me/top/tracks` over short/medium/long term → taste-drift signal |
| `user-read-recently-played` | `/me/player/recently-played` → fresh listening + play counts |

No write scopes, no playlist access, no library modification. Playlist export is a separate roadmap item and will request its scope only when implemented.

## Known API limitation

Spotify deprecated the public `/audio-features` endpoint for new apps (Nov 2024), so the connector does not attach energy/valence numbers. The analyzer already falls back to genre-based heuristics, which the V1 pipeline supports.

## Port note (launchers)

The double-click launchers pick the next free port if 8765 is busy.
Spotify, however, only accepts the exact registered callback URL — so
**connecting Spotify works only on the port from your registered redirect
URI** (default 8765). If the app started on another port, the terminal and
the UI will say so: free port 8765 and restart, or register an additional
redirect URI and update `.env`.

## Troubleshooting

- **`INVALID_CLIENT: Invalid redirect URI`** — the redirect URI in the Spotify dashboard must match `.env` exactly, including `http://127.0.0.1` (not `localhost`) and the port.
- **`SPOTIFY_CLIENT_ID is not configured`** — `.env` is missing or still contains the placeholder.
- **Callback never arrives** — check that the UI/CLI is running on the host/port from the redirect URI and no firewall blocks localhost.
- **`Spotify returned no tracks`** — brand-new accounts have no top tracks yet; play some music or use another source.
