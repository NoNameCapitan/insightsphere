-- v1.32: Kyiv oblast settlements do not have a Kyiv city district.
-- Region/locality/countryCode stay in the typed data JSON, the source of truth.
-- Keep existing district values, indexes and public/moderation permissions intact.
begin;

alter table public.partner_submissions
  alter column district drop not null;

comment on column public.partner_submissions.district is
  'Optional Kyiv city district. NULL for oblast settlements or an unspecified city district; region/locality are stored in data.';

commit;
