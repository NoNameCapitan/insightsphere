# VetNear v1.15 — launch preparation

Release date: 2026-11-09

## User-facing improvements

- Added a compact **«Актуальне для власників тварин»** strip on the home page and a
  fuller `/kyiv-updates` page. It covers current Kyiv animal news, events, vaccination
  and public-health guidance without subscriptions, email or push notifications.
- Added current owner guidance for animal bites and suspected rabies with a direct link
  to Kyiv's official anti-rabies information. The page clearly routes human exposure to
  medical care rather than treating it as a veterinary-only problem.
- Added direct links from `/lost-found` to Kyiv's official lost/found animal registry,
  while keeping VetNear's local demo data separate and avoiding copied personal contacts.
- Updated A‑Vet Obolon as a source-checked 24/7 candidate with explicit operational
  capability fields. It is not promoted as phone-verified emergency care until direct
  verification is completed.
- Added a small number of restrained capability chips to place cards: night doctor,
  autonomous power and oxygen boxes where supported by sources.

## Alert and shelter reliability

- The shelter button remains enabled only for a fresh, confirmed active Kyiv alert.
- The client now preserves the server explanation for `unavailable` states instead of
  replacing it with a generic message.
- Added a visible **«Оновити статус»** action beside the disabled shelter control.
- The Ukraine Alarm token remains server-only in `UKRAINE_ALARM_API_TOKEN`; no token is
  bundled in this archive.
- Shelter routing still fails closed for stale alerts, missing geolocation, malformed
  shelter data, all-clear events and upstream errors.

## Content maintenance

- Replaced obsolete event cards with a dated dataset as of 2026-11-09.
- Added status labels that distinguish confirmed, source-checked, phone-check and
  coming-soon information.
- Retained the detailed emergency-provider verification checklist for launch operations.

## Production checklist

1. Rotate any credential that has appeared in a message or screenshot.
2. Set the new token as the server-only `UKRAINE_ALARM_API_TOKEN` environment variable.
3. Deploy over HTTPS so browser geolocation works.
4. Run `npm run check:alarm` in the deployment environment.
5. Run `npm run verify` before release.
6. Phone-verify emergency-provider claims before applying a public “verified” badge.
