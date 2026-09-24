# Music DNA Copilot 3.0 — Product release

> Your music is fragmented across services. Music DNA understands all of it.

3.0 is a productization release: the 2.x engines are kept and wired into one consumer
experience built around a single loop:

```
CONNECT → UNIFIED MUSIC DNA → CURRENT INTENT → CAPSULE → LISTEN → REACT → DNA LEARNS → BETTER NEXT CAPSULE
```

Run it exactly as before (`python run_app.py` or the `RUN_APP_*` launchers). The app opens
at `http://127.0.0.1:8765/`. The previous workspace is still available at **`/classic`**
(Settings → Classic workspace).

## Information architecture

| Home | DNA | Capsules | History | Sources | Settings |
|---|---|---|---|---|---|
| DNA summary, intent, capsule tier, **Open capsule** | Taste map, core vs right now, change feed, dimensions | Generator + player | Past capsules, new discoveries | Providers, imports, unified counts | Playback, motion, Privacy & Data, Advanced |

Engineering tools (Quality Lab, beta dashboard, identity graph, diagnostics) live under
**Settings → Advanced** and never appear in the main navigation.

## What's new

- **Guided first run**: welcome → sources → real analysis (streamed build steps with
  measured timings, no artificial delays) → DNA reveal → first capsule. A clearly labelled
  demo library is available for people without data; it never mixes with real data.
- **Sources dashboard** with honest states. Capability: `LIVE CONNECTION`, `IMPORT`,
  `REQUIRES SETUP`, `COMING SOON`. State: `Connected` only when a live session or
  credentials prove it; `Imported` when a normalised export exists. New: Spotify
  Extended Streaming History import (<30 s plays and podcasts not counted, track URIs kept);
  per-service imports; exact-duplicate file detection.
- **Unified DNA** keeps raw events, unique tracks, artists and sources as separate numbers.
  Dimensions (genre, microgenre, artist, familiarity, novelty, discovery tolerance,
  mainstream↔niche, recent shift, context) show a value *with its basis*, or
  "Not enough data" with the reason.
- **DNA map**: an orbital taste structure (families closer = stronger, genre/microgenre
  satellites, artist ring). Hover/focus reveals connections; Enter pins a family; recently
  changed families glow briefly; a List view is the accessible alternative. Idle motion
  is only on decorative orbits and turns off under reduced motion.
- **Core DNA vs Right now**: session taste (last 6 h, capped at ±12%) reranks the next
  capsule but never mutates durable DNA; it can be reset.
- **Why did my DNA change?** Evidence-based feed built from recorded reactions only
  ("You listened through 2 related tracks, saved 1 and replayed 1 during the last 30 days"),
  with cautious confidence labels.
- **Capsules** with behavioural identities:
  Common (5, close), Rare (10, balanced), Legendary (15, far), Mystery (10, hidden).
  Pipeline: candidate retrieval → ranking → **reranking (new)** → packaging. Reranking uses
  session taste, tier identity, avoidance of recently served tracks and rejected artists,
  and never re-serves a rejected track.
- **Capsule player**: current track, progress, "Why this track?", honest playback actions,
  Love / Save / Listened / Replay / Skip / Not for me, and progressive "More feedback"
  (More like this / Too similar / Too strange). Completion summary shows only conclusions
  supported by recorded events.
- **Mystery**: redaction is server-side. Before reveal, the browser receives no title,
  artist, genre, reason text or link. Any reaction (or Reveal) reveals the track. Internal
  identity is kept for learning.
- **Playback routing**: preferred service + ordered fallbacks. "Open in X" only for an
  exact match (provider id / ISRC / exact metadata); searches are always labelled
  "Search X". A fallback is announced ("Not found directly on Apple Music. Available on
  Spotify."), with a search on the preferred service offered next to it.
- **Privacy & Data**: what stays local, what's imported/stored, what analytics contain;
  exports (DNA, history, feedback, analytics); confirmed resets and deletions. Imported
  history is only ever removed per source, explicitly.
- **A/B**: stable local variant (`control` score order vs `challenger` MMR genre
  diversity); variant and algorithm version stored on capsules, feedback and events.
- **Beta dashboard**: funnel, returning-user proxy, completion/save/replay/rejection rates
  by tier, context, provider and variant (local only; no titles or artists).

## Learning safety

- A single skip moves a genre by < 0.2 (tanh-bounded, unchanged from 2.4).
- **New:** negative reactions inside Legendary/Mystery capsules count half, since
  exploration is expected to miss sometimes.
- **New:** one capsule can move a genre/artist only a bounded amount (per-capsule cap), so
  one evening never rewrites years of listening.
- Feedback half-life 90 days, history half-life 120 days; learned layer moves any
  recommendation by at most ±18 points.

## Explicit vs implicit signals

The app cannot observe playback inside other apps, so it never infers completion.
`love/save/not_for_me/more_like_this/too_similar/too_strange` are **explicit**;
`completed` ("Listened"), `replay` and `skip` are **self-reported**. The only implicit
event is opening a track link (`track_played` with `value: link_opened`). Every feedback
row stores its `signal_kind`.

## Architecture

```
web/                      3.0 app: index.html, assets/app.js (router + views),
                          assets/dna-viz.js (lazy-loaded map), assets/app.css
scripts/dna3/             product layer (stdlib only)
  store.py                settings, atomic writes, corrupted-file quarantine, diagnostics
  sources.py              provider cards, imports, live sync, error classification
  dna.py                  streamed build, dimensions, session taste, change feed
  capsules.py             retrieval→ranking→reranking→packaging, Mystery, feedback, history
  api.py                  /api/v3 dispatcher (CSRF + Host guards, confirmations)
scripts/local_interface.py  serves / (3.0), /assets/*, /api/v3/*, and /classic (2.x)
```

No dependencies were added; no build step. The app shell loads two small files; the map
module is loaded on demand.

### Security (localhost app)

- State-changing API calls require `X-MusicDNA-Client: 3` (forces a CORS preflight the
  server never grants → no CSRF from other sites); the Host header must be loopback
  (DNS-rebinding guard); destructive calls also need `{"confirm": true}`.
- Strict CSP on the app (`script-src 'self'`, `frame-ancestors 'none'`), `nosniff`,
  `no-referrer`; static serving cannot escape `web/`.

## Accessibility & responsiveness

Semantic landmarks and headings, skip link, visible focus, keyboard-operable map,
`aria-pressed`/`aria-checked` state on toggles, live regions for progress and toasts,
native `<dialog>` confirmations, ≥44 px targets, labelled icon-only buttons, reduced-motion
support (system, or forced in Settings) that keeps all information. Verified without
horizontal scroll at 375, 390, 430, 768, 1024 and 1440 px; mobile uses a bottom nav and
puts the capsule player first.

## Tests

```bash
python scripts/test_v3_product.py      # 97 checks: honesty, Mystery, safety, API, HTTP mount
python scripts/smoke_test.py           # everything, incl. 3.0 and previously-unrun 2.x suites
```

## Known limitations

See `KNOWN_LIMITATIONS.md` → "3.0".
