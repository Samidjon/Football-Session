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
