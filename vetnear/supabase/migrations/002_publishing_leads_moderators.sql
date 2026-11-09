-- VetNear — v1.9 backend: publishing pipeline, lead events, multi-moderator auth.
-- Run after 001_init.sql.
--
-- Security model is unchanged from 001: RLS is ENABLED with NO policies.
-- Every read/write goes through Next.js API routes using the SERVICE ROLE key
-- (server-only). The anon key is never used against these tables.

-- ── Published places (public feed source of truth) ──────────────────────────
-- An approved partner submission is materialised here as a full Place payload.
-- The seed dataset in src/lib/data/places.ts stays as the zero-config baseline;
-- this table is the additive, server-owned layer on top of it.
create table if not exists published_places (
  id                   text primary key,
  slug                 text not null unique,
  -- Full Place JSON (canonical shape from src/lib/types).
  data                 jsonb not null,
  status               text not null default 'published'
                       check (status in ('published','unpublished')),
  -- Commercial tier. 'promoted' is the only paid one and MUST be labeled in UI.
  tier                 text not null default 'free'
                       check (tier in ('free','verified','promoted')),
  promoted_until       timestamptz,
  source_submission_id text references partner_submissions (id) on delete set null,
  published_at         timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists published_places_status_idx
  on published_places (status, published_at desc);
create index if not exists published_places_tier_idx
  on published_places (tier, promoted_until);

-- ── Lead events (the monetisation signal) ───────────────────────────────────
-- One row per outbound intent action on a place card / detail page.
-- Privacy: no IP, no user agent, no user id. `session_hash` is a salted,
-- day-bucketed SHA-256 digest used ONLY for coarse de-duplication, and it
-- rotates every day so it cannot track a person across days.
create table if not exists place_lead_events (
  id           text primary key,
  place_id     text not null,
  event_type   text not null
               check (event_type in ('call','route','website','social','request','detail_view')),
  session_hash text,
  source_path  text,
  created_at   timestamptz not null default now()
);

create index if not exists place_lead_events_place_idx
  on place_lead_events (place_id, created_at desc);
create index if not exists place_lead_events_created_idx
  on place_lead_events (created_at desc);

-- Coarse de-duplication: at most one row per place+type+session per day.
create unique index if not exists place_lead_events_dedupe_idx
  on place_lead_events (place_id, event_type, session_hash, (created_at::date))
  where session_hash is not null;

-- ── Moderator tokens (replaces the single shared ADMIN_TOKEN) ───────────────
-- Tokens are stored as SHA-256 hashes only; the plaintext exists once, at
-- creation time. Revocation is a timestamp, so the audit trail survives.
create table if not exists moderator_tokens (
  id           text primary key,
  label        text not null,
  token_hash   text not null unique,
  role         text not null default 'moderator'
               check (role in ('moderator','admin')),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

create index if not exists moderator_tokens_active_idx
  on moderator_tokens (token_hash) where revoked_at is null;

-- ── Attribute moderation events to a specific actor ─────────────────────────
alter table moderation_events
  add column if not exists actor_id text;

-- ── Lock everything down: RLS on, zero policies ─────────────────────────────
alter table published_places  enable row level security;
alter table place_lead_events enable row level security;
alter table moderator_tokens  enable row level security;
-- Intentionally NO `create policy` statements.
