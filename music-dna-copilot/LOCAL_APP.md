# Local App Mode

This project includes a minimal local browser interface designed for a non-technical user.

## Start

Normal users: double-click `start_mac.command` / `start_windows.bat` /
`start_linux.sh` — the server starts and the browser opens automatically.
If port 8765 is busy, the next free port is used and printed.

Developers:

```bash
python scripts/local_interface.py [--port N] [--open]
```

Default address: `http://127.0.0.1:8765`. Note: the Spotify OAuth callback
is registered for a fixed URL, so connecting Spotify works only on the
port from `SPOTIFY_REDIRECT_URI` (default 8765); the app warns when they
differ.

## User flow

The local app uses a single-screen flow:

1. Select source:
   - demo library;
   - manual mini-library;
   - upload normalized JSON;
   - upload CSV;
   - paste normalized JSON;
   - Spotify via OAuth (V2 — requires one-time setup, see `SPOTIFY_SETUP.md`).
2. Set mood slider.
3. Choose task.
4. Set experimentality slider.
5. Click one button.
6. Receive Music DNA + recommendations.
7. Rate picks (saved to `outputs/feedback.jsonl`, gently adjusts next runs).
8. Export Markdown/JSON, copy the AI prompt, or enhance explanations with
   a local Ollama model if you have one.

The UI is available in English, Russian, and Ukrainian (switcher in the
top-right corner; English is the default).

## Streaming access model

Browsers and local Python scripts cannot silently access a phone's music library or a streaming account — that always requires explicit consent and platform authorization.

V2 adds exactly that for Spotify: an explicit OAuth flow (Authorization Code + PKCE) with read-only scopes, started by the user from the UI. Apple Music and local media remain V3.

## Outputs

The app writes local files to:

```text
outputs/local_input_history.json
outputs/spotify_history.json          # when the Spotify source is used
outputs/local_taste_profile.json
outputs/local_recommendations.json
outputs/local_recommendation_prompt.md
outputs/recommendations_export.md
outputs/recommendations_export.json
outputs/feedback.jsonl                # your ratings
outputs/spotify_candidate_catalog.json # when Spotify candidate mode is used
```
