# VetNear v1.26.1 — database integrity patch

> Superseded by v1.26.2, which integrates the rollback-only database post-check.

Independent verification of v1.26 confirmed the build, 280 tests, HTTP guards,
admin lockout and zero production dependency advisories. It also found three
residual integrity issues that this patch closes:

1. The daily lead de-duplication index now converts `timestamptz` to a UTC date
   before indexing. The previous direct `created_at::date` expression depends
   on the PostgreSQL session timezone and can fail on a fresh migration because
   index expressions must be immutable.
2. The moderation audit trigger now blocks both `UPDATE` and `DELETE`; v1.26
   blocked only updates despite describing the table as append-only.
3. Moderation-event identifiers now use `crypto.randomBytes`, matching the
   server-side identifier policy used by submissions and reports.

Three regression tests were added. Apply `003_security_hardening.sql` on staging
even if migrations 001–002 were already applied: it repairs the existing index
and installs the corrected audit trigger idempotently.

## Independent verification

- Clean extraction followed by `npm ci`: passed.
- `npm run verify`: lint, TypeScript, 283/283 tests (24 files), and production
  build all passed.
- `npm audit --omit=dev`: 0 known production vulnerabilities.
- Archive integrity: `unzip -t` passed; no `node_modules`, `.next`, `.env`, or
  embedded secrets are included.

The build still reports the upstream deprecation warning for React 18 under
Next.js 16. Plan a separately tested React 19 upgrade before adopting Next.js 17.
