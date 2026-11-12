# VetNear v1.29 — final polish

Presentation only, on top of v1.28. No route, API, data, validation, triage,
verification or safety logic changed.

## Fixed: content could stay hidden
- Category cards and other below-the-fold blocks were hidden until scrolled
  (scroll-reveal effect). On a slow device, in a screenshot or for a reader who
  had not scrolled yet this looked like an empty section.
- Category cards are now always visible (a short CSS-only fade on load).
- Every scroll reveal fails open: if the page is not scrolled within ~2 s of
  loading, all armed content is shown.

## Categories
- `grid-cols-2` on phones, `grid-cols-3` from `sm`; equal-height cards
  (`min-h-[140px]`), `rounded-2xl`, tinted off-white surface, soft border.
- 56 px clay tile, semibold title, `text-xs` subtitle.
- Calm interaction: ring + shadow on hover/focus, 180 ms icon bounce on press.
  The 3D tilt and gradient edge were removed from these cards.

## Place cards
- New reading order: name → category · district → address, then one pill row
  with **distance first**, live status and data-trust badge.
- Soft per-category accent (top bar, icon ring and shadow): clinic teal,
  pharmacy soft blue, pet store warm green, grooming peach, boarding
  purple-gray, shelter mint, emergency coral.
- Tighter vertical rhythm; cards arrive with a 12 px fade-up, 45 ms apart.

## Scenarios ("Коли важлива кожна хвилина")
- Phones: a plain vertical list of compact rows (no sideways scrolling).
- Desktop ≥1024 px: all four cards in one row; arrows only on tablets.

## Hero
- Phones: smaller orbit and tighter spacing, so headline, both CTAs and the
  stats band fit the first screen.
- Pin is sharper (no blur-in reveal, no blend overlay, larger image source)
  and breathes calmly (4 s).

## Motion system
- Tokens: `--dur-fast` 180 ms (press), `--dur` 300 ms (hover/colour),
  `--dur-slow` 520 ms (position), all on `--ease-out`.
- Canonical keyframes: `fadeUp`, `breathe`, `shimmer`, `iconBounce`,
  `tabSpring`.
- Focus is an outline that follows the element's own shape (it used to force
  a different corner radius on focus).
