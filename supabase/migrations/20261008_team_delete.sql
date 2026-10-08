-- Run this in Supabase SQL Editor on an existing project.

create or replace function public.delete_team(
  p_team_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_status public.registration_status;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  select registration_status
  into v_status
  from public.teams
  where id = p_team_id
    and captain_id = v_user;

  if v_status is null then
    raise exception 'Team not found or you are not the captain';
  end if;

  if v_status <> 'pending_payment' then
    raise exception 'Confirmed teams cannot be deleted. Contact the organizer for cancellation/refund.';
  end if;

  delete from public.teams
  where id = p_team_id
    and captain_id = v_user;
end;
$$;

grant execute on function public.delete_team(uuid) to authenticated;
