-- =========================================================
-- MOTM FOOTBALL DATABASE
-- Run this whole file in Supabase SQL Editor.
-- =========================================================

create extension if not exists pgcrypto;

create type public.user_role as enum ('organizer', 'captain');
create type public.session_status as enum ('open', 'full', 'ongoing', 'completed', 'cancelled');
create type public.registration_status as enum ('pending_payment', 'confirmed', 'cancelled');
create type public.payment_status as enum ('pending', 'paid', 'rejected', 'refunded');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  role public.user_role not null default 'captain',
  created_at timestamptz not null default now()
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  match_date date not null,
  start_time time not null,
  end_time time not null,
  venue text not null,
  format text not null,
  players_per_team integer not null default 12 check (players_per_team > 0),
  max_teams integer not null check (max_teams > 0),
  deposit_amount numeric(10,2) not null default 0 check (deposit_amount >= 0),
  registration_deadline timestamptz,
  status public.session_status not null default 'open',
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  captain_id uuid not null references public.profiles(id) on delete cascade,
  team_name text not null,
  team_logo_url text,
  registration_status public.registration_status not null default 'pending_payment',
  created_at timestamptz not null default now()
);

create table public.team_players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  player_name text not null check (length(trim(player_name)) > 0),
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  amount numeric(10,2) not null check (amount >= 0),
  status public.payment_status not null default 'pending',
  payment_reference text,
  proof_url text,
  verified_by uuid references public.profiles(id),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (team_id)
);

create table public.fixtures (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  home_team_id uuid references public.teams(id) on delete cascade,
  away_team_id uuid references public.teams(id) on delete cascade,
  match_order integer not null,
  match_date date,
  start_time time,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- New user -> profile
-- ---------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'phone',
    'captain'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------
-- Register a team safely.
-- Pending registrations consume a slot so two captains
-- cannot race for the same last slot.
-- ---------------------------------------------------------

create or replace function public.register_team(
  p_session_id uuid,
  p_team_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_team_id uuid;
  v_max_teams integer;
  v_registered integer;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  if exists (
    select 1 from public.teams
    where session_id = p_session_id
      and captain_id = v_user
      and registration_status <> 'cancelled'
  ) then
    raise exception 'You already registered a team for this session';
  end if;

  select max_teams
    into v_max_teams
  from public.sessions
  where id = p_session_id
    and status = 'open'
  for update;

  if v_max_teams is null then
    raise exception 'Session not found or is not open';
  end if;

  select count(*)
    into v_registered
  from public.teams
  where session_id = p_session_id
    and registration_status <> 'cancelled';

  if v_registered >= v_max_teams then
    raise exception 'No team slots are available';
  end if;

  insert into public.teams (session_id, captain_id, team_name)
  values (p_session_id, v_user, trim(p_team_name))
  returning id into v_team_id;

  return v_team_id;
end;
$$;

-- ---------------------------------------------------------
-- Captain can delete their own pending team.
-- Paid/confirmed teams cannot be deleted because a refund
-- would need to be handled by the organizer/payment provider.
-- ---------------------------------------------------------

create or replace function public.delete_team(
  p_team_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_status public.registration_status;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  select registration_status
  into v_status
  from public.teams
  where id = p_team_id
    and captain_id = v_user;

  if v_status is null then
    raise exception 'Team not found or you are not the captain';
  end if;

  if v_status <> 'pending_payment' then
    raise exception 'Confirmed teams cannot be deleted. Contact the organizer for cancellation/refund.';
  end if;

  delete from public.teams
  where id = p_team_id
    and captain_id = v_user;
end;
$$;

grant execute on function public.delete_team(uuid) to authenticated;

-- ---------------------------------------------------------
-- Keep team player count within the session's limit.
-- ---------------------------------------------------------

create or replace function public.enforce_player_limit()
returns trigger
language plpgsql
as $$
declare
  v_limit integer;
  v_count integer;
begin
  select s.players_per_team
    into v_limit
  from public.teams t
  join public.sessions s on s.id = t.session_id
  where t.id = new.team_id;

  if v_limit is null then
    raise exception 'Team or session not found';
  end if;

  select count(*)
    into v_count
  from public.team_players
  where team_id = new.team_id;

  if v_count >= v_limit then
    raise exception 'This team is already full';
  end if;

  return new;
end;
$$;

drop trigger if exists check_team_player_limit on public.team_players;

create trigger check_team_player_limit
before insert on public.team_players
for each row execute procedure public.enforce_player_limit();

-- ---------------------------------------------------------
-- Update session status automatically when team slots fill.
-- ---------------------------------------------------------

create or replace function public.refresh_session_status()
returns trigger
language plpgsql
as $$
declare
  v_max integer;
  v_count integer;
begin
  select max_teams into v_max
  from public.sessions
  where id = coalesce(new.session_id, old.session_id);

  select count(*) into v_count
  from public.teams
  where session_id = coalesce(new.session_id, old.session_id)
    and registration_status <> 'cancelled';

  update public.sessions
  set status = case
    when v_count >= v_max then 'full'::public.session_status
    else 'open'::public.session_status
  end
  where id = coalesce(new.session_id, old.session_id)
    and status in ('open', 'full');

  return coalesce(new, old);
end;
$$;

drop trigger if exists refresh_session_status_trigger on public.teams;

create trigger refresh_session_status_trigger
after insert or update or delete on public.teams
for each row execute procedure public.refresh_session_status();

-- ---------------------------------------------------------
-- RLS
-- ---------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.teams enable row level security;
alter table public.team_players enable row level security;
alter table public.payments enable row level security;
alter table public.fixtures enable row level security;

-- Profiles
create policy "profiles_select_own_or_organizer"
on public.profiles for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'organizer'
  )
);

create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Sessions
create policy "sessions_select_authenticated"
on public.sessions for select
to authenticated
using (true);

create policy "sessions_select_anon"
on public.sessions for select
to anon
using (status = 'open');

create policy "sessions_insert_organizer"
on public.sessions for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'organizer'
  )
);

create policy "sessions_update_organizer"
on public.sessions for update
to authenticated
using (
  created_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'organizer'
  )
)
with check (created_by = auth.uid());

create policy "sessions_delete_organizer"
on public.sessions for delete
to authenticated
using (
  created_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'organizer'
  )
);

-- Teams
create policy "teams_select_authenticated"
on public.teams for select
to authenticated
using (true);

create policy "teams_select_anon"
on public.teams for select
to anon
using (true);

create policy "teams_insert_captain"
on public.teams for insert
to authenticated
with check (captain_id = auth.uid());

create policy "teams_update_captain"
on public.teams for update
to authenticated
using (captain_id = auth.uid())
with check (captain_id = auth.uid());

create policy "teams_delete_captain_or_organizer"
on public.teams for delete
to authenticated
using (
  captain_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'organizer'
  )
);

-- Team players
create policy "team_players_select_authenticated"
on public.team_players for select
to authenticated
using (true);

create policy "team_players_select_anon"
on public.team_players for select
to anon
using (true);

create policy "team_players_insert_captain"
on public.team_players for insert
to authenticated
with check (
  exists (
    select 1 from public.teams t
    where t.id = team_players.team_id
      and t.captain_id = auth.uid()
  )
);

create policy "team_players_update_captain"
on public.team_players for update
to authenticated
using (
  exists (
    select 1 from public.teams t
    where t.id = team_players.team_id
      and t.captain_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.teams t
    where t.id = team_players.team_id
      and t.captain_id = auth.uid()
  )
);

create policy "team_players_delete_captain"
on public.team_players for delete
to authenticated
using (
  exists (
    select 1 from public.teams t
    where t.id = team_players.team_id
      and t.captain_id = auth.uid()
  )
);

-- Payments
create policy "payments_select_owner_or_organizer"
on public.payments for select
to authenticated
using (
  exists (
    select 1 from public.teams t
    where t.id = payments.team_id
      and t.captain_id = auth.uid()
  )
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'organizer'
  )
);

create policy "payments_insert_team_captain"
on public.payments for insert
to authenticated
with check (
  exists (
    select 1 from public.teams t
    where t.id = payments.team_id
      and t.captain_id = auth.uid()
  )
);

create policy "payments_update_organizer"
on public.payments for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'organizer'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'organizer'
  )
);

-- Fixtures
create policy "fixtures_select_authenticated"
on public.fixtures for select
to authenticated
using (true);

create policy "fixtures_insert_organizer"
on public.fixtures for insert
to authenticated
with check (
  exists (
    select 1 from public.sessions s
    where s.id = fixtures.session_id
      and s.created_by = auth.uid()
  )
);

create policy "fixtures_update_organizer"
on public.fixtures for update
to authenticated
using (
  exists (
    select 1 from public.sessions s
    where s.id = fixtures.session_id
      and s.created_by = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.sessions s
    where s.id = fixtures.session_id
      and s.created_by = auth.uid()
  )
);

create policy "fixtures_delete_organizer"
on public.fixtures for delete
to authenticated
using (
  exists (
    select 1 from public.sessions s
    where s.id = fixtures.session_id
      and s.created_by = auth.uid()
  )
);


-- MOTM Individuals: public teams with up to 30 named players.
-- Unpaid teams are visible but remain 'not_counted' until Stripe payment succeeds.

create table if not exists public.individual_settings (
  id integer primary key default 1 check (id = 1),
  deposit_amount numeric(10,2) not null default 50 check (deposit_amount > 0),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
insert into public.individual_settings (id, deposit_amount) values (1, 50)
on conflict (id) do nothing;

create table if not exists public.individual_teams (
  id uuid primary key default gen_random_uuid(),
  captain_id uuid not null references public.profiles(id) on delete cascade,
  team_name text not null check (length(trim(team_name)) between 2 and 70),
  deposit_amount numeric(10,2) not null check (deposit_amount > 0),
  status text not null default 'not_counted' check (status in ('not_counted', 'counted', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.individual_players (
  id uuid primary key default gen_random_uuid(),
  individual_team_id uuid not null references public.individual_teams(id) on delete cascade,
  player_name text not null check (length(trim(player_name)) between 1 and 100),
  created_at timestamptz not null default now()
);

create table if not exists public.individual_payments (
  id uuid primary key default gen_random_uuid(),
  individual_team_id uuid not null unique references public.individual_teams(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  status public.payment_status not null default 'pending',
  payment_reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.individual_settings enable row level security;
alter table public.individual_teams enable row level security;
alter table public.individual_players enable row level security;
alter table public.individual_payments enable row level security;

revoke insert, update, delete on public.individual_settings from anon, authenticated;
revoke insert, update, delete on public.individual_teams from anon, authenticated;
revoke insert, update, delete on public.individual_payments from anon, authenticated;
grant select on public.individual_settings, public.individual_teams, public.individual_players to anon, authenticated;
grant insert, update, delete on public.individual_players to authenticated;
grant select on public.individual_payments to authenticated;

drop policy if exists "individual_settings_public_read" on public.individual_settings;
create policy "individual_settings_public_read" on public.individual_settings for select to anon, authenticated using (true);

drop policy if exists "individual_teams_public_read" on public.individual_teams;
create policy "individual_teams_public_read" on public.individual_teams for select to anon, authenticated using (true);

drop policy if exists "individual_players_public_read" on public.individual_players;
create policy "individual_players_public_read" on public.individual_players for select to anon, authenticated using (true);

drop policy if exists "individual_players_captain_insert" on public.individual_players;
create policy "individual_players_captain_insert" on public.individual_players for insert to authenticated
with check (exists (select 1 from public.individual_teams t where t.id = individual_team_id and t.captain_id = auth.uid() and t.status <> 'cancelled'));

drop policy if exists "individual_players_captain_update" on public.individual_players;
create policy "individual_players_captain_update" on public.individual_players for update to authenticated
using (exists (select 1 from public.individual_teams t where t.id = individual_team_id and t.captain_id = auth.uid() and t.status <> 'cancelled'))
with check (exists (select 1 from public.individual_teams t where t.id = individual_team_id and t.captain_id = auth.uid() and t.status <> 'cancelled'));

drop policy if exists "individual_players_captain_delete" on public.individual_players;
create policy "individual_players_captain_delete" on public.individual_players for delete to authenticated
using (exists (select 1 from public.individual_teams t where t.id = individual_team_id and t.captain_id = auth.uid() and t.status <> 'cancelled'));

drop policy if exists "individual_payments_owner_or_organizer_read" on public.individual_payments;
create policy "individual_payments_owner_or_organizer_read" on public.individual_payments for select to authenticated
using (exists (select 1 from public.individual_teams t where t.id = individual_team_id and t.captain_id = auth.uid()) or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'organizer'));

create or replace function public.create_individual_team(p_team_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_deposit numeric(10,2); v_team_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_team_name is null or length(trim(p_team_name)) < 2 or length(trim(p_team_name)) > 70 then raise exception 'Team name must be between 2 and 70 characters'; end if;
  select deposit_amount into v_deposit from public.individual_settings where id = 1;
  if v_deposit is null or v_deposit <= 0 then raise exception 'Organizer has not configured the individual deposit'; end if;
  insert into public.individual_teams (captain_id, team_name, deposit_amount, status) values (v_user, trim(p_team_name), v_deposit, 'not_counted') returning id into v_team_id;
  return v_team_id;
end;
$$;
revoke all on function public.create_individual_team(text) from public, anon;
grant execute on function public.create_individual_team(text) to authenticated;

create or replace function public.rename_individual_team(p_team_id uuid, p_team_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_team_name is null or length(trim(p_team_name)) < 2 or length(trim(p_team_name)) > 70 then raise exception 'Team name must be between 2 and 70 characters'; end if;
  update public.individual_teams set team_name = trim(p_team_name)
  where id = p_team_id and captain_id = auth.uid() and status <> 'cancelled';
  if not found then raise exception 'Team not found or you are not its captain'; end if;
end;
$$;
revoke all on function public.rename_individual_team(uuid, text) from public, anon;
grant execute on function public.rename_individual_team(uuid, text) to authenticated;

create or replace function public.delete_individual_team(p_team_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select status into v_status from public.individual_teams where id = p_team_id and captain_id = auth.uid() for update;
  if v_status is null then raise exception 'Team not found or you are not its captain'; end if;
  if v_status <> 'not_counted' then raise exception 'Only unpaid teams can be deleted. Contact the organizer for a paid team cancellation/refund.'; end if;
  delete from public.individual_teams where id = p_team_id and captain_id = auth.uid();
end;
$$;
revoke all on function public.delete_individual_team(uuid) from public, anon;
grant execute on function public.delete_individual_team(uuid) to authenticated;

create or replace function public.update_individual_deposit(p_deposit_amount numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'organizer') then raise exception 'Organizer access required'; end if;
  if p_deposit_amount is null or p_deposit_amount <= 0 then raise exception 'Deposit must be greater than RM0'; end if;
  insert into public.individual_settings (id, deposit_amount, updated_by, updated_at) values (1, p_deposit_amount, auth.uid(), now())
  on conflict (id) do update set deposit_amount = excluded.deposit_amount, updated_by = excluded.updated_by, updated_at = now();
end;
$$;
revoke all on function public.update_individual_deposit(numeric) from public, anon;
grant execute on function public.update_individual_deposit(numeric) to authenticated;

create or replace function public.enforce_individual_player_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  perform 1 from public.individual_teams where id = new.individual_team_id and status <> 'cancelled' for update;
  if not found then raise exception 'Individual team not found or cancelled'; end if;
  select count(*) into v_count from public.individual_players where individual_team_id = new.individual_team_id and id <> new.id;
  if v_count >= 30 then raise exception 'An individual team can have a maximum of 30 players'; end if;
  return new;
end;
$$;
drop trigger if exists enforce_individual_player_limit on public.individual_players;
create trigger enforce_individual_player_limit before insert or update of individual_team_id on public.individual_players for each row execute procedure public.enforce_individual_player_limit();
