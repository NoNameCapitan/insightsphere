# VetNear v1.32 — Google sign-in and prepaid billing

Two goals only: make signing in effortless, and make prepaid Verified /
Promoted ready to sell.

## Sign in with Google
- "Продовжити з Google" is the main action on `/auth` and on the `/my-pets`
  gate; the e-mail link stays as a quiet fallback ("або увійти через email").
- Done on the server with PKCE through Supabase Auth: the browser never sees
  a key or a token, and the session uses the same httpOnly cookies as before.
  It is a normal page redirect — no popup to block or close.
- After sign-in the user lands where they were going.
- The button is shown only when the Google provider is enabled in Supabase
  (asked from Supabase, cached), so there is no dead button and no new env.
- Calm error states: cancelled, expired/other browser, provider unavailable,
  rate limit, e-mail already linked to another method.
- Same e-mail = same account: Supabase links Google to an existing
  magic-link user, so pet cards stay. `/account` shows the sign-in method.

## Prepaid billing
- **Model:** a place prepays for a period; a payment switches the plan on;
  the plan switches itself off when the period ends. No auto-charging.
- **Plans:** `verified_1m/3m/6m/12m` (449 ₴ per month), `promoted_1m/3m`
  (by agreement — the received amount is always entered explicitly).
- **One atomic database function** `billing_activate_plan` records the
  payment, sets tier + `prepaid_until`, and writes the tier history. It is
  idempotent by payment reference, and a renewal extends the paid period.
- **Expiry:** `billing_expire_plans` runs nightly (pg_cron), from the admin
  page, or via `npm run billing:expire`.
- **Admin** (`/admin/leads`): "Оплату отримано — активувати", current plan,
  payments, tier history, plans ending within 7 days, and statuses for
  paid-tier requests.
- **Provider seam:** `BillingProvider` interface, order-id helpers and
  `POST /api/billing/webhook` with signature verification, amount check and
  idempotency. With no provider connected (the launch state) the webhook
  answers 501 and cannot activate anything.
- `/for-partners`: plain tiers, the three steps, and the rule stated up
  front: paid promotion does not work in urgent searches.

## Verified against a real database
All seven migrations now run in the test suite on an in-memory Postgres
(PGlite): owner-only pet cards under RLS, server-only billing tables,
idempotent activation, renewal, append-only history and expiry.

## Not done (deliberately)
- A live payment provider (LiqPay / Fondy): one adapter away, see
  `docs/SUPABASE_SETUP.md` §8.3.
- Partner self-service cabinet, refunds, invoices as documents.
- Apple sign-in, Google One Tap.

## Operations
- Migration: `007_prepaid_billing.sql` (apply before deploying — the admin
  tier and billing endpoints need its columns).
- No new environment variables.
- New dev dependency: `@electric-sql/pglite` (tests only).
