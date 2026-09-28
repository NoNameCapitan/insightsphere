# Monetization (future-ready, no payments)

This project is a **local-first personal Music DNA workspace**. There is no payment
system, no checkout, no subscriptions, and no data collection. This document only
sketches *ethical, simple* ways the tool could be supported later — nothing here is
active infrastructure.

## Possible directions (all optional)

- **Personal Music DNA reports** — generate a polished, shareable report (already built:
  `music_dna_report.py`). Could be offered as a paid one-off export or a nicer PDF.
- **Custom recommendation / discovery packs** — curated packs for a mood, project, or
  creator brief.
- **Creator music-discovery packs** — themed candidate lists for video/Reels/Suno work.
- **Setup & support service** — help people run the local tool, configure Last.fm/Spotify.
- **Local tool download / support** — a paid "supported" build, donations, or tips.
- **Consulting / customization** — bespoke taxonomy or workflow work.

## Packaged offers (product framing, still no payment code)

These are **soft product descriptions** for a service you could offer manually. The tool
generates the deliverables locally; money/handoff happens off-platform (e.g. email, invoice
of your choice). Prices are *starter suggestions only*, not commitments.

### Offer 1 — Personal Music DNA Report ($10–25)
The person sends a listening export (Spotify export, Last.fm username, or a CSV/JSON of
tracks). You run the tool and deliver a taste analysis plus three recommendation packs
(Safe / Adjacent / Wildcard). Deliverable: the Markdown DNA report (PDF later, manually).

### Offer 2 — Creator Music Pack ($20–50)
Mood- and brief-driven track suggestions for TikTok / Reels / YouTube / AI-video / game
scenes. Deliverable: 20–40 tracks with artist + search links + a one-line reason each, built
from the candidate engine and deep-genre direction. No audio files, just curation + links.

### Offer 3 — Setup Help ($15–40)
Hands-on help to run the local tool and configure Last.fm / Spotify read-only access on the
person's own machine. Deliverable: working local setup + a short written how-to. No hosting,
no accounts created on their behalf beyond their own credentials.

### Offer 4 — Custom Genre Research ($15–35)
A deep-genre discovery pack around a niche the person cares about (e.g. "atmospheric black
metal adjacent to dungeon synth"). Deliverable: a curated subgenre map + representative
tracks + search links, using the taxonomy and discovery controls.

### Compliance for all offers
- Sell **your analysis, curation, setup work, and reports** — never raw Last.fm/Spotify data.
- Keep all listening data **local and private**; do not build a cloud dataset of it.
- Last.fm data is non-commercial without permission; Spotify use stays within read-only
  OAuth + Search, no playlist export, no audio-features, no `/recommendations`.

## What is intentionally NOT here

- No Stripe / PayPal / checkout / subscriptions / hard paywall.
- No analytics, no tracking, no selling of user data.
- No claim that Last.fm or Spotify data can be resold.

## Soft hooks that DO exist

- `SUPPORT_URL` (env): if set, the local UI footer shows a single "Support this project"
  link. If empty, nothing is shown.
- `REPORT_BRANDING_NAME` (env): if set, the exported Music DNA report includes this name.

## Compliance notes (read before any monetization)

- **Last.fm API data is for non-commercial use** unless you obtain explicit permission
  from Last.fm. Do not resell Last.fm data or derived datasets.
- **Spotify** features must comply with the Spotify Developer Policy and Terms; this app
  uses read-only OAuth and plain Search only — no audio-features, no `/recommendations`,
  no write scopes, no playlist export. Do not resell Spotify data.
- The **safest early monetization is service/support and report generation** (work you do
  for a person), not reselling third-party API data.
- Anything user-specific stays local; monetization must not introduce cloud collection of
  personal listening data without explicit, informed consent and a proper privacy policy.
