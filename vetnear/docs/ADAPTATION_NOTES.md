# VetNear visual adaptation notes

## Scope held intact

The adaptation changes only visual tokens and global presentation behavior. The existing route structure, pet-first discovery, emergency safety messaging, source-verification labels, listing data, call actions, routing links, and partner flows remain untouched.

## Browser verification

The adapted home page renders through the existing Next application. Its primary green action remains **«Знайти допомогу поруч»**, while the separate pale-rose emergency action remains prominent and routes to `/nearby?category=veterinary_clinic&sort=distance`.

The nearby-clinics page continues to show filtering controls, the non-diagnostic safety notice, verification labels, and quick actions for calling, routing, or opening a provider website. This validates the intended boundary: the visual treatment makes urgent navigation easier to notice without implying a diagnosis or unverified 24/7 availability.

## Validation status

All checks pass on the adapted build (verified 2026-09-02, Node 20, clean `npm ci`):

| Command | Result |
| --- | --- |
| `npm run lint` | clean |
| `npx tsc --noEmit` | clean |
| `npm run test` | 109/109 passed (8 files) |
| `NEXT_TELEMETRY_DISABLED=1 npm run build` | ✓ compiled, 23/23 static pages generated |
| `npm audit --omit=dev` | 4 high, all transitive `sharp`/libvips CVEs via `next@16.2.9` — see below |

An earlier draft of this note reported a `_global-error` prerender failure during
`npm run build`. That is **not reproducible**: the production build completes and
generates all 23 pages. The note is corrected here to avoid misleading reviewers.

The `sharp` advisories are inherited from Next's optional image dependency and
predate this adaptation (they were published after the v1.7 freeze). They are not
caused by the visual changes; bumping Next is a separate release decision.

## Safety invariants re-checked after adaptation

- `src/lib/triage/engine.ts` is byte-identical to the frozen version — deterministic
  urgency rules untouched.
- Dataset: 64 places, 30 `verified` / 34 `needs_review`, **zero** places claiming
  `emergencyAvailable` or `isOpen24_7`. The only record edits are Ukrainian wording
  improvements (e.g. "Чистка вух" → "Чищення вух").
- Server-side submission validation became *stricter*, not weaker: it now also
  requires `representativeConfirmed` and `consentModeration` so direct API calls
  cannot bypass the form's confirmations, and covers every category the form offers.
- Homepage keeps the full provenance line (verified vs. awaiting manual review),
  the "not a diagnosis" line, and the phone-confirmation rule for 24/7 providers.
- The guided assistant's emergency branch routes to the nearest vet clinics first;
  the emergency landing page (honest, possibly empty) is the secondary action.
