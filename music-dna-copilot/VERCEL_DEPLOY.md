# Deploying to Vercel (demo mode)

This project has **two modes**. Both use the same recommendation engine.

| | Local self-test mode | Vercel demo mode |
|---|---|---|
| Entry | `python3 scripts/start_app.py` | `api/recommend.py` (serverless function) + static `index.html` |
| Server | local `HTTPServer` on 127.0.0.1 | none — per-request Vercel Python function |
| Storage | `outputs/` (feedback, presets, reports, config) | **in-memory only**, nothing written |
| Last.fm / Spotify | full UI setup, PKCE OAuth | **local/self-test only** (see §7) |
| Feedback memory / presets / reports / queue | yes | no (demo scope) |

## 1. Why the original app failed on Vercel
`scripts/local_interface.py` starts a long-running `HTTPServer` bound to `127.0.0.1` with
`serve_forever()`, reads/writes local `outputs/`, and has no importable WSGI/ASGI/handler
entrypoint. Vercel runs **per-request serverless functions** — it cannot host an infinite
local server loop, so it reported "No python entrypoint found". Pointing `pyproject.toml`
at that file would not have helped; the architecture had to change for hosting.

## 2. Local mode vs Vercel demo mode
Local mode is unchanged and full-featured. Vercel demo mode is a thin, stateless wrapper:
`api/_engine.py` imports the existing `analyze_taste` + `generate_recommendations`
functions and runs them **in memory** (no `outputs/` writes, no feedback files, no
credentials), and `index.html` is a static responsive UI that calls `POST /api/recommend`.

## 3. Run locally
```
python3 scripts/start_app.py          # full app at http://127.0.0.1:8765/
python3 scripts/start_app.py --check  # status report
```

## 4. Deploy to Vercel
1. Push this folder to a Git repository (GitHub/GitLab/Bitbucket). The repo contains no
   secrets by design; `.env`, tokens, `outputs/` data are git-ignored.
2. In Vercel: **Add New → Project → Import** the repo.
3. Framework preset: **Other**. No build command, no output directory, no env vars needed.
4. Deploy. Vercel serves `index.html` at `/` and the Python function at `/api/recommend`
   (the function name follows Vercel's native Python runtime: a `BaseHTTPRequestHandler`
   subclass called `handler` — zero pip dependencies).
5. `vercel.json` bundles `scripts/`, `examples/`, `data/`, `schemas/` into the function via
   `includeFiles` so the engine and demo datasets are available.

CLI alternative: `npm i -g vercel && vercel` in the project folder.

## 5. What works on Vercel
Homepage; **Use demo library**; **Owner-style demo taste** (60-track dark/heavy dataset);
**paste your tracks** ("Track — Artist", "Track - Artist", "Track by Artist"); mood / task /
novelty / strictness / include / exclude controls; Music DNA summary (tone, energy, novelty
tolerance, top genres/artists); Safe Match / Adjacent Discovery / Wildcard groups with a
"why" and a "risk" per track; YouTube/Spotify **search links**; **Copy JSON** and
**Copy Markdown** in-browser.

## 6. What does not work on Vercel yet
Last.fm and Spotify account connection; feedback memory (favorites / listen-later /
rejects); saved presets management; queue; full Music DNA report export; local data page.
These need persistent, per-user storage — the hosted demo is intentionally stateless.
The UI says so honestly; nothing is faked.

## 7. Why hosted Last.fm/Spotify needs a real auth/session/storage design
Locally, credentials live in *your* `outputs/local_config.json` and the Spotify PKCE token
in *your* `outputs/` — one user, one machine, your disk. A hosted version would have to
(a) identify users (sessions/accounts), (b) store per-user API keys and OAuth refresh
tokens encrypted server-side, (c) host an OAuth callback on the public domain and rotate
tokens, and (d) take on the privacy/compliance duty of holding third-party credentials.
That contradicts the local-first promise and is real product work — so on Vercel these
providers are labeled **local/self-test only** instead of being faked.

## Hygiene
No `.env`, tokens, `outputs/local_config.json`, generated personal outputs, caches, or
nested zips are in the repo or the release archive. `.env.example` and demo datasets only.


### Vercel entrypoint note

The hosted demo uses `api/index.py` as the default Vercel Python entrypoint, re-exporting `api/recommend.py:handler`. The frontend calls `/api`.

## 2026-07-04 root-route fix

If the deployed site shows raw JSON at the root URL, Vercel is routing `/` into the Python API handler instead of serving the UI. This package fixes that by using `app.py` as the Vercel entrypoint:

- `GET /` serves `index.html`.
- `GET /api` returns API health JSON.
- `POST /api` generates demo recommendations.
- `GET/POST /api/recommend` remains supported for compatibility.

Deploy the folder that contains `app.py`, `index.html`, `pyproject.toml`, `vercel.json`, and `api/` as the Vercel Root Directory.
