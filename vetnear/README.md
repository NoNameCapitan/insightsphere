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

## Production priorities

VetNear is built around four launch-critical principles:

1. **Emergency first** — urgent flows shorten the path to a phone call, route or shelter without claiming medical certainty.
2. **Animal first** — species, current need and distance shape discovery before commercial placement.
3. **Trust is visible** — every public provider can show its verification state, source and last-check date; emergency/24-7 claims require phone confirmation.
4. **Fail closed** — unavailable alarm, shelter or provider data never becomes an invented recommendation.

## v1.9 — публікація, ліди, тарифи

Три зміни, які закривають головні розриви MVP (деталі: [`docs/MONETIZATION_V1_9.md`](docs/MONETIZATION_V1_9.md)):

1. **Supabase став джерелом правди публічного фіду.** Схвалена заявка тепер
   матеріалізується в `published_places` і зʼявляється в `/nearby`, а не
   зависає в черзі модерації. Seed-датасет лишається zero-config базою.
2. **Ліди.** `POST /api/events/lead` записує дзвінки, маршрути та запити послуг
   без збереження IP/user-agent — денний ротований хеш сесії лише для
   дедуплікації. Звіт: `/admin/leads`.
3. **Тарифи й модератори.** `free / verified / promoted`; промо — обмежений
   тайбрейкер із видимою міткою, вимкнений у термінових запитах. Спільний
   `ADMIN_TOKEN` замінено відкликаними токенами з атрибуцією
   (`scripts/moderator-token.mjs`).

4. **`directory-core` — вертикаль винесена в конфіг.** Категорії, райони, межі
   міста, політики терміновості й монетизації живуть у
   `src/config/verticals/*`; `labels.ts`, `seo.ts` і публікація деривують усе
   звідти. Другий приклад вертикалі (стоматологія, Львів) типізується й
   тестується, щоб абстракція не з'їхала. Деталі:
   [`docs/VERTICAL_ADAPTATION.md`](docs/VERTICAL_ADAPTATION.md).
5. **Залежності оновлено.** `next@16.4.6`, `postcss@8.5.28`, override
   `nanoid@^5`. `npm audit --omit=dev` → **0 vulnerabilities** (було 4 high
   у `sharp`/libvips плюс низка advisories самого Next 16.2.9).

Міграція: `supabase/migrations/002_publishing_leads_moderators.sql`.

## What is real now vs. mock

**Real now:** 65 real Kyiv places (**31** `manual_verified`, public-source, not phone-confirmed + **34** web-researched candidates honestly labeled `needs_review` with per-place sources); a dated Kyiv operations feed at **`/kyiv-updates`** for official certificate routes, adoption changes, emergency guidance and partnership leads; the full UX (need router, nearby ranking by distance/animal/category, place detail, trust labels); **deterministic urgency assessment** (`/questionnaire` → rules decide the level, Claude only explains — see `docs/TRIAGE.md`); pet profiles; partner submission + moderation + Google Places review queue; safety-first emergency logic (no fake 24/7); **optional Supabase backend** — partner submissions and reports sync to the server and a server moderation queue appears when env vars are set (`docs/SUPABASE_SETUP.md`).

**Mock / localStorage:** pet profiles and personal history remain browser-local (a deliberate no-account MVP choice); partner submissions, moderation decisions, published listings and lead events are server-side once Supabase is configured; product inventory is demo; partner dashboard analytics are demo numbers; the assistant and triage explanations use **real Claude** when `ANTHROPIC_API_KEY` is set (server-side) and fall back to safe rule-based demo replies without it; **Pet Scan is a demo/pilot concept only** (not real AI vision); payments/leads are not implemented (pricing is pilot-only).

## Run & verify

```bash
npm ci
npm run dev        # http://localhost:3000
npm run test       # vitest — unit + DOM tests (see the latest release notes for results)
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

**Air-alert safety overlay (`/nearby`).** The client polls VetNear's server endpoint
every 30 seconds; the server reads the official Ukraine Alarm API without exposing its
token. During a confirmed Kyiv alert, the map opens automatically and displays the five
nearest active records explicitly marked 24/7 in Kyiv's municipal shelter dataset,
ranked by distance. Restricted school-only and repair records are excluded. The user can hide/show shelters with one persistent
toggle and continue the ordinary vet route. A map line is directional; the popup opens
an external walking route. Shelter access is never guaranteed from open data alone.

**Manual «Укриття» button (v1.15).** A separate action above the `/nearby` map/list
is enabled only for a fresh, confirmed active Kyiv alert, independently of the automatic
overlay toggle. One tap rechecks the alert, requests fresh geolocation and opens walking
directions in Google Maps to the nearest eligible official shelter within 10 km, ranked
by straight-line distance. It rechecks for all-clear before leaving VetNear. Unknown,
stale or offline alert states disable the button; failed location/dataset lookups never
fall back to invented coordinates. Details and verification limits:
[`docs/RELEASE_NOTES_V1_15.md`](docs/RELEASE_NOTES_V1_15.md).

**Kyiv owner updates (v1.15).** The home page contains a small, non-intrusive strip
with current animal-related news, events and public-health information. The full
`/kyiv-updates` page separates confirmed changes from source-checked or phone-check
items and links to primary sources. It does not send email, push notifications or
marketing messages.

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
- **Env:** copy `.env.example`; production requires a unique `LEAD_HASH_SALT`, Upstash REST credentials for distributed limits, and `NEXT_PUBLIC_SHOW_DEMO_EMERGENCY=0`. Run `npm run release:gate` before deployment. Set `NEXT_TELEMETRY_DISABLED=1` in CI.
- **Live safety:** request an official Ukraine Alarm API key and set the server-only
  `UKRAINE_ALARM_API_TOKEN`. Without it, the app shows an honest “status unavailable”
  fallback with a link to the official alert map. Shelter data uses Kyiv's official
  ArcGIS open-data endpoint; `KYIV_SHELTERS_ARCGIS_URL` is only an optional override.
- **Security:** on `next@16.4.6` (v1.26.1), `npm audit --omit=dev` reports **0 vulnerabilities**. Re-run the audit after every dependency change instead of treating this line as permanent evidence.

### Deploy to Vercel (step by step)

1. Push the project to a GitHub/GitLab repository (the app lives at the repo root
   or point Vercel's **Root Directory** at the folder containing `package.json`).
2. In Vercel: **Add New → Project → Import** the repository. Framework preset:
   **Next.js** (auto-detected). Build command `npm run build`, install `npm ci` —
   the defaults work; no `vercel.json` is required.
3. Set the environment variables (Project → Settings → Environment Variables):
   - `NEXT_PUBLIC_SITE_URL` — the production URL (enables correct canonical/OG/sitemap);
   - production backend: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
     `LEAD_HASH_SALT`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`,
     `UKRAINE_ALARM_API_TOKEN`, `NEXT_PUBLIC_BACKEND_ENABLED=1`;
   - optional: `ANTHROPIC_API_KEY` (assistant smart mode).
   - do **not** set `ADMIN_TOKEN`; issue revocable personal moderator tokens
     with `scripts/moderator-token.mjs`.
4. Deploy. Then re-set `NEXT_PUBLIC_SITE_URL` to the final domain and redeploy once
   if the first deploy used a preview URL.
5. Post-deploy smoke test: `/` renders, `/nearby` asks for location and lists
   places, a `/place/[id]` profile opens with call/route buttons, `/help` routes
   urgent cases safely, `/kyiv-updates` loads current information, and OSM map
   tiles load from the deployed origin.

### Automation roadmap (n8n — future, external)

n8n is **not** part of this frontend and is intentionally not installed. It is the
planned external automation layer once the pilot needs recurring data work:

- **Google Places import** — scheduled n8n workflow calls the Places API, writes
  candidates into the existing review queue format (`data/imports/`), so
  `/admin/imports/google-places` keeps working unchanged;
- **Provider submissions** — webhook from the submission API → notification to a
  moderator (Telegram/email) → manual approve in the moderation panel;
- **Moderation sync** — push approved places to Supabase / a spreadsheet or
  Airtable mirror for non-technical review;
- **Lead notifications** — forward service requests to partners once real
  partner accounts exist;
- **Scheduled data refresh** — periodic re-check of phone/website liveness with
  a "needs re-verification" flag written back into the queue.

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

The bundled **public places** are **31 manually curated** Kyiv businesses
(`dataSource: "manual_verified"`, `verificationStatus: "verified"`), compiled from
**official sites and public directories** — 16 vet clinics, 10 pet stores, 2 vet
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

- Public **places**: 31 curated (`manual_verified`, public sources, not phone-confirmed; most coordinates approximate, MAVET coordinates come from its official route link) + 34 web-researched candidates (`needs_review`, shown with an honest badge and per-place `sourceUrl`). **Product inventory remains synthetic** (~20 products). **Emergency/24-7 availability is disabled** until phone-confirmed.
- User state (pets, requests and parts of the partner flow) still uses **localStorage**. With Supabase env vars set, submissions/reports sync server-side; moderation uses hashed, revocable personal tokens. The partner dashboard still reads its local copy.
- Assistant + triage explanations call **Claude** server-side when `ANTHROPIC_API_KEY` is set; without the key they run safe rule-based fallbacks. Neither ever diagnoses, prescribes, or gives dosages; **urgency levels are always deterministic** (rules in `src/lib/triage/engine.ts`, LLM cannot override them).
- Bookings, QR profiles, subscriptions, product sync are **architecture + placeholders**, not live features. **Pet Scan is a pilot/demo concept**, not real vision.
- OSRM public routing may rate-limit; the map falls back to a straight line and the external "route" link always works.
- ~~`npm audit --omit=dev` reports 4 high-severity advisories in `sharp`/libvips.~~ **Resolved and re-hardened in v1.26.1.** Dependencies are now pinned to `next@16.4.6` / `postcss@8.5.28` with a `nanoid@^5` override; `npm audit --omit=dev` reports **0 vulnerabilities**. Current verification counts live in the latest release notes rather than this historical section.

## Production roadmap

A staged plan — not an unfinished mess. Each step turns a labeled MVP/local area into a
real one:

1. **Backend hardening** — Supabase schema, personal moderator tokens and optional distributed Upstash rate limiting are live; next: Supabase Auth for partner accounts and httpOnly moderator sessions.
   - ~~Production next step: merge approved Supabase submissions into the public places feed.~~ **Done in v1.9** — approval upserts into `published_places` and the place appears in `/nearby` within the 60-second feed cache.
   - ~~Auth + roles for moderators (replacing the single `ADMIN_TOKEN`).~~ **Done in v1.9** via hashed, revocable per-moderator tokens. Supabase Auth remains the next step for *partner* self-service accounts.
2. **Phone-confirmed urgent providers** — call a first batch of clinics, then enable emergency/24-7 (the data fields already exist).
3. **Verify the 34 `needs_review` candidates** — the review checklist ships in `data/imports/manual-candidates-review.csv`; each confirmed place flips to `verified` via the documented workflow.
4. **Partner analytics** — replace the demo dashboard numbers with real view/call/route/website events.
5. **First pilot partners** — onboard a handful of real Kyiv clinics/stores/groomers.
6. **Production moderation workflow** — queues, audit log, and roles instead of the local demo.
7. **External automation (n8n)** — scheduled Google Places imports, moderator notifications, data-freshness re-checks (see "Automation roadmap" above; runs outside this frontend).

## Deployment checklist

- [ ] Copy `.env.example`, set production values and run `npm run release:gate`.
- [ ] Apply migrations 001–004 and run `npm run db:postcheck` after 003.
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

- Public places: 31 manually curated Kyiv businesses, `dataSource: "manual_verified"`, compiled from official sites and public directories. See `docs/DATASET_NOTES.md` and `docs/data-verification-checklist.md`.
- Kyiv operational updates live in `src/lib/data/kyivUpdates.ts` and render at `/kyiv-updates`; every item has a concrete date, status, area, action and direct sources.
- Promote to phone-confirmed via the moderation tool (sets `phoneConfirmedAt`/`phoneConfirmedBy`), which is the only gate for enabling emergency/24-7.
