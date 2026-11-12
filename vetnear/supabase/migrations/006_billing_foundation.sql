-- VetNear migration 006 (v1.31): billing foundation + partner interest.
-- Apply after 005. Idempotent.
--
-- No payment provider is connected yet: tiers are set by an admin after a
-- manual agreement. These columns exist so LiqPay / Fondy / Stripe can be
-- attached later without changing the model.

alter table published_places
  add column if not exists subscription_status text not null default 'none',
  add column if not exists billing_provider text,
  add column if not exists billing_customer_id text,
  add column if not exists billing_subscription_id text,
  add column if not exists tier_changed_at timestamptz;

do $$ begin
  alter table published_places add constraint published_places_subscription_status
    check (subscription_status in ('none','active','past_due','canceled'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table published_places add constraint published_places_billing_provider
    check (billing_provider is null or billing_provider in ('manual','liqpay','fondy','stripe'));
exception when duplicate_object then null; end $$;

-- Append-only history of every tier change (who, from, to, until when).
create table if not exists place_tier_events (
  id                  text primary key,
  place_id            text not null,
  from_tier           text,
  to_tier             text not null check (to_tier in ('free','verified','promoted')),
  promoted_until      timestamptz,
  subscription_status text not null default 'none',
  billing_provider    text,
  actor_id            text,
  note                text check (char_length(note) <= 500),
  created_at          timestamptz not null default now()
);
create index if not exists place_tier_events_place_idx on place_tier_events (place_id, created_at desc);

create or replace function place_tier_events_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'place_tier_events is append-only';
end $$;
drop trigger if exists place_tier_events_no_mutation on place_tier_events;
create trigger place_tier_events_no_mutation
  before update or delete on place_tier_events
  for each row execute function place_tier_events_immutable();

-- "I want Verified / Promoted": a sales lead, handled by a person.
create table if not exists partner_interest (
  id         text primary key,
  place_name text not null check (char_length(place_name) between 2 and 120),
  phone      text not null check (char_length(phone) between 7 and 20),
  email      text not null check (char_length(email) between 5 and 160),
  plan       text not null check (plan in ('verified','promoted','network')),
  note       text check (char_length(note) <= 1000),
  status     text not null default 'new' check (status in ('new','contacted','won','lost')),
  created_at timestamptz not null default now()
);
create index if not exists partner_interest_status_idx on partner_interest (status, created_at desc);

-- Same lockdown as every other server-only table: RLS on, zero policies,
-- no grants. Only the service role (server API) can read or write.
alter table place_tier_events enable row level security;
alter table partner_interest  enable row level security;
revoke all on table place_tier_events, partner_interest from public, anon, authenticated;
