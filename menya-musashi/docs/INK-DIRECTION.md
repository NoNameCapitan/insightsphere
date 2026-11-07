# Ink / Torisho / emerald edition · 06.11.2026

## Supplied references
- IMG_8296.png: Menya Musashi × Torisho poster, charcoal, orange torii, mature ink/halftone samurai and muted green clothes. Retained as reference-torisho-poster.png.
- v24044gl0000dbhq1g7og65qstn39900(1).mp4: 27.5 seconds. Inspected via sequential frames at two-second intervals. Relevant mechanics: opening painted panels, inward scene depth, high-contrast ink transitions, hold-to-pour, shift from illustration to product. Adapted these mechanics rather than copying the unrelated product or branding.

## Implementation
- New torii and foreground ronin layers adapted from the supplied poster, independently generated with built-in image generation. Foreground alpha retained; assets encoded as WebP. Heavy ink, warm ivory, orange #ff6a00, charcoal #252929; emerald #17664f limited to clothing, foliage and interaction accents. Current palette is a proposal, not an asserted official brandbook.
- Pointer parallax and shallow scroll depth. Gentle wind movement while visible. Gate button plays a 1.3s split ink-curtain transition and reveals genuine Kyiv food panorama; reversible and keyboard-operable. Menu/venue controls are always directly available.
- Mobile illustration first; compact two-line headline, venue selection, prominent menu action and fixed bottom menu/official-order actions.
- Existing culinary eight-cel scene retained, colors/contrast aligned to the palette. No cinematic intro gate or scrolling interception.
- Pour interaction: two photographic states edited from the original source lemonade photograph, composited as CSS backgrounds. Glass/garnish mask keeps scene clean; liquid rises from bottom with stream and ring progress. Press and hold, release to pause, short tap or keyboard activation plays through; reset repeats. Reduced-motion instantly shows final state. Original source photo remains in dish modal.
- Pour promo only appears for rows with the exact canonical source photo assets/dish-81.webp and matching lemonade name. Other venues keep their real bar assortment; no invented drink or price. Item dialog reads the selected venue row.
- Manual and OS reduced motion, offscreen/hidden-tab stopping, pointer cancellation. No autoplay audio or tracking.

## Source hygiene
45 byte-identical WebP files consolidated after SHA-256 comparison (4,723,069 bytes removed). Original source URLs preserved; image-sources.json retains originalFile for aliased files, aliases in identical-photo-aliases.json. Builder regenerated the same 1380 item rows / 9 venues, 339 source records, 0 missing photos. Static references and large-image mappings updated. Fixed stale storyTimer references in edition.js that could throw when motion/visibility changed.

## Assets and scope
- torii-ink.webp: generated environment from user poster.
- ronin-ink.webp: generated transparent foreground from user poster.
- lemonade-pour.webp: AI-edited two-state visualization derived from genuine restaurant photo; not a replacement catalog photo. A second background-cleanup edit used before compositing.
- Menu snapshots remain dated 06.11.2026. This remains an unofficial private proposal; no live menu synchronization, payment or order submission. Official Choice links handle onward ordering.
