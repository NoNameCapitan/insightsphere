-- VetNear v1.26 security hardening. Run after 002. Idempotent.

-- 1. Defence in depth: RLS with zero policies already denies anon/authenticated,
--    but table GRANTs are revoked too, so a policy added by mistake later does
--    not silently expose data through the public PostgREST endpoint.
revoke all on table partner_submissions, moderation_events, place_reports,
  published_places, place_lead_events, moderator_tokens
  from anon, authenticated;

-- 2. Size limits in the database itself (the API validates too; this protects
--    against any future code path that forgets to).
do $$ begin
  alter table place_reports add constraint place_reports_sizes
    check (char_length(place_id) <= 120 and (message is null or char_length(message) <= 1000));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table place_lead_events add constraint place_lead_events_sizes
    check (char_length(place_id) <= 80 and (source_path is null or char_length(source_path) <= 120));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table partner_submissions add constraint partner_submissions_data_size
    check (pg_column_size(data) <= 65536);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table published_places add constraint published_places_promo_bounded
    check (tier <> 'promoted' or promoted_until is not null);
exception when duplicate_object then null; end $$;

-- 3. Repair the daily de-duplication index for both fresh and existing
--    databases. A direct timestamptz::date cast depends on the session TimeZone
--    and is therefore not immutable enough for an index expression.
drop index if exists place_lead_events_dedupe_idx;
create unique index place_lead_events_dedupe_idx
  on place_lead_events (
    place_id,
    event_type,
    session_hash,
    (((created_at at time zone 'UTC')::date))
  )
  where session_hash is not null;

-- 4. Append-only audit trail: moderation events can be inserted, but never
--    updated or deleted, including through the service-role API path.
create or replace function moderation_events_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'moderation_events is append-only';
end $$;
drop trigger if exists moderation_events_no_update on moderation_events;
drop trigger if exists moderation_events_no_mutation on moderation_events;
create trigger moderation_events_no_mutation
  before update or delete on moderation_events
  for each row execute function moderation_events_immutable();

-- 5. Retention: lead events older than 13 months carry no billing value.
--    Schedule with pg_cron:  select purge_old_lead_events();
create or replace function purge_old_lead_events() returns void
language sql as $$
  delete from place_lead_events where created_at < now() - interval '13 months';
$$;
revoke all on function purge_old_lead_events() from public, anon, authenticated;
