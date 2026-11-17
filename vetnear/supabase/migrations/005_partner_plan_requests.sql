-- VetNear v1.32: non-binding partner interest; billing scaffolding stays inactive.
-- Apply on staging first. No existing listing is upgraded or charged.
create table if not exists public.partner_plan_requests (
  id uuid primary key,
  organization text not null check (char_length(organization) between 2 and 180),
  contact_name text check (char_length(contact_name) <= 120),
  contact_email text not null check (char_length(contact_email) <= 254),
  locality text not null check (char_length(locality) between 1 and 160),
  official_website text check (char_length(official_website) <= 500),
  requested_plan text not null check (requested_plan in ('free','verified','pro','multi_location')),
  founding_partner boolean not null default false,
  message text check (char_length(message) <= 1500),
  consent_version text not null,
  status text not null default 'pending_review' check (status in ('pending_review','contacted','closed')),
  created_at timestamptz not null default now()
);
create index if not exists partner_plan_requests_queue_idx on public.partner_plan_requests(status, created_at desc);
alter table public.partner_plan_requests enable row level security;
revoke all on public.partner_plan_requests from anon, authenticated;

-- Provider event deduplication seam. No public webhook or payment endpoint is
-- enabled in v1.32. Never put raw card data or unfiltered webhook payloads here.
create table if not exists public.partner_billing_events (
  id text primary key,
  provider text not null,
  provider_subscription_id text not null,
  event_type text not null,
  signature_verified boolean not null default false,
  received_at timestamptz not null default now(),
  applied_at timestamptz
);
alter table public.partner_billing_events enable row level security;
revoke all on public.partner_billing_events from anon, authenticated;

create table if not exists public.partner_billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  partner_id text not null,
  plan text not null check (plan in ('free','verified','pro','multi_location')),
  status text not null default 'pending' check (status in ('pending','active','past_due','cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid','refunded')),
  approved_price_id text,
  provider_subscription_id text unique,
  verified_event_id text references public.partner_billing_events(id),
  paid_at timestamptz,
  period_start timestamptz,
  period_end timestamptz,
  updated_at timestamptz not null default now(),
  constraint active_subscription_requires_evidence check (
    status <> 'active' or (
      payment_status = 'paid' and approved_price_id is not null
      and provider_subscription_id is not null and verified_event_id is not null
      and paid_at is not null and period_start is not null
      and period_end is not null and period_end > period_start
    )
  )
);
alter table public.partner_billing_subscriptions enable row level security;
revoke all on public.partner_billing_subscriptions from anon, authenticated;
-- No seed subscriptions, paid tiers or active plans are inserted by this migration.
