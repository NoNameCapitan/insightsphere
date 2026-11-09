# VetNear v1.21 — motion upgrade, larger visuals, bug fixes

## Visuals & animation
- `GeneratedVisual` now has a layered motion system: scroll-triggered entrance
  (fade, rise, de-blur), idle loops (`float`, `drift`, `bob`, `sway`, `tilt`),
  breathing mint glow, a glossy light sweep clipped to the artwork's own
  silhouette, a contact shadow that breathes with the float, and optional
  scroll parallax.
- The B icon sprite is sliced into 10 separate icons (`public/visuals/parts/`)
  shown as a large tile grid with staggered pop-in, idle bob and a hover jump.
- The I motion sprite is sliced into separate pieces that move on their own in
  the hero: an orbiting ring, a twinkling star, a bobbing check and a drifting arrow.
- The A background now has a slow Ken Burns zoom.
- The nearby map (G) has a pulsing "you are here" beacon at the route start.
- All visuals are 1.5–3× larger: hero C 129→210–240px (it now rises out of the
  card), D/F/H/J about 2× larger, E is a full-width banner, G is a 560px map card.
- Everything is turned off under `prefers-reduced-motion`, and the server HTML
  renders the final visible state (JS only sets up the entrance animation).

## Fixes
- `/my-pets/[id]/records/new`: fixed React hydration error #418 (the pet was read
  from localStorage during render). The record date now uses the local date, not UTC.
- Hero cockpit: the "Зателефонувати" button was clipped and the badges were
  wrapping into broken pills. The card is wider and the badges no longer wrap.
- Mobile header nav: tighter spacing and a soft edge fade instead of text cut mid-word.
- Care-path grid: the odd last card spans the full row on mobile, and an
  incomplete last row is centred on desktop.
- Place page: verified places no longer show the "Перевірено за публічними
  джерелами" badge twice.
