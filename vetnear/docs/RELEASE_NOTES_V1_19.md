# VetNear v1.19 — Clinical Premium Medical Records

## Product direction

VetNear is now structured around one primary home-screen task: finding the
right nearby help quickly. Pet profiles live in a dedicated **My Pets** area
and have been expanded into private, device-local medical records.

## New and improved

- Refined warm-mineral design tokens, quieter elevation and tactile medical
  iconography with reduced-motion support.
- Removed the pet profile from the home hero; the main CTA now leads directly
  into the help flow.
- Rebuilt **My Pets** with medical-card summaries, completeness, next event and
  intentional empty states.
- Added a three-step pet record setup with photo, birth data, weight,
  microchip, allergies, chronic conditions, emergency note, district and
  preferred clinic.
- Added medical record modules for vaccinations, deworming, flea/tick
  treatment, veterinary visits, weight history, documents and reminders.
- Added a weight chart, medical timeline, attention summary and downloadable
  document attachments.
- Added print/PDF export and native share/clipboard fallback.
- Added local favorites for places.
- Added quick access to the active pet's medical record from nearby results
  and place details.
- Improved low-result guidance with a one-tap radius expansion.
- Kept call and route as the dominant actions on place cards.

## Safety and privacy

- Existing UkraineAlarm and shelter behavior remains fail-closed.
- No 24/7 or emergency claims were broadened.
- Medical records and favorites are stored locally in the current browser;
  this release does not claim cloud backup or formal veterinary-record status.
- VetNear still does not diagnose or replace a veterinarian.

## Verification

The release is checked with ESLint, TypeScript, Vitest, a production Next.js
build and HTTP smoke tests for primary routes.
