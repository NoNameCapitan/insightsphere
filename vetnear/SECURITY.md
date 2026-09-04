# Security & Trust — VetNear

This document describes the security posture of the MVP and the model the
production system is being built toward (Module 12).

## Roles & permissions

Roles: `guest`, `user`, `partner`, `moderator`, `admin` (`src/lib/types`).

| Capability        | guest | user | partner | moderator | admin |
|-------------------|:----:|:----:|:-------:|:---------:|:-----:|
| search            |  ✅  |  ✅  |   ✅    |    ✅     |  ✅  |
| create pet        |      |  ✅  |   ✅    |    ✅     |  ✅  |
| submit place      |      |      |   ✅    |    ✅     |  ✅  |
| manage own place  |      |      |   ✅    |    ✅     |  ✅  |
| moderate          |      |      |         |    ✅     |  ✅  |
| manage all        |      |      |         |           |  ✅  |

Enforced in code via `can(role, permission)` / `permissionsFor(role)`
(`src/lib/permissions.ts`). The MVP has no auth yet; these are the rules the
server/RLS layer will enforce once auth lands.

## Input & URL validation

- `src/lib/security/url.ts` allows only `http`, `https`, `tel`, `mailto`.
- `javascript:`, `data:`, `vbscript:`, `file:` are explicitly rejected (case/space-insensitive).
- Unsafe/invalid URLs are dropped (links simply don't render) rather than passed through.
- Email/phone validated on partner submission (`isValidEmail`, `isValidPhone`).
- All external links use `target="_blank"` + `rel="noopener noreferrer"` (`EXTERNAL_LINK_PROPS`).
- JSON-LD is emitted only through `safeJsonLd()` (`src/lib/security/jsonLd.ts`), which escapes `<`, `>`, `&`, U+2028 and U+2029 so structured data cannot break out of the `<script type="application/ld+json">` tag even if user-generated content is ever included.

## Security headers

Set globally in `next.config.mjs` via `async headers()` on `/:path*`:

| Header | Value |
|---|---|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(self), microphone=(), geolocation=(self), payment=()` |
| `Content-Security-Policy` | see below |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` (production only) |

**CSP** `default-src 'self'`; `img-src 'self' data: blob: https:`; `connect-src 'self' https:`;
`font-src 'self' data:`; `worker-src 'self' blob:`; `manifest-src 'self'`;
`frame-ancestors 'none'`; `base-uri 'self'`; `form-action 'self'`; `object-src 'none'`;
`upgrade-insecure-requests` (production).

**CSP limitations (documented, intentional):**
- `script-src` includes `'unsafe-inline'` — Next.js injects inline bootstrap/runtime scripts; without a nonce pipeline this is required. `'unsafe-eval'` is added **in development only** (React Fast Refresh).
- `style-src` includes `'unsafe-inline'` — Leaflet and Tailwind inject inline styles.
- `img-src`/`connect-src` allow `https:` broadly — OpenStreetMap raster tiles, OSRM routing and Nominatim geocoding are third-party HTTPS hosts loaded/contacted client-side.
- A future hardening step is a nonce-based CSP (removing `'unsafe-inline'` for scripts) once a server/middleware layer exists.

## Demo data & demo admin (not production)

- **Place data:** the bundled **public places** are **30 manually curated** Kyiv
  businesses (`dataSource: "manual_verified"`, `verificationStatus: "verified"`,
  honest `lastVerifiedAt`/`verifiedBy`), compiled from official sites and public
  directories. They are **verified against public sources, not phone-confirmed**, so
  the UI labels them "Перевірено за публічними джерелами" (see `docs/DATASET_NOTES.md`).
  **Product inventory remains synthetic/demo.** **Emergency/24-7 availability is
  disabled** until phone-confirmed: `emergencyAvailable`/`isOpen24_7` are `false`, no
  `emergency_vet` category is used, and the urgent CTA routes to the nearest vet
  clinics. **Unverified/demo data must not be used for public emergency discovery** —
  emergency results are gated by `isEmergencySearchSafe` / `isPhoneConfirmedEmergency`,
  and any demo/unverified emergency listings are **hidden from public emergency-first
  results** (`isPublicEmergencyVisible`) unless `NEXT_PUBLIC_SHOW_DEMO_EMERGENCY=true`
  (dev/staging only); when hidden, a transparent empty state is shown.
- **Demo admin/moderation:** `/admin`, `/admin/moderation` and `/partner/dashboard`
  are **browser-only demos backed by `localStorage`** — they are **not production
  authentication** and enforce no real authorization. Banners on these pages state
  this. Public moderation/partner management requires the Phase 2 backend (Supabase
  Auth + RLS + server-side moderation; see `docs/ROADMAP.md`).
- **Public forms are not production-grade** without server-side enforcement:
  `add-place`, `report-issue`, `lost-found` and service requests go through client
  stores with only a **mock** rate limiter (`src/lib/security/rateLimit.ts`). Real
  rate limiting must be enforced server-side at the API/router level before these
  forms accept untrusted public traffic.

## Moderation & trust

- Partner submissions are created as `pending_review` and are **not** discoverable until `approved`.
- Moderation actions are recorded as `ModerationEvent`s; an `AuditLogEvent` type exists for a future server-side audit trail.
- "Report incorrect info" (`ReportIssue`) lets any user flag stale/wrong data.
- Trust badges (verified / claimed / updated-recently / **data may be outdated** / emergency / open-now / partner / free) make data freshness explicit to users.

## Geolocation privacy

- Location is requested only when needed and used client-side for distance/ranking.
- Coordinates are persisted only in the user's own `localStorage` (manual fallback), never sent to a server in the MVP.
- A coarse district/city fallback is offered when permission is denied or unavailable — exact location is never required.

## Uploads (documented restrictions)

- The `/admin/imports` UI is a placeholder; no parsing/persistence happens client-side.
- Production rules: restrict by extension (`.csv`, `.xlsx`, `.zip`) and size; validate/scan server-side; never trust client MIME; parse in an isolated worker/queue; reject formula-injection in spreadsheet cells.

## Rate limiting

- **`POST /api/assistant` is rate-limited server-side** (real protection):
  `src/lib/security/serverRateLimit.ts` — fixed-window in-memory limiter,
  **10 requests / minute / IP** (first hop of `x-forwarded-for`, then
  `x-real-ip`, then a shared bucket). Exceeding it returns **429** with a
  `Retry-After` header, before any parsing or Anthropic call, so the route
  cannot be used to burn API credits. The store is per-process; on
  serverless/multi-instance deploys swap the store to Redis/Upstash keeping
  the same interface. Covered by unit tests.
- Public forms (add-place, report) now write to the server via
  `POST /api/submissions` (5/10 min/IP) and `POST /api/reports` (10/10 min/IP),
  both behind the same fixed-window limiter. Payloads pass server-side
  validation (`src/lib/server/submissionValidation.ts`) that force-resets
  `status`, provenance and `emergencyAvailable=false` regardless of client
  input. Admin moderation endpoints (`/api/admin/*`) require the `x-admin-token`
  header, compared in constant time; Supabase tables have RLS enabled with no
  public policies, so the service-role API routes are the only gateway.
  The client-side `checkRateLimitMock` remains UX-only.

## Future auth / RLS

- Introduce auth (e.g. Supabase Auth). Attach `ownerId` to pets/places.
- Row-Level Security: owners read/write their rows; partners manage only their places; moderators/admins per the table above.
- Move localStorage stores to API routes with the same data shapes; add CSRF protection and server-side validation mirroring the client checks here.

## Dependency security

- **Next.js upgraded 14.2.35 → 16.2.9**, which **resolves the previous high-severity
  advisory**. `npm audit --omit=dev` reports **0 production vulnerabilities**. Full
  `npm audit` may report dev-tooling vulnerabilities through the Vitest/Vite/esbuild
  chain; these never ship in the production build but should be updated after the
  hackathon.
- React kept at **18.3.1** (Next 16 supports React 18.2+), so `react-leaflet@4.2.1`
  and the map stack are unchanged — minimal migration surface.
- `postcss` pinned to **8.5.15** via an npm `override` (clears the transitive
  `postcss <8.5.10` advisory in Next's bundled copy).
- Tooling: **ESLint 9** + **eslint-config-next 16** via flat config
  (`eslint.config.mjs`); `next lint` was removed in Next 16, so `npm run lint`
  now runs `eslint .`.

### Next 16 migration notes (no features changed)
- Dynamic route `params` are now async (Promises). `app/place/[id]` and
  `app/city/kyiv/district/[district]` were updated to `await params`.
- Removed config keys that Next 16 no longer recognises (`eslint`,
  `outputFileTracing`); `output:"standalone"` stays opt-in via `NEXT_OUTPUT=standalone`.
