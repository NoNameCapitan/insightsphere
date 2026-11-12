# VetNear v1.30 — release hardening

Security/release follow-up on top of v1.29. Product UI, safety decisions and
place data are unchanged.

## Integrated

- Distributed fixed-window rate limits through Upstash Redis REST for all
  sensitive/public API routes; safe bounded in-memory fallback for local work.
- Distributed moderator brute-force lockout; successful authentication clears
  the caller's failure bucket.
- Legacy shared `ADMIN_TOKEN` authentication removed from runtime code.
- Route-specific namespaces prevent unrelated endpoints sharing counters.
- `.env.example` with every supported variable and no secret values.
- `npm run release:gate` validates production-required env, rejects legacy
  `ADMIN_TOKEN`, demo emergency mode, weak salts and non-HTTPS endpoints.
- Migration `004_lead_retention_schedule.sql` schedules the existing
  13-month lead purge weekly through pg_cron.
- Service-worker cache namespace bumped to `vetnear-v1.30` so deployed clients
  do not remain on the old shell.

## Still operational (cannot be completed without project access)

1. Apply migrations 001–004 to staging, then production.
2. Run `npm run db:postcheck` after migration 003.
3. Configure Vercel env and issue personal moderator tokens.
4. Run the documented live smoke tests for Supabase, UkraineAlarm, shelters,
   lead deduplication and the emergency trust gate.
5. Phone-confirm every provider shown in an urgent/24-7 flow.

Nonce-based CSP and full Supabase Auth remain post-launch architecture work;
they are intentionally not introduced in this release to avoid destabilizing
the verified Next.js/Leaflet interface.
