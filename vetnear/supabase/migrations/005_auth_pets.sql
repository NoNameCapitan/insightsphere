-- VetNear migration 005 (v1.31): user accounts (Supabase Auth) + cloud pet cards.
-- Apply after 001–004. Idempotent.
--
-- Unlike every earlier table, `pets` is read and written with the USER's own
-- JWT (never the service role), so Row Level Security is the enforcement
-- point: a signed-in user can see and change only rows where
-- owner_id = auth.uid(). The anon role gets nothing.

create table if not exists pets (
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Client-generated id (the app works offline-first); unique per owner.
  id         text not null check (id ~ '^[A-Za-z0-9_-]{6,64}$'),
  name       text not null check (char_length(name) between 1 and 60),
  species    text not null check (species in ('cat','dog','bird','rodent','reptile','exotic','other')),
  breed      text check (char_length(breed) <= 80),
  sex        text check (sex in ('male','female','unknown')),
  birth_date date,
  weight_kg  numeric(6,2) check (weight_kg > 0 and weight_kg < 1000),
  notes      text check (char_length(notes) <= 2000),
  -- Everything else on the card (vaccinations, treatments, visits, weight
  -- history, reminders, small avatar). Files are NOT stored here.
  record     jsonb not null default '{}'::jsonb check (pg_column_size(record) <= 262144),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);

create index if not exists pets_owner_idx on pets (owner_id, updated_at desc);

alter table pets enable row level security;

revoke all on table pets from public, anon;
grant select, insert, update, delete on table pets to authenticated;

drop policy if exists pets_select_own on pets;
drop policy if exists pets_insert_own on pets;
drop policy if exists pets_update_own on pets;
drop policy if exists pets_delete_own on pets;

create policy pets_select_own on pets for select to authenticated
  using (owner_id = (select auth.uid()));
create policy pets_insert_own on pets for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy pets_update_own on pets for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy pets_delete_own on pets for delete to authenticated
  using (owner_id = (select auth.uid()));

-- updated_at is set by the database, not trusted from the client.
create or replace function pets_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists pets_touch on pets;
create trigger pets_touch before update on pets
  for each row execute function pets_touch_updated_at();

-- A hard cap per account keeps one user from filling the table.
create or replace function pets_enforce_limit() returns trigger
language plpgsql as $$
begin
  if (select count(*) from pets where owner_id = new.owner_id) >= 20 then
    raise exception 'pet limit reached' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists pets_limit on pets;
create trigger pets_limit before insert on pets
  for each row execute function pets_enforce_limit();
