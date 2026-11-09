# Data verification checklist

Run this for **every** place before it is imported as verified launch data.
A row may be marked `verification_status=verified` only when all boxes are ticked.

- [ ] **Address checked** — matches the real location (map + street view / visit)
- [ ] **Phone checked** — called and reached the business
- [ ] **Working hours checked** — confirmed (note `24/7` only if truly round-the-clock)
- [ ] **Emergency availability checked manually** — for `emergency_vet` / `emergency_available=true`, confirmed by phone
- [ ] **Website / social checked** — links resolve and belong to this business (no placeholder/demo URLs)
- [ ] **Category checked** — correct primary category
- [ ] **Coordinates checked** — `lat`/`lng` point to the actual entrance (no central-Kyiv fallback)
- [ ] **Duplicate checked** — not already present under another name/branch
- [ ] **Last verified date recorded** — `last_verified_at` set to the check date
- [ ] **Verifier recorded** — `verified_by` set

## Re-verification cadence

- Emergency / 24h listings: re-verify at least every 30 days.
- Standard listings: re-verify at least every 90 days; surface the
  "data may be outdated" badge once `last_verified_at` ages past the threshold.
