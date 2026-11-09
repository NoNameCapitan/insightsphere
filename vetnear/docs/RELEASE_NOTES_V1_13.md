# VetNear v1.13 — Kyiv safety and data refresh

Updated: 2026-09-21

## Data changes

- Replaced the stale `Dr. Shedi` listing at вул. Вірменська, 29 with the official
  municipal veterinary clinic.
- Added all three Kyiv municipal clinics with official addresses, phones, hours,
  provenance and the 2026-09-17 alert operating rule.
- Changed A-Vet to `source_checked`: its 24/7 and autonomy claims remain visible in
  the warning, but emergency/24-7 badges stay disabled until a phone check.
- Updated the Kyiv operational feed with municipal alert rules, 17–20 September
  emergency-demand signals and the 16/18 September Bilychi vaccination results.
- Removed completed or postponed September events from current partnership cards.

## Alert behaviour

- Parses yellow/red level hints when the official upstream payload supplies them.
- Yellow/unknown active alert: municipal clinics show `call-first`.
- Confirmed red alert: municipal clinic routes are disabled and their map markers
  are hidden; calling remains available.
- Outside a confirmed red closure, municipal directions use the official postal
  address rather than approximate seed coordinates.
- Shelter guidance now has a one-tap `Продовжити без підказок` action.

## Verification

- ESLint: passed.
- TypeScript: passed.
- Vitest: 179/179 passed.
- Next.js production build: passed, 25/25 static pages generated.
- The UkraineAlarm credential is not stored in the archive; configure it only as the
  server-side `UKRAINE_ALARM_API_TOKEN` environment variable.
