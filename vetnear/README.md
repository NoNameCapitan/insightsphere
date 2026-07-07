# VetNear

> **VetNear is a fast, animal-first way to find the right pet-care place nearby in
> 1–2 minutes** — and the simplest way for a pet business to get listed and reach
> future clients.

VetNear is a mobile-first, geo-based **pet infrastructure platform** for a city (initial launch: **Kyiv**). The interface stays simple; the architecture underneath is modular and scalable, ready to grow from a local-data MVP into a Supabase/Postgres/PostGIS product.

It is **not** a medical/diagnosis app. The assistant and urgent flows route users to professionals — they never diagnose or prescribe.

---

## Product vision

A single place where a pet owner can, within ~2 minutes, find a relevant nearby:

- veterinary clinic / emergency vet
- pet store / vet pharmacy
- grooming / boarding / dog walking / dog training
- shelter & animal-volunteer help
- pet-friendly place
- product nearby
- and ask a safe AI-assisted pet assistant (Claude-powered when configured, deterministic urgency rules always)

---

## Hackathon demo (2-minute script)

> **Для журі:** маршрут **`/demo`** містить керований покроковий огляд — три сценарії,
> факти MVP та roadmap (посилання «Демо для журі» є у футері).
>
> _«VetNear — це сервіс для власників тварин у Києві, який скорочує шлях від проблеми
> до контакту з потрібним закладом. Користувач обирає потребу — ветклініка, ветаптека,
> зоомагазин, грумінг, перетримка або термінова ситуація — і швидко отримує релевантні
> місця поруч. У MVP ми не ставимо діагнозів і не призначаємо лікування. ШІ-асистент
> працює як безпечний навігаційний помічник. Партнери можуть подати заявку, а
> адміністратор — перевірити, схвалити або відхилити її через moderation panel.»_

1. **Home** — read the one-line positioning: VetNear finds the right pet-care place nearby, animal-first, and does not replace a vet.
2. Tap **«Знайти допомогу поруч»** (primary CTA → `/help`).
3. In the **need router**, pick a situation (e.g. *Потрібен ветеринар* or *Термінова ситуація*). Note: urgent shows nearest clinics + "call first", never fake 24/7.
4. Open **«Оцінка терміновості»** (`/questionnaire`) — the flagship AI-first flow: deterministic rules pick the urgency level (red/amber/green), free-text can only escalate, Claude explains the next step on demand. Say the line: *"Правила визначають терміновість, ШІ пояснює результат."*
5. Land on **/nearby** — nearest places sorted by distance, with trust labels.
6. Open a **place card → detail**: name, category, address, phone, site/social, route, animals, services, **verification status + last checked + source**, and a "report incorrect info" action.
7. Tap **call / route / website** (the prominent next actions).
8. Open **pet profile** (`/my-pets`) — show how the active pet biases results ("Підходить для вашого улюбленця").
9. Show **partner onboarding** (`/add-place`) — under 2 minutes, free, moderated.
10. Show **/for-partners**: pilot pricing + partner value + **social impact** block.
11. (Optional) Show **/admin/imports/google-places** — the scaling pipeline. Google Places candidates are **review-only** and never auto-published; **emergency/24-7 requires phone confirmation** before any public use.
12. Close with **known limitations** (below) — pilot scope stated honestly.

## What is real now vs. mock

**Real now:** 64 real Kyiv places (**30** `manual_verified`, public-source, not phone-confirmed + **34** web-researched candidates honestly labeled `needs_review` with per-place sources); the full UX (need router, nearby ranking by distance/animal/category, place detail, trust labels); **deterministic urgency assessment** (`/questionnaire` → rules decide the level, Claude only explains — see `docs/TRIAGE.md`); pet profiles; partner submission + moderation + Google Places review queue; safety-first emergency logic (no fake 24/7); **optional Supabase backend** — partner submissions and reports sync to the server and a server moderation queue appears when env vars are set (`docs/SUPABASE_SETUP.md`).

**Mock / localStorage:** user state (pets, submissions, reports, review decisions) is browser-local by default (server sync is env-driven and additive); product inventory is demo; partner dashboard analytics are demo numbers; the assistant and triage explanations use **real Claude** when `ANTHROPIC_API_KEY` is set (server-side) and fall back to safe rule-based demo replies without it; **Pet Scan is a demo/pilot concept only** (not real AI vision); payments/leads are not implemented (pricing is pilot-only).

## Run & verify

```bash
npm ci
npm run dev        # http://localhost:3000
npm run test       # vitest — 109 unit tests (triage, ranking, distance, assistant, validation, dataset, security)
npm run verify     # lint + tsc --noEmit + tests + production build
npm audit --omit=dev
```



- **Next.js 16 (App Router)** + **React 18** + **TypeScript**
- **Tailwind CSS**
- **Leaflet / OpenStreetMap** (client-only map, OSRM routing with straight-line fallback)
- **Local/mock data** for the MVP (`src/lib/data`), localStorage for user-generated state
- Clean types prepared for **Supabase / Postgres / PostGIS**

---

## Architecture

```
src/
  app/                      # routes (App Router)
    nearby/                 # live geo discovery (Suspense + client)
    my-pets/                # pet profiles (list / new / [id])
    place/[id]/             # rich place profile (SSG from seed data)
    products-nearby/        # product search across nearby stores
    assistant/              # safe rule-based pet assistant
    add-place/              # partner submission
    for-partners/           # partner info + pricing preview
    partner/dashboard/      # partner cabinet (mock)
    admin/                  # dashboard, moderation, imports (demo)
    <seo landings>/         # pet-services-near-me, pet-map-kyiv, city/kyiv/*, ...
  components/               # UI: PlaceCard, MapView, Filters, PetProfileForm, ...
  lib/
    types/                  # Module 13 — the canonical data model (one barrel)
    labels.ts               # localized taxonomy labels (UA)
    data/                   # curated Kyiv places + synthetic products/inventory
    geo/                    # districts, ranking (rankPlacesForPet, getRecommendedPlaces)
    distance.ts             # calculateDistance, getOpenNowStatus, filterPlacesByRadius
    pets/ partners/ requests/ reports/   # localStorage-backed stores
    security/url.ts         # safe-URL validation
    permissions.ts          # role → permission model
    analytics.ts            # event tracking abstraction
    assistant/              # rule-based mock + urgent gate; real Claude in /api/assistant
    seo.ts                  # JSON-LD + metadata helpers
  hooks/useGeolocation.ts   # geolocation with manual fallback
```

> **Coordinates** use `{ latitude, longitude }` consistently across the geo stack and Leaflet. The DB-facing `Place` keeps these field names (the spec's `lat`/`lng` map 1:1).

---

## Core flows

**Pet-profile-first.** Create a pet once (`/my-pets/new`, stored in localStorage). The active pet's `animalType` feeds the ranking so results are biased toward places that serve that animal.

**Geo discovery (`/nearby`).** `getRecommendedPlaces()` runs: approved-only filter → category/animal/district/open/verified filters → radius (1/2/3/5/10 km) with **auto-expand** when empty → `rankPlacesForPet()` (distance → pet match → category → open-now → emergency → verified → recently-updated). Map/list toggle, emergency mode, geolocation-denied fallback to a district/city point.

**Place profile (`/place/[slug]`).** Header + trust badges, quick actions (call/route/website/email + social), about, services, animals served, products preview (stores/pharmacies), contacts, working hours, map, request-service (mock), report-issue, sticky mobile actions.

**Partner onboarding.** `/add-place` → moderation queue (`/admin/moderation`) → approved submissions surface in discovery. Roles/permissions modeled in `lib/permissions.ts`.

---

## Future-ready modules (architecture in place, UI scaffolded)

- **Products / inventory sync** — types (`Product`, `InventoryItem`, `Supplier`, `SupplierFeed`, `InventoryImport`, `StoreBranch`) + mock data + `/admin/imports` upload placeholder. Future: validate uploads server-side, queue parsing (CSV/XLSX/API/Google Sheet), store inventory with freshness, expose "updated X ago".
- **Requests / bookings** — `ServiceRequest`/`BookingRequest` types + "Request service" button creating local mock requests. Future: real scheduling + partner confirmation + notifications.
- **Pet QR / MQR** — `PetQrProfile` type + "Prepare QR profile" placeholder on the pet form. Future: public lost-pet page with visibility controls.
- **Subscriptions / monetization** — `PartnerPlan`/`SubscriptionStatus` types + pricing preview in `/for-partners`. Free for users; places free at MVP. No payments implemented.
- **Analytics** — `track()` logs to console + localStorage history (admin view). Future: swap the provider adapter (PostHog/GA4/custom).
- **Assistant** — real **Claude** via the server-only route `POST /api/assistant` when `ANTHROPIC_API_KEY` is configured (key stays server-side, never `NEXT_PUBLIC_`); otherwise a safe rule-based `mockProvider` demo fallback. The urgent gate and category routing are always deterministic (rule-based), so emergency safety is never delegated to the model.

---

## Security & trust

See **[SECURITY.md](./SECURITY.md)**. Highlights: safe-URL validation (only `http`/`https`/`tel`/`mailto`; blocks `javascript:`/`data:`), all external links `target="_blank" rel="noopener noreferrer"`, partner submissions require moderation, role/permission model, report-incorrect-info, geolocation kept client-side (coarse fallback, not persisted server-side), documented upload restrictions and future auth/RLS plan.

---

## Run locally

```bash
npm install
npm run dev      # http://localhost:3000
```

## Build

```bash
npm run build                     # production build — DEFAULT (server) output, runs the full TypeScript type-check
NEXT_OUTPUT=standalone npm run build   # OPT-IN standalone bundle (.next/standalone) for containers/serverless
npm start                         # serve the production build
```

**Required predeploy gate** (lint + types + build must all pass):

```bash
npm run verify    # = npm run lint && npx tsc --noEmit && npm run test && npm run build
```

Deployment must run `npm run verify`, not `npm run build` alone.

> `next build` runs Next's own TypeScript validity check (TypeScript errors fail the build — `ignoreBuildErrors` is **not** set). ESLint is run as a separate step via `npm run lint` (`eslint .`).

### Production deployment notes

- **Output:** a normal `npm run build` produces the **default Next server output**. For containers/serverless, build the **opt-in** standalone bundle with `NEXT_OUTPUT=standalone npm run build` and deploy `.next/standalone` (Node) plus `.next/static` and `public`.
- **Build workers:** the build runs with a single worker (`experimental.cpus: 1`) to keep memory/IPC low on constrained CI. If a very memory-starved runner stalls, raise the heap: `NODE_OPTIONS=--max-old-space-size=2048 npm run build`.
- **Rendering:** interactive/client/Leaflet routes (`/nearby`, `/my-pets/*`, `/products-nearby`, `/assistant`, `/pet-scan`, `/lost-found`, `/add-place`, `/partner/*`, `/admin/*`, `/place/[id]`, `/city/kyiv/district/[district]`) are `force-dynamic` (on-demand SSR, still crawlable). Static SEO/landing pages use a **server-safe card** (`PlaceCardStatic`, no client components); `MapView` creates Leaflet icons lazily so importing it has no DOM side effects.
- **Env:** set `NEXT_PUBLIC_SITE_URL` (canonical/OG/sitemap); optional `NEXT_PUBLIC_PETSCAN_PROVIDER`; `NEXT_PUBLIC_SHOW_DEMO_EMERGENCY=false` by default (see below). Set `NEXT_TELEMETRY_DISABLED=1` in CI.
- **Security:** on Next 16.2.9, `npm audit --omit=dev` reports **0 vulnerabilities**.

### Emergency demo visibility

Demo/unverified emergency listings are **hidden from public emergency-first results** by
default. They appear only when `NEXT_PUBLIC_SHOW_DEMO_EMERGENCY=true` (dev/staging only).
When hidden, emergency surfaces show a safe empty state instead of unverified listings.
Demo emergency **place profiles** remain reachable but always carry a strong warning.

---

## How to add real data

1. `src/lib/data/places.ts` is a **manually curated** Kyiv dataset (regenerate via `scripts/build-verified-places.mjs`). `products.ts` is still synthetic (regenerate via `scripts/gen-products.mjs`). To extend the real dataset, edit the curated list in `build-verified-places.mjs` or follow `docs/DATASET_NOTES.md`.
2. Keep each record shaped like the `Place` / `Product` / `InventoryItem` types in `src/lib/types`.
3. When moving to a database: the types are serializable and DB-friendly. Map `Place` → a `places` table (+ PostGIS `geography(Point)` for `latitude/longitude`), gate writes behind RLS by `ownerId`, and replace the localStorage stores with API calls of the same shape.

See `docs/kyiv-real-data-import.md` (import schema + `data/templates/places-import.csv`) and `docs/data-verification-checklist.md` for the manual verification workflow.

### Dataset status & pre-production requirements (Kyiv)

The bundled **public places** are **30 manually curated** Kyiv businesses
(`dataSource: "manual_verified"`, `verificationStatus: "verified"`), compiled from
**official sites and public directories** — 15 vet clinics, 10 pet stores, 2 vet
pharmacies, 2 grooming salons, 1 boarding. They carry an honest `lastVerifiedAt`
and `verifiedBy` ("public listings + official sites"), so the UI labels them
**"Перевірено за публічними джерелами"** (not phone-confirmed). Product inventory is
still **synthetic/demo**. See `docs/DATASET_NOTES.md` for provenance and caveats.

**Emergency/24-7 availability is disabled** for every place until phone-confirmed:
`emergencyAvailable` and `isOpen24_7` are `false`, no place uses the `emergency_vet`
category, and the urgent CTA routes to the nearest vet clinics. To grow toward a
full public launch, aim for:

- **30–50** vet clinics, **10** phone-confirmed **emergency / 24h** locations
- **30–40** pet stores, **10–15** vet pharmacies, **15–20** groomers
- **5–10** shelters / animal-help organizations

Promote a place to phone-confirmed by setting `emergencyAvailable: true` and a
`verifiedBy` that mentions a call (the badge then reads **"Підтверджено дзвінком"**).

> **Unverified/demo data must not be used for public emergency discovery.** Emergency
> results are gated by `isEmergencySearchSafe()` / `isPhoneConfirmedEmergency()`.

---

## Pet-owner & partner flows

VetNear is animal-first: the goal is the fastest path from "I have an animal and need
help" to the right nearby service. It is **not** a diagnosis app and never prescribes
treatment.

- **Need router (`/help`)** — a safe, tap-based router (1–3 steps, no diagnosis) that
  classifies a need (vet / urgent / buy food-meds / grooming / boarding / shelter / "not
  sure") and shows the nearest relevant places. The urgent path tells the user to call a
  clinic directly and routes to nearest vet clinics (no fake 24/7). Disclaimer:
  *"VetNear не ставить діагнози і не замінює ветеринара."*
- **Pet profile (`/my-pets`)** is the central object (localStorage, typed for easy
  Supabase migration): name, type, breed, age, weight, chronic/allergy notes, preferred
  district, favourite clinic, quick emergency note. The active pet biases discovery
  (animal-type match, "Підходить для вашого улюбленця" badge, exotic "call first"
  warning).
- **Partner onboarding (`/add-place`)** takes under ~2 minutes: contact details, map
  link / optional coordinates, services, animals, representative confirmation + moderation
  consent. Partners **cannot** self-declare emergency/24-7 — that is set only by VetNear
  after a phone call. Submissions are moderated (`/admin/moderation`) and never
  auto-published; Google Places candidates remain external review-only leads.

## Monetization (pilot pricing)

Pilot/early-partner pricing — no payment processing is implemented. Base listing is free
forever; shelters and animal-help organisations are always free.

- **Free** — 0 ₴/mo: basic listing, call/site/route buttons, public-source verification,
  "report incorrect info".
- **Verified Partner** — 449 ₴/mo: verified badge, expanded profile + photos,
  services/prices, higher visibility, basic analytics.
- **Pro Partner** — 1349 ₴/mo: priority placement, offers, lead capture, extended analytics.
- **Network / Multi-location** — from 2699 ₴/mo: multiple branches, bulk import, manager
  dashboard, branch analytics.
- **Lead packages** (possible future model): 25–90 ₴ per qualified lead, only after real
  demand is validated.

## Social impact

10% of VetNear's revenue **from paid partner subscriptions, advertising placements and
sponsorships** will go to rehabilitation and prosthetics for people affected by the
russo-Ukrainian war. Important boundaries:

- This applies to paid partner/subscription/sponsor revenue — **not automatically to
  investment or grant capital**, for which the social contribution is defined separately
  under the relevant legal/financial terms.
- No specific charity is named yet; the fund/partner will be chosen transparently before
  paid plans launch.
- VetNear will publish a short quarterly report: received, transferred, where directed.



## Known limitations

- Public **places**: 30 curated (`manual_verified`, public sources, coordinates approximate, not phone-confirmed) + 34 web-researched candidates (`needs_review`, shown with an honest badge and per-place `sourceUrl`). **Product inventory remains synthetic** (~20 products). **Emergency/24-7 availability is disabled** until phone-confirmed.
- User state (pets, submissions, requests, reports, analytics) lives in **localStorage** by default. With Supabase env vars set, submissions/reports also sync server-side and a server moderation queue is available; auth for moderators is a single `ADMIN_TOKEN` (MVP), and the partner dashboard still reads the local copy.
- Assistant + triage explanations call **Claude** server-side when `ANTHROPIC_API_KEY` is set; without the key they run safe rule-based fallbacks. Neither ever diagnoses, prescribes, or gives dosages; **urgency levels are always deterministic** (rules in `src/lib/triage/engine.ts`, LLM cannot override them).
- Bookings, QR profiles, subscriptions, product sync are **architecture + placeholders**, not live features. **Pet Scan is a pilot/demo concept**, not real vision.
- OSRM public routing may rate-limit; the map falls back to a straight line and the external "route" link always works.

## After-hackathon roadmap (controlled pilot plan)

A staged plan — not an unfinished mess. Each step turns a labeled MVP/local area into a
real one:

1. **Backend hardening** — Supabase schema is live (submissions/moderation/reports); next: Auth + roles for moderators (replacing the single `ADMIN_TOKEN`), partner accounts, Redis-backed rate limiting for multi-instance deploys.
   - **Production next step: merge approved Supabase submissions into the public places feed.** Today, approved *local* submissions appear in `/nearby` (localStorage demo mode); server-approved rows stay in the moderation queue and are not yet published publicly.
2. **Phone-confirmed urgent providers** — call a first batch of clinics, then enable emergency/24-7 (the data fields already exist).
3. **Verify the 34 `needs_review` candidates** — the review checklist ships in `data/imports/manual-candidates-review.csv`; each confirmed place flips to `verified` via the documented workflow.
4. **Partner analytics** — replace the demo dashboard numbers with real view/call/route/website events.
5. **First pilot partners** — onboard a handful of real Kyiv clinics/stores/groomers.
6. **Production moderation workflow** — queues, audit log, and roles instead of the local demo.

## Deployment checklist

- [ ] Set production env (`NEXT_PUBLIC_*`, any provider keys) — none are required for the current local-data MVP.
- [ ] `npm ci && NEXT_TELEMETRY_DISABLED=1 npm run verify` is green; `npm audit --omit=dev` clean.
- [ ] Deploy on a Node 18+ host (Vercel/Node). Optional standalone: `NEXT_OUTPUT=standalone npm run build`.
- [ ] Security headers/CSP are emitted by `next.config.mjs` (verify after deploy).
- [ ] Confirm map tiles (OSM) and external route links load from the deployed origin.
- [ ] Before any public emergency claim: phone-confirm providers (see data verification).

## Safety notes

- VetNear never diagnoses or prescribes; the assistant (Claude-powered when configured, else rule-based) and need router only route to services. **Pet Scan is a demo/local placeholder, not real AI vision.**
- Emergency/24-7 is disabled until a provider is phone-confirmed (`emergencyAvailable`/`isOpen24_7` are `false`, no `emergency_vet` category); urgent flows show nearest vet clinics with an honest notice.
- Trust labels never overstate verification: curated places read "Перевірено за публічними джерелами" (not phone-confirmed). "Підтверджено дзвінком" appears only when a call is recorded.
- Google Places candidates are external review-only leads and are never auto-published.

## Data verification

- Public places: 30 manually curated Kyiv businesses, `dataSource: "manual_verified"`, compiled from official sites and public directories; coordinates approximate. See `docs/DATASET_NOTES.md` and `docs/data-verification-checklist.md`.
- Promote to phone-confirmed via the moderation tool (sets `phoneConfirmedAt`/`phoneConfirmedBy`), which is the only gate for enabling emergency/24-7.
