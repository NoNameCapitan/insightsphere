# VetNear roadmap

Phased path from the current honest staging PWA to a real product. Each phase is
additive and should not break the previous one.

## Phase 0 — Pre-production hardening (current)
- Data provenance fields on places/submissions (`dataSource`, `verificationStatus`, `lastVerifiedAt`, ...).
- Demo data labeling everywhere (cards, profile, map popup, lists).
- Verified-only emergency results (`isEmergencySearchSafe`) + emergency warning copy.
- JSON-LD escaping (`safeJsonLd`) on every `application/ld+json` script.
- Security headers + CSP in `next.config.mjs`.
- Coordinate safety: no central-Kyiv fallback; missing coords ⇒ `needs_geocoding`, off the map.
- `verify` / `predeploy` scripts; TypeScript errors not ignored.

## Phase 1 — Real Kyiv data
- Replace demo dataset with manually verified places (see `docs/kyiv-real-data-import.md`).
- Import template + verification workflow (`docs/data-verification-checklist.md`).
- Source/date badges driven by real `lastVerifiedAt`.

## Phase 2 — Supabase backend
- Postgres + PostGIS for geo queries.
- Supabase Auth; attach `ownerId` to pets/places.
- Row-Level Security; server-side moderation.
- Swap local repositories for Supabase adapters (`src/lib/repositories`).

## Phase 3 — Partner claiming
- Claim-place flow; verified-partner status.
- Server-side audit log (`AuditLogRepository`).
- Real partner dashboard behind auth.

## Phase 4 — Inventory
- CSV / XLSX / API product imports with freshness labels.
- Product search filtered by the active pet.

## Phase 5 — Analytics
- Server-side events: route/call/website clicks.
- Partner-facing analytics.

## Phase 6 — AI
- Smart Pet Scan provider (real model behind the existing abstraction).
- LLM assistant with a strict safety prompt (no diagnosis/dosage).
- Smart Pet Report.

## Phase 7 — Native app
- Expo / React Native — only after the PWA proves real usage.
