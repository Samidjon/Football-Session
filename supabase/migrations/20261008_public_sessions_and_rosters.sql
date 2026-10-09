-- Public browsing: guests can see open sessions, registered teams, and player names.

DROP POLICY IF EXISTS "sessions_select_anon" ON public.sessions;
CREATE POLICY "sessions_select_anon"
ON public.sessions
FOR SELECT
TO anon
USING (status = 'open');

DROP POLICY IF EXISTS "teams_select_anon" ON public.teams;
CREATE POLICY "teams_select_anon"
ON public.teams
FOR SELECT
TO anon
USING (true);

DROP POLICY IF EXISTS "team_players_select_anon" ON public.team_players;
CREATE POLICY "team_players_select_anon"
ON public.team_players
FOR SELECT
TO anon
USING (true);
