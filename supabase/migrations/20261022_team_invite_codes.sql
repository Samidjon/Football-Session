-- MOTM: private, captain-managed invite codes for session teams.
-- Apply this migration in Supabase SQL Editor before deploying the matching app changes.

begin;

create table if not exists public.team_invite_codes (
  team_id uuid primary key references public.teams(id) on delete cascade,
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9-]{4,12}$'),
  created_at timestamptz not null default now()
);

alter table public.team_invite_codes enable row level security;
revoke all on public.team_invite_codes from public, anon, authenticated;

-- Give existing teams a code so their captains can continue using/editing them.
insert into public.team_invite_codes (team_id, invite_code)
select t.id, upper(substr(md5(t.id::text), 1, 10))
from public.teams t
where not exists (
  select 1 from public.team_invite_codes c where c.team_id = t.id
)
on conflict do nothing;

drop function if exists public.register_team(uuid, text, integer);
drop function if exists public.register_team(uuid, text, integer, text);

create function public.register_team(
  p_session_id uuid,
  p_team_name text,
  p_player_limit integer,
  p_invite_code text
)
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
  v_invite_code text := upper(trim(coalesce(p_invite_code, '')));
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_team_name is null or length(trim(p_team_name)) < 2 or length(trim(p_team_name)) > 70 then
    raise exception 'Team name must be between 2 and 70 characters';
  end if;
  if v_invite_code !~ '^[A-Z0-9-]{4,12}$' then
    raise exception 'Join code must be 4–12 characters using letters, numbers, or hyphens';
  end if;
  if exists (select 1 from public.team_invite_codes where invite_code = v_invite_code) then
    raise exception 'This join code is already in use. Choose another code.';
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
    and exists (
      select 1 from public.team_memberships m
      where m.team_id = t.id and m.status = 'pending_payment' and m.expires_at > now()
    );
  if v_confirmed + v_reserved >= v_max_teams then
    raise exception 'All team slots are full or reserved during checkout';
  end if;

  if exists (
    select 1 from public.teams
    where session_id = p_session_id and created_by = v_user and registration_status <> 'cancelled'
  ) then
    raise exception 'You have already created a team for this session';
  end if;
  if exists (
    select 1 from public.team_memberships m
    join public.teams t on t.id = m.team_id
    where t.session_id = p_session_id and m.user_id = v_user
      and (m.status = 'paid' or (m.status = 'pending_payment' and m.expires_at > now()))
  ) then
    raise exception 'You already have a paid or pending place in this session';
  end if;

  insert into public.teams (session_id, created_by, team_name, player_limit, registration_status)
  values (p_session_id, v_user, trim(p_team_name), p_player_limit, 'pending_payment')
  returning id into v_team_id;

  insert into public.team_invite_codes (team_id, invite_code)
  values (v_team_id, v_invite_code);

  return v_team_id;
end;
$$;
revoke all on function public.register_team(uuid, text, integer, text) from public, anon;
grant execute on function public.register_team(uuid, text, integer, text) to authenticated;

create or replace function public.find_team_by_invite_code(p_invite_code text)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select t.id
  from public.team_invite_codes c
  join public.teams t on t.id = c.team_id
  where c.invite_code = upper(trim(coalesce(p_invite_code, '')))
    and t.registration_status <> 'cancelled'
  limit 1;
$$;
revoke all on function public.find_team_by_invite_code(text) from public;
grant execute on function public.find_team_by_invite_code(text) to anon, authenticated;

create or replace function public.get_team_invite_code(p_team_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select c.invite_code into v_code
  from public.team_invite_codes c
  join public.teams t on t.id = c.team_id
  where c.team_id = p_team_id and t.created_by = auth.uid();
  if v_code is null then raise exception 'Only the team captain can view this code'; end if;
  return v_code;
end;
$$;
revoke all on function public.get_team_invite_code(uuid) from public, anon;
grant execute on function public.get_team_invite_code(uuid) to authenticated;

create or replace function public.update_session_team_details(
  p_team_id uuid,
  p_team_name text,
  p_invite_code text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invite_code text := upper(trim(coalesce(p_invite_code, '')));
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_team_name is null or length(trim(p_team_name)) < 2 or length(trim(p_team_name)) > 70 then
    raise exception 'Team name must be between 2 and 70 characters';
  end if;
  if v_invite_code !~ '^[A-Z0-9-]{4,12}$' then
    raise exception 'Join code must be 4–12 characters using letters, numbers, or hyphens';
  end if;

  perform 1 from public.teams
  where id = p_team_id and created_by = auth.uid() and registration_status <> 'cancelled'
  for update;
  if not found then raise exception 'Team not found or you are not its captain'; end if;

  if exists (
    select 1 from public.team_invite_codes
    where invite_code = v_invite_code and team_id <> p_team_id
  ) then
    raise exception 'This join code is already in use. Choose another code.';
  end if;

  update public.teams set team_name = trim(p_team_name) where id = p_team_id;
  insert into public.team_invite_codes (team_id, invite_code)
  values (p_team_id, v_invite_code)
  on conflict (team_id) do update set invite_code = excluded.invite_code;
end;
$$;
revoke all on function public.update_session_team_details(uuid, text, text) from public, anon;
grant execute on function public.update_session_team_details(uuid, text, text) to authenticated;

commit;
