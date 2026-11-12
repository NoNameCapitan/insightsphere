# VetNear v1.31 — accounts, cloud pet cards, billing foundation

Built on v1.30. Scope was kept to the launch path:
"sign in → create a pet card → find a clinic → call".

## Accounts (Supabase Auth, e-mail link)
- One screen for sign-up and sign-in: `/auth`. No passwords.
- The browser never talks to Supabase and never sees a key. The session lives
  in httpOnly cookies; `/api/auth/*` does the work on the server.
- Works with the default Supabase e-mail (`/auth/callback`) and with the
  recommended template (`/auth/confirm`, cross-device).
- `/account`: e-mail, sign out, **real** account deletion (pet cards cascade).
- Guest search stays fully open. Only `/my-pets` asks to sign in, softly.
- Error states: invalid e-mail, expired link, rate limit, accounts not set up.

## Pet cards in the account
- New table `pets` with Row Level Security: `owner_id = auth.uid()` on every
  operation, no grants to `anon`. The API uses the user's own JWT, not the
  service role, so the database enforces ownership.
- The existing `/my-pets` screens are unchanged. Browser storage became a
  cache; changes are pushed to the account, and a failed save is shown.
- Cards created on a device before signing in are never uploaded silently:
  the owner is offered "Перенести в акаунт" once.
- Attachments stay on the device (documents upload is out of scope). Pet
  photos are downsized to a small avatar so they fit in the card.

## Billing foundation (manual at launch)
- `published_places`: `subscription_status`, `billing_provider`,
  `billing_customer_id`, `billing_subscription_id`, `tier_changed_at`.
- `place_tier_events`: append-only history of every tier change.
- Admin tier change validates the plan, requires an end date for `promoted`,
  and records who changed what.
- `/for-partners`: honest wording ("рахунок виставляємо вручну"), what
  Verified vs Promoted mean, and a paid-tier request form →
  `partner_interest`, listed in `/admin/leads`.
- **No payment provider is connected.** Nothing here charges anyone.

## Not done (deliberately)
- Google / Apple sign-in, passwords.
- Cloud favourites (still per device).
- Partner self-service cabinet, automated billing, multi-location tools.
- Uploading documents; reminders by e-mail / push.

## Operations
- Migrations: `005_auth_pets.sql`, `006_billing_foundation.sql`.
- New env: `SUPABASE_ANON_KEY` (server-only). `release:gate` requires it and
  rejects a service-role key in its place.
- `npm run smoke -- https://site` — read-only post-deploy check.
- Privacy policy and terms updated for accounts.
- See `docs/SUPABASE_SETUP.md` §7–9.
