# VetNear v1.31 — premium owner experience and functional fixes

Prepared 16 November 2026 from `vetnear-v1_30-release-hardened.zip`. This is a locally verified candidate for staging, not a claim of a completed public or national launch. No production service, database, deployment or clinic data was changed.

## User experience

- The home screen now has a real animal/service search form, direct urgent action and a clear current coverage link. It retains the warm teal identity and supplied artwork; removes the fictional clinic preview, unmeasured 90-second promise and redundant animated hero counters.
- Pet records and backups are discoverable from the home screen with an explicit browser-local storage explanation.
- Nearby search has a visible location context, always-accessible manual entry, name/address search, honest no-location distance labels and progressive lists of 12 results. Map/list buttons expose selection; radius controls support arrow/Home/End keys.
- Location requests require an explicit action. A restored manual point is not silently replaced by a mount-time GPS request. Denied-location forms can be collapsed and reopened with consistent accessibility state.
- Switching the active pet synchronizes the species filter. A saved pet of a different species is not silently attached to a search started from the homepage.
- Urgent navigation opens the urgent scenario immediately. A separate `urgentIntent` flag disables paid ranking and promotional labels while preserving ordinary veterinary clinics as a fallback; it does not falsely turn them into confirmed emergency providers.

## Search and trust

- Failed, invalid, empty or timed-out geocoding never substitutes central Kyiv. Up to five named results are displayed for explicit selection. Editing the query cancels stale requests.
- Coordinates are validated as finite WGS84 values. GPS is held in memory; a manual point uses tab-session storage and is restored only within one hour. Untimed legacy location storage is removed.
- Opening hours use `Europe/Kyiv` by default, with optional per-place IANA `timeZone`. Previous-day overnight shifts, split shifts, DST and exclusive closing times are handled. Invalid/missing schedules give `unknown`, not a fabricated closed/open state.
- Emergency/24-hour claims require structured phone evidence and suitable verification/publication state. `verifiedBy` text alone cannot create a phone-confirmed badge. Emergency-category filtering cannot bypass this gate, and a 24-hour shop is not an emergency veterinarian.
- Cards, maps, details and JSON-LD use aligned trust predicates. Schedule status is described as “за графіком”. Invented review counts were removed from structured data.
- Provider detail pages and metadata use the public feed instead of seed-only lookup, allowing server-published listings to resolve.

## Pet records

- Storage failures are surfaced and entered data remains in the form. File-read errors, invalid numbers and invalid files are handled explicitly.
- Backup import validates version, species, nested records, dates, attachments and IDs before writing. Duplicate IDs and older conflicting records are rejected without partially applying the import.
- Automatic universal 12/3/1-month medical intervals were removed. The next date is optional and entered by the owner using veterinary advice; existing records are preserved.
- Attachments on vaccination/treatment/visit records are accessible. Adding an old weight measurement no longer replaces a newer current weight.

## Delivery, privacy and PWA

- Partner submissions and reports distinguish local saving, confirmed server receipt and unconfirmed delivery. Pending/error states prevent false success and duplicate clicks. A moderation publication failure is visible to the operator.
- The release gate rejects both boolean spellings used to enable demo emergency mode.
- The service worker caches bounded static assets, bypasses RSC/API/private/dynamic responses, removes only its own legacy caches and serves an explicit offline page. It is not registered in development.
- Raw IP addresses are replaced with HMAC keys in rate-limiting stores. Existing server configuration supplies stable shared secret material. Privacy text identifies the anti-abuse processor and short retention windows; raw provider errors are not logged.

## Validation

- `npm run verify`: lint, TypeScript, 387 tests across 32 files, production build — passed.
- `npm audit --omit=dev`: 0 reported vulnerabilities at the time of this check. This is not a security certification.
- Scripted browser scenarios run against `next start` in Chromium with isolated fictitious pet records and mocked geocoding/error responses. See `docs/qa/browser-qa-results.json` and `docs/UX_REVIEW_V1_31_RU.md` for exact coverage.
- Responsive home captures at 320, 390, 768 and 1440 CSS pixels. These are viewport checks, not physical Android/iOS device tests.

Next.js reports React 18 support as deprecated. Plan a separately verified React 19/React-Leaflet migration before adopting Next.js 17; no framework migration is hidden in this release.

## Still required before public scale

- Apply and validate migrations 001–004 on staging; configure production credentials; execute release gate and live Supabase/UkraineAlarm/shelter/lead checks; rehearse rollback.
- Phone-confirm relevant providers and set a documented re-verification policy. Source-level evidence is not a live availability guarantee.
- Make moderation/publication atomic or recoverable; suppress withdrawn seed records; paginate moderation beyond 200 and replace the global 2,000-place feed with spatial querying.
- Add country/territory adapters, full localization, a species/capability evidence model, rural distance/service areas and real provider coverage before claiming national or international support.
- Complete clinical/species review of triage; unify assistant urgency detectors; finish reminder lifecycle and individual record editing; implement real bookings/inventory only with backend confirmation.
- Full accessibility and screen-reader review, physical-device QA, field performance and production monitoring remain separate release gates.

See `PREMIUM_PRODUCT_BLUEPRINT_RU.md` for 18 critical journeys, species/rural/country requirements and 26 prioritized tasks with acceptance criteria.
