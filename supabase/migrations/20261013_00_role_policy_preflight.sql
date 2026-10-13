-- Recovery helper for older databases: remove policies that depend on profiles.role
-- before the role enum is converted to text. Run this immediately before
-- 20261013_individual_session_payments.sql if that migration previously failed.
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

alter table public.profiles alter column role drop default;
alter table public.profiles alter column role type text using role::text;
update public.profiles set role = 'user' where role = 'captain';
update public.profiles set role = 'user' where role is null or role not in ('user', 'organizer');
alter table public.profiles alter column role set default 'user';
alter table public.profiles drop constraint if exists profiles_role_allowed;
alter table public.profiles add constraint profiles_role_allowed check (role in ('user', 'organizer'));
drop type if exists public.user_role;
