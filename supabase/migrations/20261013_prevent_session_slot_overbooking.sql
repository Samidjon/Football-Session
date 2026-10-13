-- Reserve a counted session slot while one or more participants are completing checkout.
-- Run once in Supabase SQL Editor on an existing installation.

create or replace function public.register_team(p_session_id uuid, p_team_name text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_user uuid := auth.uid(); v_team_id uuid; v_max_teams integer; v_confirmed integer; v_reserved_teams integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_team_name is null or length(trim(p_team_name)) < 2 or length(trim(p_team_name)) > 70 then raise exception 'Team name must be between 2 and 70 characters'; end if;
  select max_teams into v_max_teams from public.sessions where id=p_session_id and status='open' for update;
  if v_max_teams is null then raise exception 'Session not found or registration is closed'; end if;
  if exists (select 1 from public.teams where session_id=p_session_id and created_by=v_user and registration_status <> 'cancelled') then
    raise exception 'You have already created a team for this session';
  end if;
  if exists (
    select 1 from public.team_memberships m join public.teams joined_team on joined_team.id=m.team_id
    where joined_team.session_id=p_session_id and m.user_id=v_user
      and (m.status='paid' or (m.status='pending_payment' and m.expires_at>now()))
  ) then raise exception 'You already reserved a place in a team for this session'; end if;
  select count(*) into v_confirmed from public.teams where session_id=p_session_id and registration_status='confirmed';
  select count(distinct t.id) into v_reserved_teams from public.teams t
    where t.session_id=p_session_id and t.registration_status not in ('confirmed','cancelled')
      and exists (select 1 from public.team_memberships m where m.team_id=t.id and m.status='pending_payment' and m.expires_at>now());
  if v_confirmed + v_reserved_teams >= v_max_teams then raise exception 'All team slots are full or reserved for checkout'; end if;
  insert into public.teams(session_id, created_by, team_name, registration_status)
  values(p_session_id, v_user, trim(p_team_name), 'pending_payment') returning id into v_team_id;
  return v_team_id;
end;
$$;
revoke all on function public.register_team(uuid, text) from public, anon;
grant execute on function public.register_team(uuid, text) to authenticated;

create or replace function public.reserve_team_membership(p_team_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
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
  v_team_has_reservation boolean;
  v_places integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;

  select t.session_id, s.players_per_team, s.max_teams, s.status, t.registration_status
    into v_session_id, v_limit, v_max_teams, v_session_status, v_team_status
  from public.teams t
  join public.sessions s on s.id=t.session_id
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

  select count(*) into v_confirmed_teams
  from public.teams where session_id=v_session_id and registration_status='confirmed';

  select count(distinct t.id) into v_reserved_teams
  from public.teams t
  where t.session_id=v_session_id and t.registration_status not in ('confirmed','cancelled')
    and exists (select 1 from public.team_memberships m where m.team_id=t.id and m.status='pending_payment' and m.expires_at>now());

  select exists (select 1 from public.team_memberships m where m.team_id=p_team_id and m.status='pending_payment' and m.expires_at>now())
    into v_team_has_reservation;

  if v_team_status <> 'confirmed' and not v_team_has_reservation and v_confirmed_teams + v_reserved_teams >= v_max_teams then
    raise exception 'All team slots are already counted or reserved for checkout';
  end if;

  select count(*) into v_places from public.team_memberships
  where team_id=p_team_id and (status='paid' or (status='pending_payment' and expires_at > now()));
  if v_places >= v_limit then raise exception 'This team is full'; end if;

  select coalesce(nullif(trim(full_name),''),'MOTM Member') into v_name
  from public.profiles where id=v_user;
  if v_name is null then raise exception 'Profile not found'; end if;

  if v_membership_id is not null then
    update public.team_memberships
    set status='pending_payment', player_name=v_name, payment_intent_id=null, expires_at=now()+interval '20 minutes', paid_at=null
    where id=v_membership_id;
  else
    insert into public.team_memberships(team_id,user_id,player_name,status,expires_at)
    values(p_team_id,v_user,v_name,'pending_payment',now()+interval '20 minutes')
    returning id into v_membership_id;
  end if;
  return v_membership_id;
end;
$$;
revoke all on function public.reserve_team_membership(uuid) from public, anon;
grant execute on function public.reserve_team_membership(uuid) to authenticated;
