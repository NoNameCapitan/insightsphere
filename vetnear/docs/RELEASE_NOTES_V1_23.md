# VetNear v1.23 — clinical-premium pass

## A. Colour and type
- Warm ivory canvas `#FBF8F3`, deep teal `#0B6B62` (buttons, links), fresh
  teal `#14A08C` (icons, active states), mint, one apricot accent. Red is
  emergency-only; amber is alert/caution-only.
- Manrope (headings) + Inter (text), self-hosted via `@fontsource-variable`,
  both with Cyrillic. Teal-tinted shadows.
- "Awaiting review" badges are neutral gray, not amber.

## B. Icons
- One ceramic `.icon3d` tile (top-left light, inner shade, contact shadow)
  now holds every icon: place cards, care cards, trust strip, medical card.
- SVG icon gradients retuned to the new palette.
- Not done: a full raster soft-3D set. Only 10 raster icons exist; pet store,
  shelter and all medical icons are still SVG. Generate the set with the
  prompt from the design brief and they can replace the SVGs inside the tile.

## C. Home
- Mobile hero shows only the 3D object; the cockpit mock-up is sm+.
- Four trust cards became one compact strip; the repeated "does not replace a
  vet" line and the social-impact card were reduced to one line each.
- The shelter tile was not added: the base has 0 public shelters and the home
  page never advertises an empty category.

## D–F. My pets and medical record
- Backup: "Зберегти копію" / "Відновити з копії" (JSON file) on /my-pets,
  with a plain statement that data lives on this device only.
- Medical card: six section tiles with counters (vaccinations, treatments,
  visits, weight, documents, reminders), "Найближче" block with
  "Додати в календар" (.ics, all-day event with a day-before alarm) and
  "Знайти клініку поруч".
- Add record: one-tap name presets, clinic suggestions from the VetNear base,
  and a suggested next date (12 / 3 / 1 months) that is labelled as
  approximate and stays editable.

## G–H. Nearby and place card
- Calm mode: the shelter row moved below the list; during an alert the same
  block is first on screen. Safety logic is unchanged.
- One-tap category chips; the map artwork is desktop-only; the "add a pet"
  prompt no longer shows when there are no pets.
- Shelter empty state says honestly that there are no verified shelters yet
  and offers three next steps.
- Place card: 3D icon tile, solid distance pill, address line; the per-card
  "call before visiting" line is shown once above the list.

## I–J. Motion and navigation
- Smaller tilt angles, no bounce on icon hover, skeleton placeholders.
- Mobile bottom tab bar: Головна / Поруч / Терміново / Мої тварини.
