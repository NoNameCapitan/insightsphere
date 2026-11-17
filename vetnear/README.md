# VetNear

VetNear — сервіс пошуку ветеринарної допомоги та щоденних послуг для тварин у Києві й Київській області. Поточна версія вихідного коду — **1.34.0**; каталог містить **90 місць**. Точність даних, доступність контакту й прозорий статус перевірки мають пріоритет у пошуку.

Сервіс не встановлює діагнози й не призначає лікування. Медкартки залишаються локальними в браузері; серверні заявки, аналітика та зовнішні інтеграції працюють лише після окремого налаштування. Готовність вихідного коду не означає підключення живих сервісів.

---

## Product vision

A single place where a pet owner can find a relevant nearby:

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

## v1.34 — тепло дому та завершений шлях повернення

Поточна версія поєднує кінематографічний Hero з прямим пошуком і видимим терміновим маршрутом. Нове **«Збережені місця»** завершує сценарій сердечка: від збереження до повторного відкриття й контакту. Виправлено хибний успіх запису та небезпечне перезаписування пошкоджених локальних колекцій. Карту зроблено стриманішою, профілі тварин отримали нейтральні монограми замість однакової собаки.

- [Зміни 1.34 та межі релізу](docs/RELEASE_NOTES_V1_34_UK.md)
- [Дослідження і прийняті рішення з першоджерелами](docs/RESEARCH_DECISIONS_V1_34_UK.md)
- [Браузерна перевірка й скриншоти](docs/qa/v1.34/README.md)

Каталог: 90 місць у Києві та області. Нові серверні інтеграції, платежі та розгортання не виконувалися. Розділи нижче описують історичні версії; інструкції підключення 1.33 залишаються актуальними для відповідних опційних модулів.

## v1.33 — історія:  кінематографічний інтерфейс і коротший шлях до допомоги

- **Візуальна система:** нова брендова сцена із собакою та котом, тепле бічне світло, глибокі зелені поверхні, кремові робочі блоки, узгоджені іконки та мікроанімації. Немає фонового відео або нової важкої бібліотеки анімації; підтримується зменшення руху.
- **Пошук і контакт:** компактний вибір місця, радіус лише після визначення точки, відновлення контексту пошуку, корисні порожні результати. Контактні кнопки видно раніше; мобільна панель дзвінка враховує нижню навігацію. Терміновий перехід веде безпосередньо до клінік.
- **Профілі:** типову ілюстрацію будівлі та імітацію надсилання запиту прибрано. Залишено справжні канали зв’язку; джерела, графік і телефонне підтвердження розділено. Актуальність телефонного доказу обмежена 30 днями й не означає прийом зараз.
- **Мої тварини:** створення з імені та виду, далі — наступна дія, свій ветеринар і важливе перед прийомом. Наявні резервні копії, історія, друк/PDF і календар збережені; додано окремі календарні події та стабільні UID. Окремий вид або профіль для кролика не додавався.
- **Події:** вибір тем перед стрічкою, короткі анонси й окремі групи підтверджених дат, постійних можливостей, неповних анонсів та архіву. Джерела й дати перевірки не підміняються датою нового релізу.
- **Партнери:** безкоштовний профіль і ранній пілот, пошук наявного закладу, запит на підтвердження представника, простіша форма без великої карти районів. Операторська черга доступна через захищений інтерфейс; автоматичного присвоєння прав немає.
- **Вимірювання:** опційна статистика власного сервісу з дозволеними кодами кампаній, відмовою від збору, DNT/GPC та авторизованим звітом. За замовчуванням вимкнена. Натискання телефону не вважається клієнтом чи підставою для оплати.

Повний `npm run verify` після функціональних виправлень браузерної перевірки пройшов: lint, TypeScript, **525 тестів у 56 файлах** та production-збірка. Останню візуальну зміну SVG також перевірено окремим lint і повторною збіркою. Браузерні результати й межі перевірки — у [нотатках релізу](docs/RELEASE_NOTES_V1_33_UK.md).

Підготовлено міграцію **007** для опційної аналітики; міграції не застосовувалися до живої БД. Платежі, хмарні медкартки, онлайн-слоти, push і автоматичний збір новин не підключені. Шість партнерських листів залишаються чернетками, нічого не надіслано. Ця версія не розгорталася на Vercel: підключений інструмент повернув 403 під час читання метаданих deployment, тому живу конфігурацію не перевірено.

Документація модулів, доданих у 1.33:

- [Зміни та перевірки 1.33](docs/RELEASE_NOTES_V1_33_UK.md)
- [Кінематографічна концепція й правила оформлення](docs/CINEMATIC_DIRECTION_V1_33_UK.md)
- [План запуску й рекламного пілоту](docs/LAUNCH_PLAYBOOK_V1_33_UK.md)
- [Підключення аналітики й значення метрик](docs/LAUNCH_MEASUREMENT_V1_33_UK.md)
- [Актуальність даних і телефонних підтверджень](docs/DATA_FRESHNESS_V1_33_UK.md)

## v1.32 — історія попереднього релізу


- Cinematic pet-care hero and interactive 3D district selection, with keyboard/touch and reduced-motion support.
- 90 sourced catalogue entries (23 added), Kyiv + oblast/locality filters, up to 100 km, honest unknown capabilities.
- Focused events/vaccination/adoption hub, source dates, expiry/archive, browser-local saved items and followed topics.
- Partner pilot intake, proposed plans and disabled billing adapter; six personalized outreach drafts, **not sent**.
- New Supabase migrations 005 and 006 are prepared, **not applied**. No payments or deployment performed.

Read [v1.32 release notes](docs/RELEASE_NOTES_V1_32_UK.md), [catalogue sources](docs/CATALOG_EXPANSION_V1_32_UK.md), [events](docs/EVENTS_EDITORIAL_V1_32_UK.md), [monetization readiness](docs/PARTNER_MONETIZATION_V1_32_UK.md) and [outreach drafts](docs/PARTNER_OUTREACH_DRAFTS_UK.md). Earlier version sections are historical.

## v1.31 — історія попереднього релізу

The v1.31 candidate added a task-first home/search experience, explicit location control,
timezone-aware opening hours, stricter emergency evidence, reliable local medical writes
and backup validation, honest submission delivery, and safer static-only PWA caching.
At v1.31 the catalogue was Kyiv-only. Since v1.32 it includes Kyiv oblast; national coverage remains a planned rollout.

- [v1.31 release notes and validation](docs/RELEASE_NOTES_V1_31.md)
- [Product blueprint in Russian](docs/PREMIUM_PRODUCT_BLUEPRINT_RU.md)
- [UX review and browser coverage in Russian](docs/UX_REVIEW_V1_31_RU.md)

This v1.31 section and the earlier release sections below are historical; use v1.33 notes for current behavior and limits.

## v1.9 — історія публікації, лідів і тарифів

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

## Historical MVP snapshot — superseded by v1.33

The following 65-place and mock-dashboard descriptions record an earlier MVP. They are not the current catalogue, UI, analytics or billing status. For current behavior, use the v1.33 section and release notes above.

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
    partner/dashboard/      # browser-local business drafts
    admin/                  # local overview + authenticated server queues/reports
    <seo landings>/         # pet-services-near-me, pet-map-kyiv, city/kyiv/*, ...
  components/               # UI: PlaceCard, MapView, Filters, PetProfileForm, ...
  lib/
    types/                  # Module 13 — the canonical data model (one barrel)
    labels.ts               # localized taxonomy labels (UA)
    data/                   # Kyiv/oblast catalogue + synthetic products/inventory
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

**Geo discovery (`/nearby`).** Approved places are filtered by service, animal, territory, optional location radius and evidence. Region/locality do not invent the visitor’s coordinates. Radius choices reach 100 km only after an origin exists. URL criteria and guarded session return state preserve search context. Empty results offer explicit recovery; the user chooses any wider territory.

**Place profile (`/place/[slug]`).** Factual title and dated evidence, immediate call/route actions, services and contact details. No simulated service-request delivery or fabricated facility photo. The secondary mobile contact panel appears after the inline actions leave view and stays above bottom navigation.

**Air-alert safety overlay (`/nearby`).** The client polls VetNear's server endpoint
every 30 seconds; the server reads the official Ukraine Alarm API without exposing its
token. During a confirmed Kyiv alert, the user can explicitly open the map to see the five
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
- **Requests / bookings** — legacy types remain; the misleading local-only send flow is removed from place profiles in v1.33. Real scheduling, provider confirmation and notifications are future integrations.
- **Pet QR / MQR** — `PetQrProfile` type + "Prepare QR profile" placeholder on the pet form. Future: public lost-pet page with visibility controls.
- **Subscriptions / monetization** — subscription schema and a disabled billing interface are prepared. The public partner page focuses on a free profile and pilot; proposed historical prices are not a live offer. No payments are connected.
- **Analytics** — optional first-party launch funnel and contact-event receipts, default off; admin-only aggregate report. No advertising cookies or external tracker. Cross-day retention and campaign spend analysis require separate work; see the v1.33 measurement guide.
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
   **Next.js** (auto-detected). Build command `npm run verify`, install `npm ci` —
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
5. Post-deploy smoke test: `/` renders, `/nearby` requests location only after an explicit action and lists
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

1. `src/lib/data/places.ts` is a **manually curated** Kyiv and Kyiv oblast dataset (regenerate via `scripts/build-verified-places.mjs`). `products.ts` is still synthetic (regenerate via `scripts/gen-products.mjs`). To extend the real dataset, edit the curated list in `build-verified-places.mjs` or follow `docs/DATASET_NOTES.md`.
2. Keep each record shaped like the `Place` / `Product` / `InventoryItem` types in `src/lib/types`.
3. When moving to a database: the types are serializable and DB-friendly. Map `Place` → a `places` table (+ PostGIS `geography(Point)` for `latitude/longitude`), gate writes behind RLS by `ownerId`, and replace the localStorage stores with API calls of the same shape.

See `docs/kyiv-real-data-import.md` (import schema + `data/templates/places-import.csv`) and `docs/data-verification-checklist.md` for the manual verification workflow.

### Historical dataset snapshot and initial targets

The 31-place figures and early targets below describe the initial Kyiv dataset, not the current 90-place catalogue. Do not use the old textual verification shortcut: current phone claims require structured evidence and the freshness policy in `docs/DATA_FRESHNESS_V1_33_UK.md`.

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

Current phone confirmation requires `phoneConfirmedAt`, `phoneConfirmedBy` and the relevant capability evidence; a textual `verifiedBy` note alone is insufficient. Public claims expire according to the documented 30-day policy.

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

## Historical monetization proposal — not a current offer

The prices below are an earlier planning draft. v1.33 removes these offers from the public landing page; payment does not buy verification or emergency priority. No checkout or paid plan is active.

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

- The catalogue contains **90 places in Kyiv and Kyiv oblast**. Source checks, phone evidence and approximate coordinates are identified separately; inclusion does not guarantee current availability. Emergency/24-7 claims require valid phone evidence no older than 30 days and matching capability fields. Product inventory remains demo data, not live store stock.
- Pet records, saved items, followed topics and partner drafts use browser storage. They do not synchronize between devices. Server submissions, reports and protected operator screens require configured Supabase, migrations and operator credentials; these live integrations were not activated in this release.
- Assistant + triage explanations call **Claude** server-side when `ANTHROPIC_API_KEY` is set; without the key they run safe rule-based fallbacks. Neither ever diagnoses, prescribes, or gives dosages; **urgency levels are always deterministic** (rules in `src/lib/triage/engine.ts`, LLM cannot override them).
- Online bookings, partner billing, cloud medical records, family access, push notifications, verified visits and live product synchronization are not connected. **Pet Scan is a pilot/demo concept**, not real vision. Event sources are editorial snapshots, not an automatic news feed.
- Measurement is optional and disabled by default. Its anonymous session aggregates do not identify people, prove completed calls or visits, measure return between days, or provide billable leads.
- OSRM public routing may rate-limit; the map falls back to a straight line and the external "route" link always works.
- Local validation does not establish production integration health or physical-device accessibility. The current verification record and deployment limits are in [v1.34 release notes](docs/RELEASE_NOTES_V1_34_UK.md).

## Production roadmap

1. **Validate the launch territory** — recheck contacts, hours, services and urgent capabilities; assign an owner for reports about outdated data.
2. **Prove server delivery** — configure migrations, personal operator tokens, request limits and genuine contact details; confirm a submitted request reaches the protected queue.
3. **Prove optional measurement** — enable its flags only after testing a durable event receipt and the authorized aggregate report. Contact clicks remain distinct from acquired clients.
4. **Run a small partner and advertising pilot** — agree on practical value with a few clinics or groomers before introducing paid offers. Outreach drafts require review and have not been sent.
5. **Add integrations when supported by demand** — partner accounts, bookings, payment processing, cloud records and editorial automation each need their own delivery and operational checks.

Priorities, acceptance criteria and campaign guidance: [launch playbook](docs/LAUNCH_PLAYBOOK_V1_33_UK.md).

## Deployment checklist

- [ ] Copy `.env.example`, set production values and run `npm run release:gate`.
- [ ] Apply migrations in order through 006 for the backend; apply 007 when enabling launch measurement. Run `npm run db:postcheck` and the receipt/report checks in the measurement guide.
- [ ] `npm ci && NEXT_TELEMETRY_DISABLED=1 npm run verify` is green; `npm audit --omit=dev` clean.
- [ ] Deploy on Node.js 24.x (the version used for v1.34 verification). Optional standalone: `NEXT_OUTPUT=standalone npm run build`.
- [ ] Security headers/CSP are emitted by `next.config.mjs` (verify after deploy).
- [ ] Confirm map tiles (OSM) and external route links load from the deployed origin.
- [ ] Before any public emergency claim: phone-confirm providers (see data verification).

## Safety notes

- VetNear never diagnoses or prescribes; the assistant (Claude-powered when configured, else rule-based) and need router only route to services. **Pet Scan is a demo/local placeholder, not real AI vision.**
- Public emergency/24-7 claims require dated, attributable phone evidence no older than 30 days and the relevant capability fields. Urgent flows remain usable when no provider meets that evidence threshold; a past call never establishes current intake.
- Trust labels distinguish "Дані звірено з джерелом" from recent phone confirmation. Expired phone evidence retains its history without retaining the stronger public status.
- Google Places candidates are external review-only leads and are never auto-published.

## Data verification

- Current catalogue: 90 places across Kyiv and Kyiv oblast. Evidence types and dates are retained per record; published-source checks are not phone confirmation. See `docs/DATASET_NOTES.md` and `docs/data-verification-checklist.md`.
- Kyiv operational updates live in `src/lib/data/kyivUpdates.ts` and render at `/kyiv-updates`; every item has a concrete date, status, area, action and direct sources.
- Phone evidence requires `phoneConfirmedAt`/`phoneConfirmedBy`; the current public gate also checks age (maximum 30 days), future dates and capability fields. This does not establish current intake availability.
