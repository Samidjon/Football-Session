-- MOTM Individuals directory and session image URLs.
-- Apply after the existing 20261015 migrations in Supabase SQL Editor.
begin;

-- Keep Storage-backed photos readable and support URL-backed images without uploads.
alter table public.session_photos add column if not exists image_url text;
alter table public.session_photos alter column storage_path drop not null;

alter table public.session_photos drop constraint if exists session_photos_image_source_check;
alter table public.session_photos add constraint session_photos_image_source_check
  check (
    (storage_path is not null and image_url is null)
    or (storage_path is null and image_url is not null and image_url ~* '^https?://')
  );

create unique index if not exists session_photos_session_image_url_idx
  on public.session_photos (session_id, image_url)
  where image_url is not null;

-- The old Individuals form created standalone user-owned teams. Individuals now
-- lists admin-managed public sessions instead, so disable the legacy RPC path.
revoke all on function public.create_individual_team(text, integer)
  from public, anon, authenticated;

do $$
begin
  if to_regprocedure('public.create_individual_team(text)') is not null then
    execute 'revoke all on function public.create_individual_team(text) from public, anon, authenticated';
  end if;
end
$$;

notify pgrst, 'reload schema';
commit;
