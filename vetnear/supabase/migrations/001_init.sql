-- VetNear — initial backend schema (Phase 2).
-- Run in Supabase SQL editor or via `supabase db push`.
--
-- Security model: RLS is ENABLED with NO public policies. All reads/writes go
-- through Next.js API routes using the SERVICE ROLE key (server-only), which
-- bypasses RLS. The anon key is never used for these tables, so nothing is
-- exposed to the browser directly.

-- ── Partner submissions ─────────────────────────────────────────────────────
create table if not exists partner_submissions (
  id          text primary key,
  status      text not null default 'pending_review'
              check (status in ('pending_review','approved','rejected','suspended','changes_requested')),
  category    text not null,
  district    text not null,
  name        text not null,
  -- Full typed submission payload (PartnerSubmission JSON, source of truth).
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists partner_submissions_status_idx on partner_submissions (status, created_at desc);

-- ── Moderation events (append-only audit) ───────────────────────────────────
create table if not exists moderation_events (
  id            text primary key,
  submission_id text not null references partner_submissions (id) on delete cascade,
  action        text not null check (action in ('approved','rejected','suspended','requested_changes')),
  reason        text,
  actor_role    text not null default 'moderator',
  created_at    timestamptz not null default now()
);

create index if not exists moderation_events_submission_idx on moderation_events (submission_id, created_at desc);

-- ── "Report incorrect info" from users ──────────────────────────────────────
create table if not exists place_reports (
  id         text primary key,
  place_id   text not null,
  reason     text not null check (reason in ('wrong_phone','wrong_address','wrong_hours','closed_permanently','duplicate','other')),
  message    text,
  created_at timestamptz not null default now()
);

create index if not exists place_reports_place_idx on place_reports (place_id, created_at desc);

-- ── Lock everything down: RLS on, zero policies ─────────────────────────────
alter table partner_submissions enable row level security;
alter table moderation_events   enable row level security;
alter table place_reports       enable row level security;
-- Intentionally NO `create policy` statements: anon/authenticated roles get
-- nothing; only the service role (server API) can read/write.
