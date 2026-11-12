-- VetNear migration 007 (v1.32): prepaid billing.
-- Apply after 006. Idempotent.
--
-- Model: a place buys a paid tier for a prepaid period. A payment (entered by
-- an admin today, sent by a provider webhook later) is recorded once, and in
-- the same transaction the place gets its tier and `prepaid_until`. A daily
-- job returns lapsed places to the free tier. Money never touches emergency
-- trust: nothing here can set 24/7 or emergency flags.

alter table published_places
  add column if not exists billing_plan_code text,
  add column if not exists prepaid_until timestamptz,
  add column if not exists last_payment_at timestamptz;

create index if not exists published_places_prepaid_idx
  on published_places (prepaid_until) where prepaid_until is not null;

alter table place_tier_events
  add column if not exists reason text not null default 'admin',
  add column if not exists plan_code text,
  add column if not exists payment_id text;

do $$ begin
  alter table place_tier_events add constraint place_tier_events_reason
    check (reason in ('admin','payment','expired'));
exception when duplicate_object then null; end $$;

-- One row per received payment. Append-only.
create table if not exists billing_payments (
  id                  text primary key,
  place_id            text not null,
  plan_code           text not null check (char_length(plan_code) between 3 and 40),
  tier                text not null check (tier in ('verified','promoted')),
  months              integer not null check (months between 1 and 12),
  amount_uah          numeric(10,2) not null check (amount_uah >= 0 and amount_uah < 1000000),
  currency            text not null default 'UAH' check (currency = 'UAH'),
  provider            text not null check (provider in ('manual','liqpay','fondy','stripe')),
  -- The provider's own payment/order id (or the bank reference an admin typed).
  provider_payment_id text check (char_length(provider_payment_id) between 1 and 120),
  period_start        timestamptz not null,
  period_end          timestamptz not null,
  actor_id            text,
  note                text check (char_length(note) <= 500),
  created_at          timestamptz not null default now(),
  check (period_end > period_start)
);

-- Idempotency: the same provider payment can never be recorded twice.
create unique index if not exists billing_payments_provider_ref_idx
  on billing_payments (provider, provider_payment_id) where provider_payment_id is not null;
create index if not exists billing_payments_place_idx on billing_payments (place_id, created_at desc);

create or replace function billing_payments_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'billing_payments is append-only';
end $$;
drop trigger if exists billing_payments_no_mutation on billing_payments;
create trigger billing_payments_no_mutation
  before update or delete on billing_payments
  for each row execute function billing_payments_immutable();

alter table billing_payments enable row level security;
revoke all on table billing_payments from public, anon, authenticated;

-- ── Activate a prepaid plan (atomic + idempotent) ───────────────────────────
-- Records the payment, sets the tier and the paid period, and writes the tier
-- history — all or nothing. Calling it again with the same provider payment
-- id changes nothing and reports `duplicate`.
create or replace function billing_activate_plan(
  p_place_id            text,
  p_plan_code           text,
  p_tier                text,
  p_months              integer,
  p_amount_uah          numeric,
  p_provider            text,
  p_provider_payment_id text,
  p_actor_id            text,
  p_note                text,
  p_max_promotion_days  integer default 365
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_now      timestamptz := now();
  v_place    published_places%rowtype;
  v_existing billing_payments%rowtype;
  v_start    timestamptz;
  v_end      timestamptz;
  v_payment  text;
begin
  if p_tier not in ('verified', 'promoted') then
    return jsonb_build_object('ok', false, 'error', 'invalid_tier');
  end if;
  if p_months is null or p_months < 1 or p_months > 12 then
    return jsonb_build_object('ok', false, 'error', 'invalid_period');
  end if;
  if p_amount_uah is null or p_amount_uah < 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount');
  end if;

  if p_provider_payment_id is not null then
    select * into v_existing from billing_payments
      where provider = p_provider and provider_payment_id = p_provider_payment_id;
    if found then
      return jsonb_build_object('ok', true, 'duplicate', true, 'paymentId', v_existing.id,
        'placeId', v_existing.place_id, 'tier', v_existing.tier, 'periodEnd', v_existing.period_end);
    end if;
  end if;

  select * into v_place from published_places where id = p_place_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'place_not_found');
  end if;

  -- A renewal of the same tier continues from the end of the paid period.
  v_start := v_now;
  if v_place.tier = p_tier and v_place.prepaid_until is not null and v_place.prepaid_until > v_now then
    v_start := v_place.prepaid_until;
  end if;
  v_end := v_start + make_interval(months => p_months);
  if p_tier = 'promoted' and v_end > v_now + make_interval(days => p_max_promotion_days) then
    return jsonb_build_object('ok', false, 'error', 'promotion_too_long');
  end if;

  v_payment := 'pay_' || replace(gen_random_uuid()::text, '-', '');
  begin
    insert into billing_payments
      (id, place_id, plan_code, tier, months, amount_uah, provider, provider_payment_id,
       period_start, period_end, actor_id, note, created_at)
    values
      (v_payment, p_place_id, p_plan_code, p_tier, p_months, p_amount_uah, p_provider, p_provider_payment_id,
       v_start, v_end, p_actor_id, nullif(left(coalesce(p_note, ''), 500), ''), v_now);
  exception when unique_violation then
    -- The same webhook arrived twice at once: the other call won.
    select * into v_existing from billing_payments
      where provider = p_provider and provider_payment_id = p_provider_payment_id;
    return jsonb_build_object('ok', true, 'duplicate', true, 'paymentId', v_existing.id,
      'placeId', v_existing.place_id, 'tier', v_existing.tier, 'periodEnd', v_existing.period_end);
  end;

  update published_places set
    tier                = p_tier,
    prepaid_until       = v_end,
    promoted_until      = case when p_tier = 'promoted' then v_end else null end,
    subscription_status = 'active',
    billing_provider    = p_provider,
    billing_plan_code   = p_plan_code,
    last_payment_at     = v_now,
    tier_changed_at     = v_now,
    updated_at          = v_now
  where id = p_place_id;

  insert into place_tier_events
    (id, place_id, from_tier, to_tier, promoted_until, subscription_status, billing_provider,
     actor_id, note, reason, plan_code, payment_id, created_at)
  values
    ('tier_' || replace(gen_random_uuid()::text, '-', ''), p_place_id, v_place.tier, p_tier,
     case when p_tier = 'promoted' then v_end else null end, 'active', p_provider,
     p_actor_id, nullif(left(coalesce(p_note, ''), 500), ''), 'payment', p_plan_code, v_payment, v_now);

  return jsonb_build_object('ok', true, 'duplicate', false, 'paymentId', v_payment, 'placeId', p_place_id,
    'tier', p_tier, 'periodStart', v_start, 'periodEnd', v_end);
end $$;

-- ── Return lapsed places to the free tier ───────────────────────────────────
-- Covers prepaid periods that ran out and promotions past their end date.
-- A verified tier set by hand with no paid period is left alone.
create or replace function billing_expire_plans() returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_now   timestamptz := now();
  v_count integer := 0;
  r       record;
begin
  for r in
    select id, tier from published_places
    where tier <> 'free'
      and (
        (prepaid_until is not null and prepaid_until <= v_now)
        or (tier = 'promoted' and prepaid_until is null and promoted_until <= v_now)
      )
    for update
  loop
    update published_places set
      tier = 'free', promoted_until = null, prepaid_until = null,
      subscription_status = 'none', billing_plan_code = null,
      tier_changed_at = v_now, updated_at = v_now
    where id = r.id;

    insert into place_tier_events
      (id, place_id, from_tier, to_tier, promoted_until, subscription_status, billing_provider,
       actor_id, note, reason, created_at)
    values
      ('tier_' || replace(gen_random_uuid()::text, '-', ''), r.id, r.tier, 'free', null, 'none', null,
       'system', 'Передоплачений період завершився', 'expired', v_now);
    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('expired', v_count);
end $$;

revoke all on function billing_activate_plan(text, text, text, integer, numeric, text, text, text, text, integer)
  from public, anon, authenticated;
revoke all on function billing_expire_plans() from public, anon, authenticated;

-- ── Daily expiry (pg_cron, same mechanism as migration 004) ─────────────────
create extension if not exists pg_cron;
do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'expire-prepaid-plans' limit 1;
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
  perform cron.schedule('expire-prepaid-plans', '20 2 * * *', 'select public.billing_expire_plans()');
end $$;
