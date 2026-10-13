-- MOTM final permission repair.
-- Run after 20261013_individual_session_payments.sql and
-- 20261014_team_capacity_and_individual_join.sql.
-- Idempotent: rebuilds policies and grants; it does not delete application data.

begin;

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

do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'profiles', 'sessions', 'teams', 'team_players', 'team_memberships',
        'team_member_payments', 'payments', 'fixtures', 'individual_teams',
        'individual_players', 'individual_payments', 'individual_settings',
        'individual_team_memberships', 'individual_team_member_payments'
      ])
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.teams enable row level security;
alter table public.team_players enable row level security;
alter table public.team_memberships enable row level security;
alter table public.team_member_payments enable row level security;
alter table public.payments enable row level security;
alter table public.fixtures enable row level security;
alter table public.individual_teams enable row level security;
alter table public.individual_players enable row level security;
alter table public.individual_payments enable row level security;
alter table public.individual_settings enable row level security;
alter table public.individual_team_memberships enable row level security;
alter table public.individual_team_member_payments enable row level security;


-- Status refresh must run with the function owner's rights. Otherwise a normal
-- user renaming a team can trigger a session status update that session RLS denies.
create or replace function public.refresh_session_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session_id uuid;
  v_max_teams integer;
  v_confirmed_teams integer;
begin
  if tg_op = 'DELETE' then
    v_session_id := old.session_id;
  else
    v_session_id := new.session_id;
  end if;

  select max_teams into v_max_teams
  from public.sessions
  where id = v_session_id;

  select count(*) into v_confirmed_teams
  from public.teams
  where session_id = v_session_id
    and registration_status = 'confirmed';

  update public.sessions
  set status = case
    when v_max_teams is not null and v_confirmed_teams >= v_max_teams
      then 'full'::public.session_status
    else 'open'::public.session_status
  end
  where id = v_session_id
    and status in ('open', 'full');

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Profiles: users read their own profile; organizers can inspect profiles for admin tasks.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
create policy profiles_read_own_or_organizer
on public.profiles for select to authenticated
using (id = auth.uid() or public.is_organizer());
create policy profiles_update_own
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Sessions: guests browse open sessions; authenticated users can read sessions; organizers manage theirs.
revoke all on public.sessions from anon, authenticated;
grant select on public.sessions to anon, authenticated;
grant insert, update, delete on public.sessions to authenticated;
create policy sessions_read_authenticated
on public.sessions for select to authenticated using (true);
create policy sessions_read_public
on public.sessions for select to anon using (status in ('open', 'full'));
create policy sessions_create_organizer
on public.sessions for insert to authenticated
with check (created_by = auth.uid() and public.is_organizer());
create policy sessions_update_organizer
on public.sessions for update to authenticated
using (created_by = auth.uid() and public.is_organizer())
with check (created_by = auth.uid() and public.is_organizer());
create policy sessions_delete_organizer
on public.sessions for delete to authenticated
using (created_by = auth.uid() and public.is_organizer());

-- Teams are public; only creators can rename them directly. Creation/deletion uses validated RPCs.
revoke all on public.teams from anon, authenticated;
grant select on public.teams to anon, authenticated;
grant update (team_name) on public.teams to authenticated;
create policy teams_read_authenticated
on public.teams for select to authenticated
using (registration_status <> 'cancelled');
create policy teams_read_public
on public.teams for select to anon
using (registration_status <> 'cancelled');
create policy teams_update_creator
on public.teams for update to authenticated
using (created_by = auth.uid() and registration_status <> 'cancelled')
with check (created_by = auth.uid() and registration_status <> 'cancelled');

-- Only paid session memberships are public. Unpaid reservations are private.
revoke all on public.team_memberships from anon, authenticated;
grant select (id, team_id, player_name, status, paid_at, created_at)
  on public.team_memberships to anon;
grant select (id, team_id, user_id, player_name, status, expires_at, paid_at, created_at)
  on public.team_memberships to authenticated;
create policy team_memberships_read_public_paid
on public.team_memberships for select to anon
using (status = 'paid');
create policy team_memberships_read_paid_own_or_organizer
on public.team_memberships for select to authenticated
using (status = 'paid' or user_id = auth.uid() or public.is_organizer());

-- Legacy name-only table is disabled for session rosters.
revoke all on public.team_players from anon, authenticated;

-- Payment ledger is written server-side after Stripe confirms a payment.
revoke all on public.team_member_payments from anon, authenticated;
grant select on public.team_member_payments to authenticated;
create policy team_member_payments_read_owner_or_organizer
on public.team_member_payments for select to authenticated
using (user_id = auth.uid() or public.is_organizer());
revoke all on public.payments from anon, authenticated;

-- Fixtures are publicly visible, but only the Organizer who owns a session can change them.
revoke all on public.fixtures from anon, authenticated;
grant select on public.fixtures to anon, authenticated;
grant insert, update, delete on public.fixtures to authenticated;
create policy fixtures_read_public
on public.fixtures for select to anon using (true);
create policy fixtures_read_authenticated
on public.fixtures for select to authenticated using (true);
create policy fixtures_insert_organizer
on public.fixtures for insert to authenticated
with check (
  public.is_organizer()
  and exists (select 1 from public.sessions s where s.id = fixtures.session_id and s.created_by = auth.uid())
);
create policy fixtures_update_organizer
on public.fixtures for update to authenticated
using (
  public.is_organizer()
  and exists (select 1 from public.sessions s where s.id = fixtures.session_id and s.created_by = auth.uid())
)
with check (
  public.is_organizer()
  and exists (select 1 from public.sessions s where s.id = fixtures.session_id and s.created_by = auth.uid())
);
create policy fixtures_delete_organizer
on public.fixtures for delete to authenticated
using (
  public.is_organizer()
  and exists (select 1 from public.sessions s where s.id = fixtures.session_id and s.created_by = auth.uid())
);

-- Individuals teams are public; writes go through ownership-checking RPCs.
revoke all on public.individual_teams from anon, authenticated;
grant select on public.individual_teams to anon, authenticated;
create policy individual_teams_read_public
on public.individual_teams for select to anon, authenticated
using (status <> 'cancelled');

revoke all on public.individual_settings from anon, authenticated;
grant select (id, deposit_amount, updated_at) on public.individual_settings to anon, authenticated;
create policy individual_settings_read_public
on public.individual_settings for select to anon, authenticated using (true);

revoke all on public.individual_team_memberships from anon, authenticated;
grant select (id, individual_team_id, player_name, status, paid_at, created_at)
  on public.individual_team_memberships to anon;
grant select (id, individual_team_id, user_id, player_name, status, expires_at, paid_at, created_at)
  on public.individual_team_memberships to authenticated;
create policy individual_team_memberships_read_public_paid
on public.individual_team_memberships for select to anon
using (status = 'paid');
create policy individual_team_memberships_read_paid_own_or_organizer
on public.individual_team_memberships for select to authenticated
using (status = 'paid' or user_id = auth.uid() or public.is_organizer());

revoke all on public.individual_team_member_payments from anon, authenticated;
grant select on public.individual_team_member_payments to authenticated;
create policy individual_team_member_payments_read_owner_or_organizer
on public.individual_team_member_payments for select to authenticated
using (user_id = auth.uid() or public.is_organizer());

-- Old roster/payment tables are no longer used by the UI.
revoke all on public.individual_players from anon, authenticated;
revoke all on public.individual_payments from anon, authenticated;

-- Keep validated RPCs callable by signed-in users, without allowing direct table writes.
revoke all on function public.register_team(uuid, text, integer) from public, anon;
grant execute on function public.register_team(uuid, text, integer) to authenticated;
revoke all on function public.reserve_team_membership(uuid) from public, anon;
grant execute on function public.reserve_team_membership(uuid) to authenticated;
revoke all on function public.delete_team(uuid) from public, anon;
grant execute on function public.delete_team(uuid) to authenticated;
revoke all on function public.create_individual_team(text, integer) from public, anon;
grant execute on function public.create_individual_team(text, integer) to authenticated;
revoke all on function public.reserve_individual_team_membership(uuid) from public, anon;
grant execute on function public.reserve_individual_team_membership(uuid) to authenticated;
revoke all on function public.update_individual_team_details(uuid, text, integer) from public, anon;
grant execute on function public.update_individual_team_details(uuid, text, integer) to authenticated;
revoke all on function public.delete_individual_team(uuid) from public, anon;
grant execute on function public.delete_individual_team(uuid) to authenticated;
revoke all on function public.update_individual_deposit(numeric) from public, anon;
grant execute on function public.update_individual_deposit(numeric) to authenticated;

notify pgrst, 'reload schema';
commit;
