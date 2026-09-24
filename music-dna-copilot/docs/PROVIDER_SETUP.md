# Provider setup

All providers are **optional** and **read-only**. The app works fully without any of them
(Demo, manual paste, and CSV/JSON import need no setup). Credentials are stored locally in
your `.env` and are never committed or included in a release archive.

## Last.fm (recommended, easy)
Last.fm powers recent tracks, top artists/tracks, tags, and similar-track discovery.

1. Create an API account: https://www.last.fm/api/account/create
2. Copy `.env.example` to `.env` and set:
   ```
   LASTFM_API_KEY=your_key_here
   LASTFM_USERNAME=your_username
   ```
3. Restart the app. Enable **"Use Last.fm similar tracks"** before generating.

What it uses: `user.getRecentTracks`, `user.getTopArtists`, `user.getTopTracks`,
`track.getTopTags`, `artist.getTopTags`, and `track.getSimilar`. All read-only. If the key
is missing the app simply shows "Last.fm: not configured" and keeps working.

## Spotify (optional)
Spotify provides read-only OAuth plus Search-based candidate expansion.

1. Create an app: https://developer.spotify.com/dashboard
2. In the app settings add the redirect URI **exactly**:
   ```
   http://127.0.0.1:8765/spotify/callback
   ```
   (If the app printed a different port, use that port instead.)
3. In `.env` set:
   ```
   SPOTIFY_CLIENT_ID=your_client_id
   SPOTIFY_REDIRECT_URI=http://127.0.0.1:8765/spotify/callback
   ```
   `SPOTIFY_CLIENT_SECRET` is **not required** for PKCE and can be left unset.
4. Restart the app and use the Spotify login button.

Scopes: read-only only (e.g. recently played / top items). The app **never** requests write
scopes and never modifies your account or playlists. Tokens are stored locally in `outputs/`
and are excluded from git and release archives.

## YouTube Music (import only — no direct connection)
There is **no** direct YouTube Music account login. There is no reliable official OAuth path,
so the app does not pretend to connect. Instead, export your history via **Google Takeout**
(YouTube and YouTube Music → history) and import the resulting CSV/JSON, or paste tracks
manually. This is labeled "Import", not "Connect", on purpose.

## Apple Music (future / planned)
Not implemented. There is no connect button. A future version could use an Apple Developer
token + MusicKit user authorization, but that is out of scope for now.

## Privacy
Your listening data stays on this device. The app runs a **local-only** HTTP server on
`127.0.0.1` and makes no network calls unless you configure Last.fm or Spotify or export a
file yourself. No cloud, no accounts on our side, no tracking, no payments.
