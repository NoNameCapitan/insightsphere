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

## YouTube Music (live liked music, or Takeout import)
**Live (3.1):** My music → YouTube Music → **Set up**. Create a Google Cloud project, enable
"YouTube Data API v3", configure the OAuth consent screen (External, Testing, add yourself as a
test user) and create an **OAuth client ID of type Desktop app**; paste its ID and secret, then
**Save and connect**. This is Google's official sign-in and API, read-only
(`youtube.readonly`). Google offers no API for YouTube Music *play history*, so the live
connection reads the songs you **liked** (Music category). No cookies, no unofficial login.
**Import:** for full history, export it via **Google Takeout** (YouTube and YouTube Music →
history) and import the file.

## Deezer (live, 3.1)
My music → Deezer → **Set up**: create an app at developers.deezer.com/myapps, set its
application domain / redirect URL to the address the form shows, paste the Application ID and
Secret key, then **Save and connect**. Reads listening history and favourite tracks. Deezer has
at times paused new app registration; if so, import an export instead.

## ListenBrainz (live, 3.1)
My music → By user name → ListenBrainz → **Connect**. Public listens need no password
or app; an optional user token (listenbrainz.org → Settings) only raises rate limits.

## Apple Music (live, 3.1)
Requires an Apple Developer Program membership (Apple's rule for MusicKit). In Certificates,
Identifiers & Profiles → Keys, create a key with **Media Services (MusicKit)** and download the
.p8 file. My music → Apple Music → **Set up**: paste Team ID, Key ID and the .p8 contents
(or a developer token you already have). The developer token is signed on your computer.
**Connect** opens Apple's MusicKit sign-in; Apple returns a Music User Token to the app.
Without a developer membership, import the Apple privacy export (Play Activity CSV).

## Privacy
Your listening data stays on this device. The app runs a **local-only** HTTP server on
`127.0.0.1` and makes no network calls unless you connect a service (Spotify, Apple Music, YouTube
Music, Deezer, Last.fm, ListenBrainz) or open a music link yourself. No cloud, no accounts on our side, no tracking, no payments.
