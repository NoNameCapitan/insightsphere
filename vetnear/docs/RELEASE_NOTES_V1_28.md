# VetNear v1.28 — motion and depth refinements

Presentation only, on top of v1.27. No route, API, data, validation or safety
logic changed. All motion is disabled under `prefers-reduced-motion`.

## Hero
- Orbit turns once every 12 s (was 30 s). A tile hops and scales when hovered
  (the carousel pauses under the pointer) or tapped.
- Three depth levels move by different amounts with the pointer: two far
  rings, the ground with the search pulse, and the orbit itself.
- A breathing halo behind the pin; paper grain inside the hero aura.
- Primary CTA: an idle shimmer roughly every five seconds.
- "Термінова ситуація" is now a pill with a coral glow and a soft ring pulse.

## Categories
- Clean 2×3 grid on mobile (3×2 on desktop). A sixth card, "Усе поруч",
  completes the grid instead of advertising the empty shelter category.
- Larger clay tiles, a gradient edge on hover/focus/press, a 3 px icon hop on
  press, and a faint paw pattern behind this section only.

## Place cards
- Thin top accent in the category's colour (same colour as its map marker).
- "Відкрито / Зачинено" and provenance badges are pills with drawn icons
  (no text glyphs). Labels and verification logic are unchanged.
- Cards arrive with a 12 px rise, one after another.

## Colour
- Teal a touch more saturated (`#06756A`, 5.6:1 on white); emergency is a
  warmer coral red (`#CF4436`, 4.6:1 with white text).
- Cards use an off-white with a 2% green tint; ink is slightly greener.
- One warm accent (apricot) for active filters and card hover edges.

## Motion details
- "Знайдено" tweens between values when the radius or filters change; screen
  readers get only the final number.
- Current tab settles with a soft spring; skeletons use a mint–apricot shimmer.
- Map pins: softer shadow, and a gentle pulse under places open right now.
- District map: darker contact shading and a drop shadow under the lifted piece.
