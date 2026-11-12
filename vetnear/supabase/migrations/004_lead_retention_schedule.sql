-- VetNear v1.30 retention automation. Run after 003.
-- Supabase supports pg_cron in the postgres project database.
create extension if not exists pg_cron;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'purge-old-lead-events'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'purge-old-lead-events',
    '0 3 * * 0',
    'select public.purge_old_lead_events()'
  );
end $$;

-- The job is deliberately weekly; the function removes only rows older than
-- 13 months, so re-running this migration is safe and does not shorten policy.
