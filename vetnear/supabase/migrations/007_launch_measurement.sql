-- Optional first-party launch measurement; no IP, user agent, pet ID or medical text.
create table if not exists public.launch_events (
  id uuid primary key,
  event_name text not null check (event_name in ('page_viewed','nearby_search_started','search_results_viewed','place_profile_opened','place_profile_viewed','call_clicked','route_clicked','website_clicked','place_saved','pet_profile_created','care_event_created','calendar_exported','add_place_started','add_place_submitted')),
  session_hash text not null check (session_hash ~ '^[a-f0-9]{32}$'),
  route_group text not null,
  props jsonb not null default '{}'::jsonb,
  campaign jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists launch_events_created_idx on public.launch_events(created_at desc);
alter table public.launch_events enable row level security;
revoke all on public.launch_events from anon, authenticated;
grant all on public.launch_events to service_role;

create or replace function public.purge_old_launch_events() returns void
language sql security definer set search_path = public as $$
  delete from public.launch_events where created_at < now() - interval '90 days';
$$;
revoke all on function public.purge_old_launch_events() from public, anon, authenticated;
grant execute on function public.purge_old_launch_events() to service_role;
-- 004 installs pg_cron. This migration is applied after 006.
do $$
declare old_job bigint;
begin
  select jobid into old_job from cron.job where jobname = 'purge-old-launch-events' limit 1;
  if old_job is not null then perform cron.unschedule(old_job); end if;
  perform cron.schedule('purge-old-launch-events', '15 3 * * *', 'select public.purge_old_launch_events()');
end $$;
