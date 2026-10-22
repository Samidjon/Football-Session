-- MOTM: distinguish Teams-hub teams from teams created inside a session,
-- and enforce a valid invite code before reserving a paid place.
-- Apply after 20261022_team_invite_codes.sql.

begin;

alter table public.teams
  add column if not exists creation_source text not null default 'session';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'teams_creation_source_valid'
      and conrelid = 'public.teams'::regclass
  ) then
    alter table public.teams
      add constraint teams_creation_source_valid
      check (creation_source in ('session', 'teams'));
  end if;
end $$;

-- Keep the invite-code table private even if this migration is applied before
-- another environment has created it.
create table if not exists public.team_invite_codes (
  team_id uuid primary key references public.teams(id) on delete cascade,
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9-]{4,12}$'),
  created_at timestamptz not null default now()
);
alter table public.team_invite_codes enable row level security;
revoke all on public.team_invite_codes from public, anon, authenticated;

insert into public.team_invite_codes (team_id, invite_code)
select t.id, upper(substr(md5(t.id::text), 1, 10))
from public.teams t
where not exists (
  select 1 from public.team_invite_codes c where c.team_id = t.id
)
on conflict do nothing;

-- Existing form calls may omit p_creation_source and are treated as session-created.
drop function if exists public.register_team(uuid, text, integer, text);
drop function if exists public.register_team(uuid, text, integer);
create function public.register_team(
  p_session_id uuid,
  p_team_name text,
  p_player_limit integer,
  p_invite_code text,
  p_creation_source text default 'session'
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
  v_creation_source text := lower(trim(coalesce(p_creation_source, 'session')));
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_team_name is null or length(trim(p_team_name)) < 2 or length(trim(p_team_name)) > 70 then
    raise exception 'Team name must be between 2 and 70 characters';
  end if;
  if v_invite_code !~ '^[A-Z0-9-]{4,12}$' then
    raise exception 'Join code must be 4–12 characters using letters, numbers, or hyphens';
  end if;
  if v_creation_source not in ('session', 'teams') then
    raise exception 'Invalid team creation source';
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

  insert into public.teams (
    session_id, created_by, team_name, player_limit, registration_status, creation_source
  )
  values (
    p_session_id, v_user, trim(p_team_name), p_player_limit, 'pending_payment', v_creation_source
  )
  returning id into v_team_id;

  insert into public.team_invite_codes (team_id, invite_code)
  values (v_team_id, v_invite_code);

  return v_team_id;
end;
$$;
revoke all on function public.register_team(uuid, text, integer, text, text) from public, anon;
grant execute on function public.register_team(uuid, text, integer, text, text) to authenticated;

create or replace function public.verify_team_invite_code(p_team_id uuid, p_invite_code text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.team_invite_codes c
    join public.teams t on t.id = c.team_id
    where t.id = p_team_id
      and t.registration_status <> 'cancelled'
      and c.invite_code = upper(trim(coalesce(p_invite_code, '')))
  );
$$;
revoke all on function public.verify_team_invite_code(uuid, text) from public, anon;
grant execute on function public.verify_team_invite_code(uuid, text) to authenticated;

-- Reserve a place only when the caller knows the code belonging to this exact team.
create or replace function public.reserve_team_membership_with_code(p_team_id uuid, p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.verify_team_invite_code(p_team_id, p_invite_code) then
    raise exception 'Incorrect team code. Ask the captain for the correct code.';
  end if;
  return public.reserve_team_membership(p_team_id);
end;
$$;
revoke all on function public.reserve_team_membership_with_code(uuid, text) from public, anon;
grant execute on function public.reserve_team_membership_with_code(uuid, text) to authenticated;

-- Clients must not use the old no-code reservation function directly.
revoke all on function public.reserve_team_membership(uuid) from public, anon, authenticated;

commit;
