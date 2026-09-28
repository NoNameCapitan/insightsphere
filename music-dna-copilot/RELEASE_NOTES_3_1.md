# Music DNA Copilot 3.1 — Live connectors

3.1 turns the Sources page into a place where you **connect** services, not only import
files. Every connection is read-only and stays on your computer.

## What's new

| Service | How you connect | What Music DNA reads |
|---|---|---|
| **ListenBrainz** | type your user name | your latest 5,000 public listens |
| **Spotify** | paste your app's Client ID once, then **Connect** | top, recent, saved, playlists, followed artists |
| **YouTube Music** | paste a Google "Desktop app" client once, then **Connect** | songs you liked (Music category) |
| **Deezer** | paste your Deezer app ID + secret once, then **Connect** | listening history + favourites |
| **Apple Music** | paste your MusicKit key once, then **Connect** → Apple sign-in | recently played, heavy rotation, library |
| **Last.fm** | username + free API key (unchanged) | recent scrobbles |

- **One-time setup, then one click.** Each card with a live connection has a setup form:
  numbered steps, a link to the service's developer page, the exact redirect address to
  register (with **Copy**) and a **Stay connected on this computer** switch.
  **Save and connect** stores the credentials, sends you to the service's own consent
  screen and, when you come back, runs the first sync automatically.
- **Honest cards for everything else.** TIDAL, SoundCloud, Amazon Music, Qobuz, Bandcamp,
  Yandex Music and Pandora have no usable public API for listeners; their cards say so and
  offer import instead of a fake button.
- **Imports and live syncs add up.** A live sync is stored next to (not over) an export you
  imported from the same service, and the DNA counts both under that service.
- **Privacy & Data** lists the credentials file and adds **Forget all connections**.

## Security
- PKCE for Spotify and Google; single-use sign-in states with a 10-minute lifetime; Deezer's
  state rides in the redirect URI because Deezer does not echo it.
- Credentials and remembered tokens: `connectors.json`, mode 0600, outside `outputs/`,
  never in release archives. Without "stay connected" tokens are memory-only.
- `/connect/*` routes keep the loopback Host guard; the MusicKit token post requires the
  app header (CSRF). Only the Apple sign-in page may load Apple's MusicKit script.
- Apple developer tokens are signed locally in pure Python (ES256, RFC 6979), verified
  against OpenSSL in development.

## Tests
- `scripts/test_live_connectors.py`: 105 offline checks with fake HTTP in each service's
  documented response shape: URLs and scopes we send, pagination limits, token refresh,
  storage permissions, card honesty, the HTTP routes and replay protection.
- Browser run (Chromium): ListenBrainz connect by user name; YouTube Music setup → (simulated)
  Google consent → callback → automatic sync; Privacy "Forget all connections"; no JS errors,
  no horizontal scroll at 390 px.
- `smoke_test.py`: 196 passed, 0 failed.

## Limitations
See `KNOWN_LIMITATIONS.md` → "3.1". In short: the one-time developer-app setup is required
by the services; YouTube has no play-history API; Apple needs a paid developer membership;
the connectors were not exercised against the live services from the build environment.
