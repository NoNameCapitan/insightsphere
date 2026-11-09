# VetNear v1.22 — launch essentials, less noise, 3D motion

## Added (needed for launch)
- `/privacy` and `/terms` in Ukrainian, written against the real data flows
  (localStorage-only pet data, anonymous call/route events, third-party map,
  routing, geocoding and assistant services). **Drafts — have a lawyer review
  them before launch.** Set `NEXT_PUBLIC_CONTACT_EMAIL` to show a contact
  address; without it the pages point to the in-product report channel.
- `not-found.tsx` (404 with routes back to help) and `error.tsx` (retry +
  emergency link).
- Share image `public/og.png` (1200×630) wired into Open Graph / Twitter.
- Footer regrouped into three columns, with the legal links.

## Removed (distracting or not launch-ready)
- Home hero: the two chips under the trust line and the duplicate "data with
  last-check date" line in the cockpit.
- Home: the non-clickable icon showcase card (`IconShowcase` deleted; four of
  its icons now live on the trust cards) and the "Популярні розділи" pills
  (the same links are in the footer).
- Place page: the "Орієнтовна наявність товарів" block. It showed synthetic
  prices and stock on real shops.
- `/products-nearby` and `/pet-scan`: routes still work by direct URL, but are
  out of the footer and sitemap, `noindex`, and disallowed in robots.txt until
  they have real data / a real provider.

## 3D motion
- Hero cockpit tilts towards the pointer anywhere in the hero, with the pet
  artwork and result card on separate depth planes, a moving glare and a 3D
  entrance; on touch screens it turns slowly on its own.
- Hero motion pieces shift in depth-based parallax against the pointer.
- `Tilt3D`: care-path cards and trust cards lean under the pointer with a
  specular glare and the icon lifted off the surface.
- `RevealGroup`: staggered 3D rise for the care grid, updates and trust cards.
- `GeneratedVisual`: 3D reveal, 3D idle loops, and a slow orbit for tilt
  visuals so they read as solid objects without a pointer.
- All of it is off under `prefers-reduced-motion`.
