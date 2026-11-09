# VetNear v1.16 — premium launch foundation

Release date: 2026-11-09

## Product positioning

- Removed the public competition presentation and all competition-specific language.
- Removed the dedicated `/demo` route and replaced its documentation with
  production priorities and a real post-deploy smoke-test path.
- Reframed the public dataset copy from a pilot showcase to a dated Kyiv
  service base while preserving honest verification statuses.

## Premium interface

- Added an interactive, pointer-responsive 3D pet-care cockpit in the hero.
- Added a horizontally scrollable emergency-readiness rail with four practical
  scenarios: urgent veterinary care, shelter routing during an alert, a found
  animal, and a bite/rabies-risk route.
- Added native scroll snapping, keyboard focus, mobile swipe guidance, desktop
  controls and reduced-motion fallbacks.
- Refined the canvas from warm presentation cream to a pale mineral green that
  feels more clinical while preserving the established teal/peach identity.
- Added a persistent but restrained “Терміново” navigation action. Emergency
  red remains reserved for safety-critical actions.

## Safety boundaries retained

- VetNear still does not diagnose, prescribe or promise provider availability.
- Emergency/24-7 claims still require phone confirmation before receiving a
  public verified status.
- Shelter routing remains fail-closed when alert, location or shelter data is
  unavailable or stale.
- 3D and motion effects are decorative, do not block navigation and become
  static when the user prefers reduced motion.

## Release gate

Run `npm run verify` before deployment. After deployment, configure the
server-only alert token and perform a real alarm-state smoke test over HTTPS.
