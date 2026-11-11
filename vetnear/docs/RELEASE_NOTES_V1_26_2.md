# VetNear v1.26.2 — integrated database post-check

The verified PostgreSQL post-migration check is now part of the project.

## Added

- `scripts/vetnear-003-postcheck.sql`: rollback-only validation of RLS,
  effective role privileges, CHECK constraints, the UTC lead de-duplication
  index, append-only moderation events and purge-function permissions.
- `scripts/run-db-postcheck.mjs`: cross-platform runner that passes the
  PostgreSQL connection URL through `PGDATABASE` rather than the process
  argument list and never prints the secret.
- `npm run db:postcheck`.
- A regression test that confirms the post-check remains rollback-only and the
  runner does not log the database URL.

## Run

After applying migrations 001–003, first on staging:

```bash
DB_URL='postgresql://…' npm run db:postcheck
```

The PostgreSQL user must be able to execute `SET ROLE service_role`. The
post-check does not execute the lead-retention purge and does not test external
UkraineAlarm, shelter, Supabase REST or LLM integrations.

## Verification

- ESLint and TypeScript: passed.
- Vitest: 284/284 tests across 24 files.
- Next.js production build: passed.
- `npm audit --omit=dev`: 0 known production vulnerabilities.
- Missing or malformed `DB_URL` fails closed before invoking `psql`.
