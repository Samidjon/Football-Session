-- MOTM: move from captain/team deposit to individual paid session memberships.
-- Run once in Supabase SQL Editor after deploying the updated application.

-- 1) Remove the special Captain account role. Team creator ownership is stored on teams.
-- These policies reference the old enum type. Drop and recreate them after converting role to text.
-- Drop every policy on the affected tables before changing the role column type.
-- Older databases used different names such as "Organizers can create sessions".
-- The old names are not exhaustive; PostgreSQL tracks policy dependencies by column.
do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'profiles', 'sessions', 'teams', 'team_players', 'payments', 'fixtures', 'individual_payments'
      ])
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

drop policy if exists "profiles_select_own_or_organizer" on public.profiles;
drop policy if exists "sessions_insert_organizer" on public.sessions;
drop policy if exists "sessions_update_organizer" on public.sessions;
drop policy if exists "sessions_delete_organizer" on public.sessions;
drop policy if exists "teams_delete_captain_or_organizer" on public.teams;
drop policy if exists "teams_delete_creator_or_organizer" on public.teams;
drop policy if exists "payments_select_owner_or_organizer" on public.payments;
drop policy if exists "payments_update_organizer" on public.payments;
drop policy if exists "fixtures_insert_organizer" on public.fixtures;
drop policy if exists "fixtures_update_organizer" on public.fixtures;
drop policy if exists "fixtures_delete_organizer" on public.fixtures;
drop policy if exists "individual_payments_owner_or_organizer_read" on public.individual_payments;

alter table public.profiles alter column role drop default;
alter table public.profiles alter column role type text using role::text;
update public.profiles set role = 'user' where role = 'captain';
update public.profiles set role = 'user' where role is null or role not in ('user', 'organizer');
alter table public.profiles alter column role set default 'user';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_role_allowed') then
    alter table public.profiles add constraint profiles_role_allowed check (role in ('user', 'organizer'));
  end if;
end $$;

-- Prevent users from escalating themselves to organizer through profile updates.
revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- The old column was named captain_id, but it now means the ordinary user who created the team.
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='teams' and column_name='captain_id')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='teams' and column_name='created_by') then
    alter table public.teams rename column captain_id to created_by;
  end if;
end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'phone',
    'user'
  ) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();



create policy "profiles_select_own_or_organizer" on public.profiles for select to authenticated
using (id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='organizer'));

create policy "sessions_insert_organizer" on public.sessions for insert to authenticated
with check (created_by=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='organizer'));
create policy "sessions_update_organizer" on public.sessions for update to authenticated
using (created_by=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='organizer'))
with check (created_by=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='organizer'));
create policy "sessions_delete_organizer" on public.sessions for delete to authenticated
using (created_by=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='organizer'));

create policy "payments_select_owner_or_organizer" on public.payments for select to authenticated
using (exists(select 1 from public.teams t where t.id=payments.team_id and t.created_by=auth.uid()) or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='organizer'));
create policy "payments_update_organizer" on public.payments for update to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='organizer'))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='organizer'));

create policy "fixtures_insert_organizer" on public.fixtures for insert to authenticated
with check (exists(select 1 from public.sessions s where s.id=fixtures.session_id and s.created_by=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='organizer')));
create policy "fixtures_update_organizer" on public.fixtures for update to authenticated
using (exists(select 1 from public.sessions s where s.id=fixtures.session_id and s.created_by=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='organizer')))
with check (exists(select 1 from public.sessions s where s.id=fixtures.session_id and s.created_by=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='organizer')));
create policy "fixtures_delete_organizer" on public.fixtures for delete to authenticated
using (exists(select 1 from public.sessions s where s.id=fixtures.session_id and s.created_by=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='organizer')));

create policy "individual_payments_owner_or_organizer_read" on public.individual_payments for select to authenticated
using (exists(select 1 from public.individual_teams t where t.id=individual_team_id and t.captain_id=auth.uid()) or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='organizer'));

drop policy if exists "sessions_select_anon" on public.sessions;
create policy "sessions_select_anon" on public.sessions for select to anon using (status in ('open','full'));

-- 2) Store every participant's own reservation and payment, separate from old team-level payments.
create table if not exists public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  player_name text not null,
  status text not null default 'pending_payment' check (status in ('pending_payment', 'paid', 'cancelled')),
  payment_intent_id text unique,
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);
create index if not exists team_memberships_team_status_idx on public.team_memberships(team_id, status);
create index if not exists team_memberships_user_idx on public.team_memberships(user_id, status);

create table if not exists public.team_member_payments (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null unique references public.team_memberships(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  status public.payment_status not null default 'pending',
  payment_reference text not null unique,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.team_memberships enable row level security;
alter table public.team_member_payments enable row level security;
revoke all on public.team_memberships from anon, authenticated;
grant select (id, team_id, player_name, status, paid_at, created_at) on public.team_memberships to anon;
grant select (id, team_id, user_id, player_name, status, paid_at, created_at) on public.team_memberships to authenticated;
revoke insert, update, delete on public.team_member_payments from anon, authenticated;
grant select on public.team_member_payments to authenticated;

drop policy if exists "team_memberships_public_paid_read" on public.team_memberships;
create policy "team_memberships_public_paid_read" on public.team_memberships for select to anon using (status='paid');
drop policy if exists "team_memberships_user_or_organizer_read" on public.team_memberships;
create policy "team_memberships_user_or_organizer_read" on public.team_memberships for select to authenticated
using (status='paid' or user_id=auth.uid() or exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='organizer'));
drop policy if exists "team_member_payments_owner_or_organizer_read" on public.team_member_payments;
create policy "team_member_payments_owner_or_organizer_read" on public.team_member_payments for select to authenticated
using (user_id=auth.uid() or exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='organizer'));

-- Users cannot add arbitrary name-only players to a session anymore.
revoke insert, update, delete on public.team_players from anon, authenticated;

-- Session slots are only counted after at least one participant has paid.
create or replace function public.refresh_session_status()
returns trigger language plpgsql as $$
declare v_session_id uuid; v_max integer; v_count integer;
begin
  v_session_id := coalesce(new.session_id, old.session_id);
  select max_teams into v_max from public.sessions where id=v_session_id;
  select count(*) into v_count from public.teams where session_id=v_session_id and registration_status='confirmed';
  update public.sessions set status = case when v_count >= v_max then 'full'::public.session_status else 'open'::public.session_status end
    where id=v_session_id and status in ('open','full');
  return coalesce(new, old);
end;
$$;

drop trigger if exists refresh_session_status_trigger on public.teams;
create trigger refresh_session_status_trigger after insert or update or delete on public.teams
for each row execute procedure public.refresh_session_status();

update public.sessions s
set status = case
  when (select count(*) from public.teams t where t.session_id=s.id and t.registration_status='confirmed') >= s.max_teams then 'full'::public.session_status
  else 'open'::public.session_status
end
where s.status in ('open','full');

-- Register one public team. It becomes a counted team only after its first member pays.
create or replace function public.register_team(p_session_id uuid, p_team_name text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_user uuid := auth.uid(); v_team_id uuid; v_max_teams integer; v_confirmed integer; v_reserved_teams integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_team_name is null or length(trim(p_team_name)) < 2 or length(trim(p_team_name)) > 70 then raise exception 'Team name must be between 2 and 70 characters'; end if;

  select max_teams into v_max_teams from public.sessions where id=p_session_id and status in ('open','full') for update;
  if v_max_teams is null then raise exception 'Session not found or registration is closed'; end if;
  select count(*) into v_confirmed from public.teams where session_id=p_session_id and registration_status='confirmed';
  select count(distinct t.id) into v_reserved_teams from public.teams t
    where t.session_id=p_session_id and t.registration_status not in ('confirmed','cancelled')
      and exists (select 1 from public.team_memberships m where m.team_id=t.id and m.status='pending_payment' and m.expires_at>now());
  if v_confirmed + v_reserved_teams >= v_max_teams then raise exception 'All team slots are full or reserved for checkout'; end if;
  if exists (select 1 from public.teams where session_id=p_session_id and created_by=v_user and registration_status <> 'cancelled') then
    raise exception 'You have already created a team for this session';
  end if;
  if exists (
    select 1 from public.team_memberships m join public.teams joined_team on joined_team.id=m.team_id
    where joined_team.session_id=p_session_id and m.user_id=v_user
      and (m.status='paid' or (m.status='pending_payment' and m.expires_at>now()))
  ) then
    raise exception 'You already reserved a place in a team for this session';
  end if;

  insert into public.teams(session_id, created_by, team_name, registration_status)
  values(p_session_id, v_user, trim(p_team_name), 'pending_payment') returning id into v_team_id;
  return v_team_id;
end;
$$;
revoke all on function public.register_team(uuid, text) from public, anon;
grant execute on function public.register_team(uuid, text) to authenticated;

-- Reserve a place under a team, with a 20-minute expiry for abandoned checkout.
create or replace function public.reserve_team_membership(p_team_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_user uuid := auth.uid(); v_membership_id uuid; v_membership_status text; v_expires_at timestamptz;
  v_name text; v_limit integer; v_max_teams integer; v_session_status public.session_status;
  v_team_status public.registration_status; v_session_id uuid; v_confirmed_teams integer; v_reserved_teams integer; v_team_has_reservation boolean; v_places integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select t.session_id, s.players_per_team, s.max_teams, s.status, t.registration_status
    into v_session_id, v_limit, v_max_teams, v_session_status, v_team_status
  from public.teams t join public.sessions s on s.id=t.session_id
  where t.id=p_team_id and t.registration_status <> 'cancelled'
  for update of s, t;
  if v_limit is null then raise exception 'Team not found or cancelled'; end if;
  if v_session_status not in ('open','full') then raise exception 'This session is not accepting registrations'; end if;

  select id, status, expires_at into v_membership_id, v_membership_status, v_expires_at
  from public.team_memberships where team_id=p_team_id and user_id=v_user for update;
  if v_membership_status='paid' then raise exception 'You have already paid to join this team'; end if;
  if exists (
    select 1 from public.team_memberships other_membership join public.teams other_team on other_team.id=other_membership.team_id
    where other_team.session_id=v_session_id and other_team.id<>p_team_id and other_membership.user_id=v_user
      and (other_membership.status='paid' or (other_membership.status='pending_payment' and other_membership.expires_at>now()))
  ) then raise exception 'You already have a paid or pending place in another team for this session'; end if;
  if v_membership_status='pending_payment' and v_expires_at > now() then return v_membership_id; end if;

  select count(*) into v_confirmed_teams from public.teams where session_id=v_session_id and registration_status='confirmed';
  select count(distinct t.id) into v_reserved_teams
    from public.teams t
    where t.session_id=v_session_id and t.registration_status not in ('confirmed','cancelled')
      and exists (select 1 from public.team_memberships m where m.team_id=t.id and m.status='pending_payment' and m.expires_at>now());
  select exists (select 1 from public.team_memberships m where m.team_id=p_team_id and m.status='pending_payment' and m.expires_at>now()) into v_team_has_reservation;
  if v_team_status <> 'confirmed' and not v_team_has_reservation and v_confirmed_teams + v_reserved_teams >= v_max_teams then
    raise exception 'All team slots are already counted or reserved for checkout';
  end if;
  select count(*) into v_places from public.team_memberships where team_id=p_team_id and (status='paid' or (status='pending_payment' and expires_at > now()));
  if v_places >= v_limit then raise exception 'This team is full'; end if;

  select coalesce(nullif(trim(full_name),''),'MOTM Member') into v_name from public.profiles where id=v_user;
  if v_name is null then raise exception 'Profile not found'; end if;
  if v_membership_id is not null then
    update public.team_memberships set status='pending_payment', player_name=v_name, payment_intent_id=null, expires_at=now()+interval '20 minutes', paid_at=null where id=v_membership_id;
  else
    insert into public.team_memberships(team_id,user_id,player_name,status,expires_at)
    values(p_team_id,v_user,v_name,'pending_payment',now()+interval '20 minutes') returning id into v_membership_id;
  end if;
  return v_membership_id;
end;
$$;
revoke all on function public.reserve_team_membership(uuid) from public, anon;
grant execute on function public.reserve_team_membership(uuid) to authenticated;

-- Team creators may delete a team only before the first successful payment. Organizers retain control.
drop policy if exists "teams_delete_captain_or_organizer" on public.teams;
drop policy if exists "teams_delete_creator_or_organizer" on public.teams;
create policy "teams_delete_creator_or_organizer" on public.teams for delete to authenticated
using ((created_by=auth.uid() and registration_status='pending_payment') or exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='organizer'));


create or replace function public.delete_team(p_team_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_user uuid := auth.uid(); v_status public.registration_status;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select registration_status into v_status from public.teams where id=p_team_id and created_by=v_user;
  if v_status is null then raise exception 'Team not found or you are not its creator'; end if;
  if v_status <> 'pending_payment' then raise exception 'A team with paid members cannot be deleted. Contact the organizer for cancellation/refund.'; end if;
  delete from public.teams where id=p_team_id and created_by=v_user;
end;
$$;
revoke all on function public.delete_team(uuid) from public, anon;
grant execute on function public.delete_team(uuid) to authenticated;

revoke insert, update, delete on public.payments from anon, authenticated;
