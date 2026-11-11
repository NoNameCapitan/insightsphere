# VetNear v1.27 — premium visual pass

Built on v1.26.2. **Presentation and motion only**: no routes, API handlers,
data, validation or safety logic were changed.

## Hero
- **3D orbit scene** (`HeroOrbit`): the VetNear pin stands on a pulsing
  "search radius" while six clay category tiles circle it in real 3D — they
  pass in front of the pin and then behind it. Used on mobile and in the
  desktop cockpit.
- **Headline** arrives word by word; the last word carries an animated teal
  gradient and a hand-drawn apricot underline.
- **Primary button** gained a lit gradient, a sheen that crosses on hover and
  an arrow that nudges forward.
- **Stats band** with the real dataset numbers (places, verified, districts),
  counted up once. It replaces the old one-line trust text.

## Across the app
- **Floating glass header** with a current-page indicator; **glass tab bar**
  on mobile with a lit current tab.
- **Pointer spotlight** on every card; result cards arrive one after another.
- **Scroll reveal** for sections that start below the fold (once, never on
  scroll back), and a hairline **scroll progress** bar.
- **Tagline section** on the home page: a large statement whose words light
  up in reading order while scrolling.
- One easing curve (`cubic-bezier(0.22, 1, 0.36, 1)`), fine film grain, a
  footer wordmark, `text-wrap: pretty`, a skip-to-content link.
- **One typeface**: Manrope everywhere (the Inter dependency was removed).

## Guarantees
- Everything is disabled or reduced under `prefers-reduced-motion`.
- Server HTML shows final content; JS only arms effects, so nothing depends
  on scripts to become visible. Print styles keep all sections visible.
- The new CSS uses only inline SVG data and local assets, so it fits the
  stricter v1.26 Content-Security-Policy.
