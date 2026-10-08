-- Public roster visibility: visitors can view teams and player names without logging in.
drop policy if exists "teams_select_anon" on public.teams;
create policy "teams_select_anon"
on public.teams
for select
to anon
using (true);

drop policy if exists "team_players_select_anon" on public.team_players;
create policy "team_players_select_anon"
on public.team_players
for select
to anon
using (true);
