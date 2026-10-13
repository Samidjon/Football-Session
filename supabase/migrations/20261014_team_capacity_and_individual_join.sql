-- MOTM: per-team capacity, public Individual teams with per-person payment,
-- and an idempotent fix for organizer session permissions.
-- Apply after 20261013_individual_session_payments.sql.

begin;

-- Define this helper before any policy references it. SECURITY DEFINER avoids recursive profile RLS checks.
create or replace function public.is_organizer()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role::text = 'organizer'
  );
$$;
revoke all on function public.is_organizer() from public, anon;
grant execute on function public.is_organizer() to authenticated;

-- 1) Team capacity can be chosen by the team creator up to the session maximum.
alter table public.teams add column if not exists player_limit integer;
update public.teams t
set player_limit = coalesce(s.players_per_team, 12)
from public.sessions s
where s.id = t.session_id and (t.player_limit is null or t.player_limit < 1);
alter table public.teams alter column player_limit set default 12;
alter table public.teams alter column player_limit set not null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'teams_player_limit_positive') then
    alter table public.teams add constraint teams_player_limit_positive check (player_limit > 0);
  end if;
end $$;

drop function if exists public.register_team(uuid, text);
drop function if exists public.register_team(uuid, text, integer);
create function public.register_team(p_session_id uuid, p_team_name text, p_player_limit integer)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_team_id uuid;
  v_session_player_limit integer;
  v_max_teams integer;
  v_confirmed integer;
  v_reserved integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_team_name is null or length(trim(p_team_name)) < 2 or length(trim(p_team_name)) > 70 then
    raise exception 'Team name must be between 2 and 70 characters';
  end if;

  select players_per_team, max_teams
  into v_session_player_limit, v_max_teams
  from public.sessions
  where id = p_session_id and status in ('open', 'full')
  for update;
  if v_max_teams is null then raise exception 'Session not found or registration is closed'; end if;
  if p_player_limit is null or p_player_limit < 1 or p_player_limit > v_session_player_limit then
    raise exception 'Choose a team size between 1 and % players', v_session_player_limit;
  end if;

  select count(*) into v_confirmed from public.teams
  where session_id = p_session_id and registration_status = 'confirmed';
  select count(distinct t.id) into v_reserved
  from public.teams t
  where t.session_id = p_session_id and t.registration_status not in ('confirmed', 'cancelled')
    and exists (select 1 from public.team_memberships m where m.team_id = t.id and m.status = 'pending_payment' and m.expires_at > now());
  if v_confirmed + v_reserved >= v_max_teams then raise exception 'All team slots are full or reserved during checkout'; end if;

  if exists (select 1 from public.teams where session_id = p_session_id and created_by = v_user and registration_status <> 'cancelled') then
    raise exception 'You have already created a team for this session';
  end if;
  if exists (
    select 1 from public.team_memberships m join public.teams t on t.id = m.team_id
    where t.session_id = p_session_id and m.user_id = v_user
      and (m.status = 'paid' or (m.status = 'pending_payment' and m.expires_at > now()))
  ) then
    raise exception 'You already have a paid or pending place in this session';
  end if;

  insert into public.teams (session_id, created_by, team_name, player_limit, registration_status)
  values (p_session_id, v_user, trim(p_team_name), p_player_limit, 'pending_payment')
  returning id into v_team_id;
  return v_team_id;
end;
$$;
revoke all on function public.register_team(uuid, text, integer) from public, anon;
grant execute on function public.register_team(uuid, text, integer) to authenticated;

-- Recreate the reservation function to use the selected team capacity, not the session-wide maximum.
create or replace function public.reserve_team_membership(p_team_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_membership_id uuid;
  v_membership_status text;
  v_expires_at timestamptz;
  v_name text;
  v_limit integer;
  v_max_teams integer;
  v_session_status public.session_status;
  v_team_status public.registration_status;
  v_session_id uuid;
  v_confirmed_teams integer;
  v_reserved_teams integer;
  v_places integer;
  v_team_has_reservation boolean;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select t.session_id, t.player_limit, s.max_teams, s.status, t.registration_status
    into v_session_id, v_limit, v_max_teams, v_session_status, v_team_status
  from public.teams t join public.sessions s on s.id = t.session_id
  where t.id = p_team_id and t.registration_status <> 'cancelled'
  for update of s, t;
  if v_limit is null then raise exception 'Team not found or cancelled'; end if;
  if v_session_status not in ('open', 'full') then raise exception 'This session is not accepting registrations'; end if;

  select id, status, expires_at into v_membership_id, v_membership_status, v_expires_at
  from public.team_memberships where team_id = p_team_id and user_id = v_user for update;
  if v_membership_status = 'paid' then raise exception 'You have already paid to join this team'; end if;
  if exists (
    select 1 from public.team_memberships m join public.teams other_team on other_team.id = m.team_id
    where other_team.session_id = v_session_id and other_team.id <> p_team_id and m.user_id = v_user
      and (m.status = 'paid' or (m.status = 'pending_payment' and m.expires_at > now()))
  ) then raise exception 'You already have a paid or pending place in another team for this session'; end if;
  if v_membership_status = 'pending_payment' and v_expires_at > now() then return v_membership_id; end if;

  select count(*) into v_confirmed_teams from public.teams
  where session_id = v_session_id and registration_status = 'confirmed';
  select count(distinct t.id) into v_reserved_teams from public.teams t
  where t.session_id = v_session_id and t.registration_status not in ('confirmed', 'cancelled')
    and exists (select 1 from public.team_memberships m where m.team_id = t.id and m.status = 'pending_payment' and m.expires_at > now());
  select exists (select 1 from public.team_memberships m where m.team_id = p_team_id and m.status = 'pending_payment' and m.expires_at > now()) into v_team_has_reservation;
  if v_team_status <> 'confirmed' and not v_team_has_reservation and v_confirmed_teams + v_reserved_teams >= v_max_teams then
    raise exception 'All team slots are already counted or reserved for checkout';
  end if;
  select count(*) into v_places from public.team_memberships
  where team_id = p_team_id and (status = 'paid' or (status = 'pending_payment' and expires_at > now()));
  if v_places >= v_limit then raise exception 'This team is full'; end if;

  select coalesce(nullif(trim(full_name), ''), 'MOTM Member') into v_name from public.profiles where id = v_user;
  if v_name is null then raise exception 'Profile not found'; end if;
  if v_membership_id is not null then
    update public.team_memberships set status = 'pending_payment', player_name = v_name, payment_intent_id = null,
      expires_at = now() + interval '20 minutes', paid_at = null where id = v_membership_id;
  else
    insert into public.team_memberships (team_id, user_id, player_name, status, expires_at)
    values (p_team_id, v_user, v_name, 'pending_payment', now() + interval '20 minutes') returning id into v_membership_id;
  end if;
  return v_membership_id;
end;
$$;
revoke all on function public.reserve_team_membership(uuid) from public, anon;
grant execute on function public.reserve_team_membership(uuid) to authenticated;

-- 2) Individuals follows the same model: create a team for free, each member joins and pays individually.
alter table public.individual_teams add column if not exists player_limit integer;
update public.individual_teams set player_limit = 30 where player_limit is null or player_limit < 1;
alter table public.individual_teams alter column player_limit set default 30;
alter table public.individual_teams alter column player_limit set not null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'individual_teams_player_limit_valid') then
    alter table public.individual_teams add constraint individual_teams_player_limit_valid check (player_limit between 1 and 30);
  end if;
end $$;

create table if not exists public.individual_team_memberships (
  id uuid primary key default gen_random_uuid(),
  individual_team_id uuid not null references public.individual_teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  player_name text not null,
  status text not null default 'pending_payment' check (status in ('pending_payment', 'paid', 'cancelled')),
  payment_intent_id text unique,
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (individual_team_id, user_id)
);
create index if not exists individual_team_memberships_team_status_idx on public.individual_team_memberships(individual_team_id, status);
create index if not exists individual_team_memberships_user_idx on public.individual_team_memberships(user_id, status);

create table if not exists public.individual_team_member_payments (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null unique references public.individual_team_memberships(id) on delete cascade,
  individual_team_id uuid not null references public.individual_teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  status public.payment_status not null default 'pending',
  payment_reference text not null unique,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.individual_team_memberships enable row level security;
alter table public.individual_team_member_payments enable row level security;
revoke all on public.individual_team_memberships from anon, authenticated;
grant select (id, individual_team_id, player_name, status, paid_at, created_at) on public.individual_team_memberships to anon;
grant select (id, individual_team_id, user_id, player_name, status, expires_at, paid_at, created_at) on public.individual_team_memberships to authenticated;
revoke all on public.individual_team_member_payments from anon, authenticated;
grant select on public.individual_team_member_payments to authenticated;

drop policy if exists individual_team_memberships_public_paid_read on public.individual_team_memberships;
create policy individual_team_memberships_public_paid_read on public.individual_team_memberships for select to anon using (status = 'paid');
drop policy if exists individual_team_memberships_user_or_organizer_read on public.individual_team_memberships;
create policy individual_team_memberships_user_or_organizer_read on public.individual_team_memberships for select to authenticated
using (status = 'paid' or user_id = auth.uid() or public.is_organizer());
drop policy if exists individual_team_member_payments_owner_or_organizer_read on public.individual_team_member_payments;
create policy individual_team_member_payments_owner_or_organizer_read on public.individual_team_member_payments for select to authenticated
using (user_id = auth.uid() or public.is_organizer());

-- Recreate the individual-team creation RPC with an explicit capacity; it never charges the creator.
drop function if exists public.create_individual_team(text);
drop function if exists public.create_individual_team(text, integer);
create function public.create_individual_team(p_team_name text, p_player_limit integer)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid := auth.uid(); v_fee numeric(10,2); v_team_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_team_name is null or length(trim(p_team_name)) < 2 or length(trim(p_team_name)) > 70 then raise exception 'Team name must be between 2 and 70 characters'; end if;
  if p_player_limit is null or p_player_limit < 1 or p_player_limit > 30 then raise exception 'Team capacity must be between 1 and 30 participants'; end if;
  select deposit_amount into v_fee from public.individual_settings where id = 1;
  if v_fee is null or v_fee <= 0 then raise exception 'Organizer has not configured the per-person fee'; end if;
  insert into public.individual_teams(captain_id, team_name, deposit_amount, player_limit, status)
  values (v_user, trim(p_team_name), v_fee, p_player_limit, 'not_counted') returning id into v_team_id;
  return v_team_id;
end;
$$;
revoke all on function public.create_individual_team(text, integer) from public, anon;
grant execute on function public.create_individual_team(text, integer) to authenticated;

create or replace function public.reserve_individual_team_membership(p_team_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user uuid := auth.uid(); v_membership_id uuid; v_membership_status text; v_expires timestamptz;
  v_limit integer; v_team_status text; v_name text; v_places integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select player_limit, status into v_limit, v_team_status
  from public.individual_teams where id = p_team_id for update;
  if v_limit is null or v_team_status = 'cancelled' then raise exception 'Team not found or cancelled'; end if;

  select id, status, expires_at into v_membership_id, v_membership_status, v_expires
  from public.individual_team_memberships where individual_team_id = p_team_id and user_id = v_user for update;
  if v_membership_status = 'paid' then raise exception 'You have already joined this team'; end if;
  if v_membership_status = 'pending_payment' and v_expires > now() then return v_membership_id; end if;

  select count(*) into v_places from public.individual_team_memberships
  where individual_team_id = p_team_id
    and (status = 'paid' or (status = 'pending_payment' and expires_at > now()));
  if v_places >= v_limit then raise exception 'This team is full'; end if;

  select coalesce(nullif(trim(full_name), ''), 'MOTM Member') into v_name from public.profiles where id = v_user;
  if v_name is null then raise exception 'Profile not found'; end if;
  if v_membership_id is null then
    insert into public.individual_team_memberships(individual_team_id, user_id, player_name, status, expires_at)
    values (p_team_id, v_user, v_name, 'pending_payment', now() + interval '20 minutes') returning id into v_membership_id;
  else
    update public.individual_team_memberships set player_name = v_name, status = 'pending_payment', payment_intent_id = null,
      expires_at = now() + interval '20 minutes', paid_at = null where id = v_membership_id;
  end if;
  return v_membership_id;
end;
$$;
revoke all on function public.reserve_individual_team_membership(uuid) from public, anon;
grant execute on function public.reserve_individual_team_membership(uuid) to authenticated;

create or replace function public.update_individual_team_details(p_team_id uuid, p_team_name text, p_player_limit integer)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_team_name is null or length(trim(p_team_name)) < 2 or length(trim(p_team_name)) > 70 then raise exception 'Team name must be between 2 and 70 characters'; end if;
  if p_player_limit is null or p_player_limit < 1 or p_player_limit > 30 then raise exception 'Team capacity must be between 1 and 30'; end if;
  perform 1 from public.individual_teams where id = p_team_id and captain_id = auth.uid() and status <> 'cancelled' for update;
  if not found then raise exception 'Team not found or you are not its creator'; end if;
  select count(*) into v_count from public.individual_team_memberships
  where individual_team_id = p_team_id and (status = 'paid' or (status = 'pending_payment' and expires_at > now()));
  if p_player_limit < v_count then raise exception 'Capacity cannot be lower than the number of paid/reserved places'; end if;
  update public.individual_teams set team_name = trim(p_team_name), player_limit = p_player_limit
  where id = p_team_id and captain_id = auth.uid();
end;
$$;
revoke all on function public.update_individual_team_details(uuid, text, integer) from public, anon;
grant execute on function public.update_individual_team_details(uuid, text, integer) to authenticated;

create or replace function public.sync_individual_team_status()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_team_id uuid;
begin
  v_team_id := new.individual_team_id;
  update public.individual_teams t
  set status = case
    when exists (select 1 from public.individual_team_memberships m where m.individual_team_id = v_team_id and m.status = 'paid')
      or exists (select 1 from public.individual_payments p where p.individual_team_id = v_team_id and p.status = 'paid')
      then 'counted'
    else 'not_counted'
  end
  where t.id = v_team_id and t.status <> 'cancelled';
  return new;
end;
$$;
drop trigger if exists individual_team_membership_sync_status on public.individual_team_memberships;
create trigger individual_team_membership_sync_status after insert or update on public.individual_team_memberships
for each row execute procedure public.sync_individual_team_status();

create or replace function public.delete_individual_team(p_team_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_team_status text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select status into v_team_status from public.individual_teams where id = p_team_id and captain_id = auth.uid() for update;
  if v_team_status is null then raise exception 'Team not found or you are not its creator'; end if;
  if exists (select 1 from public.individual_team_memberships where individual_team_id = p_team_id and status = 'paid')
     or exists (select 1 from public.individual_payments where individual_team_id = p_team_id and status = 'paid') then
    raise exception 'A team with paid members cannot be deleted. Contact the organizer for cancellation/refund.';
  end if;
  if exists (select 1 from public.individual_team_memberships where individual_team_id = p_team_id and status = 'pending_payment' and expires_at > now()) then
    raise exception 'A participant is currently checking out. Wait for the reservation to expire before deleting this team.';
  end if;
  delete from public.individual_teams where id = p_team_id and captain_id = auth.uid();
end;
$$;
revoke all on function public.delete_individual_team(uuid) from public, anon;
grant execute on function public.delete_individual_team(uuid) to authenticated;

-- 3) Restore organizer session creation and editing even if the database had old policy names.
create or replace function public.is_organizer()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role::text = 'organizer');
$$;
revoke all on function public.is_organizer() from public, anon;
grant execute on function public.is_organizer() to authenticated;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'sessions'
  loop execute format('drop policy if exists %I on public.sessions', p.policyname); end loop;
end $$;
create policy sessions_select_authenticated on public.sessions for select to authenticated using (true);
create policy sessions_select_anon on public.sessions for select to anon using (status in ('open', 'full'));
create policy sessions_insert_organizer on public.sessions for insert to authenticated
with check (created_by = auth.uid() and public.is_organizer());
create policy sessions_update_organizer on public.sessions for update to authenticated
using (created_by = auth.uid() and public.is_organizer())
with check (created_by = auth.uid() and public.is_organizer());
create policy sessions_delete_organizer on public.sessions for delete to authenticated
using (created_by = auth.uid() and public.is_organizer());
grant select on public.sessions to anon, authenticated;
grant insert, update, delete on public.sessions to authenticated;

commit;
