# Kyiv real-data import

How to replace the synthetic demo dataset with manually verified Kyiv places.
Until this is done, the app must run in demo mode (see data provenance + badges).

## Source of truth

`data/templates/places-import.csv` defines the import schema. One row = one place.
All rows must be **manually verified** before import (see
`docs/data-verification-checklist.md`). Demo rows must never be mixed into a
"verified" import file.

## Columns

| Column | Required | Notes |
|---|---|---|
| `name` | yes | Official business name |
| `category` | yes | One of: `veterinary_clinic, emergency_vet, pet_store, vet_pharmacy, grooming, shelter, animal_volunteer_help, pet_boarding, dog_walking, dog_training, pet_friendly_place, other_pet_service` |
| `district` | yes | Kyiv district slug (e.g. `pozniaky`, `pechersk`) |
| `address` | yes | Street address |
| `lat`, `lng` | **yes for map** | Decimal degrees. **No coordinates ⇒ the place is `needs_geocoding` and cannot appear on the map** (see coordinate-safety rules). |
| `phone` | yes | E.164 preferred (`+380...`) |
| `email`, `website`, `instagram`, `facebook`, `telegram` | no | Real, checked links only — never placeholder/demo URLs in a verified import |
| `working_hours` | yes | Human-readable; `24/7` for round-the-clock |
| `animal_types` | yes | `;`-separated (e.g. `dog;cat`) |
| `services` | no | `;`-separated |
| `emergency_available` | yes | `true`/`false` — **only `true` if manually confirmed** |
| `appointment_required`, `delivery_available`, `pickup_available` | no | `true`/`false` |
| `data_source` | yes | `manual_verified` for launch data (`manual_unverified` only for staging) |
| `verification_status` | yes | `verified` for launch data; `needs_geocoding` if coordinates are missing |
| `last_verified_at` | yes | ISO date `YYYY-MM-DD` of the manual check |
| `verified_by` | yes | Who verified it |
| `notes` | no | Free text (how/when verified) |

## Process

1. Collect candidate places (manual research; OSM/Google only as leads, never as
   the verified record).
2. Manually verify each row against `docs/data-verification-checklist.md`.
3. Fill the CSV. Geocode addresses to `lat`/`lng`; if you cannot, set
   `verification_status=needs_geocoding` and leave it off the map.
4. Convert the verified CSV into `Place[]` and replace `src/lib/data/places.ts`
   (keep `dataSource`/`verificationStatus`/`lastVerifiedAt` on every record).
5. Run `npm run verify` (lint + tsc + build). Confirm emergency listings are
   `verified` (see `isEmergencySearchSafe`).

## Emergency data (safety-critical — strict rule)

Any place where `category = emergency_vet` **or** `emergency_available = true`
**requires manual phone verification** and must be set to
`verification_status = verified` (with `data_source = manual_verified` and a
`last_verified_at` date recorded at the time of the call). A row that has not
been phone-verified must not be marked `verified` and must not set
`emergency_available = true`.

**Demo emergency data must never appear in public emergency discovery.** In the
app, demo/unverified emergency listings are hidden from public emergency-first
results unless `NEXT_PUBLIC_SHOW_DEMO_EMERGENCY=true` (dev/staging only); when
hidden, a safe empty state is shown instead.

## Safe Google Places import

Google Places is used **only as a source of candidates** for review — never as a
publishing pipeline.

- **Candidates are not public by default.** The importer writes to
  `src/lib/data/google-places.ts` (external candidates), `data/imports/google-places-review.csv`,
  and `data/imports/google-places-raw.json`. It never modifies `src/lib/data/places.ts`.
- **Every candidate stays external:** `dataSource: "google_places_external"`,
  `verificationStatus: "needs_review"` (or `"needs_phone_confirmation"`), `verified: false`,
  `status: "needs_review"`. Nothing is marked `manual_verified` / `verified` until a human
  approves it in `/admin/imports/google-places`.
- **Emergency / 24-7 providers are excluded from automatic import.** `emergency_vet` is not
  in the default category set, and `--exclude-emergency=true` (the default) skips it. Any
  result that looks emergency/24-7 (name, query, types, opening hours) is flagged
  `emergencyCandidate: true` + `verificationStatus: "needs_phone_confirmation"` and separated
  in the review CSV. **Emergency providers require a phone confirmation before public use.**
- **Duplicates** are detected against existing `PLACES` (by phone, website domain, normalized
  name, and coordinate proximity) and marked `duplicateCandidate: true` +
  `matchedExistingPlaceId`. They are never imported as new public places.
- **Review priority** is a simple `qualityScore` (phone/website/rating/reviews/address/coords
  add points; missing phone/coords, emergency, and duplicates subtract). The CSV is sorted by
  score, with emergency candidates listed separately.

### Cost & security

- Keep the **Google API key server-side in `.env.local`** (e.g. `GOOGLE_PLACES_API_KEY=...`).
  **Never** use a `NEXT_PUBLIC_` prefix — that would ship the key to the browser.
- The importer runs only as a Node script (never in the app runtime) and uses a **minimal
  field mask** to reduce request cost.

### Usage examples

```bash
# Default safe categories, several districts, emergency excluded:
npm run import:google-places -- \
  --categories=veterinary_clinic,pet_store,vet_pharmacy,grooming,pet_boarding,shelter \
  --districts=pechersk,obolon,pozniaky,holosiiv,solomianka \
  --limit=100 --exclude-emergency=true

# Narrower run:
npm run import:google-places -- \
  --categories=pet_store,vet_pharmacy,grooming \
  --districts=podil,nyvky,sviatoshyn \
  --limit=80 --exclude-emergency=true

# No API key needed for these (build-safe):
npm run import:google-places -- --empty     # reset to an empty candidate list
npm run import:google-places -- --sample    # one sample candidate for UI testing
npm run import:google-places -- --dry-run   # fetch + score, but write nothing
```

After an import, review candidates at `/admin/imports/google-places`. Approvals there are
the only way a candidate becomes public — and emergency candidates require a phone call first.
