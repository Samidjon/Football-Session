-- Session photo gallery. Apply this migration in the Supabase SQL Editor.
create table if not exists public.session_photos (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  storage_path text not null unique,
  caption text,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists session_photos_session_id_created_at_idx
  on public.session_photos (session_id, created_at desc);

alter table public.session_photos enable row level security;

drop policy if exists "Session photos are publicly viewable" on public.session_photos;
create policy "Session photos are publicly viewable"
  on public.session_photos for select to anon, authenticated
  using (true);

drop policy if exists "Organizers can add photos to their sessions" on public.session_photos;
create policy "Organizers can add photos to their sessions"
  on public.session_photos for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'organizer')
    and exists (select 1 from public.sessions s where s.id = session_id and s.created_by = auth.uid())
  );

drop policy if exists "Organizers can update photos for their sessions" on public.session_photos;
create policy "Organizers can update photos for their sessions"
  on public.session_photos for update to authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id and s.created_by = auth.uid())
         and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'organizer'))
  with check (exists (select 1 from public.sessions s where s.id = session_id and s.created_by = auth.uid())
              and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'organizer'));

drop policy if exists "Organizers can delete photos for their sessions" on public.session_photos;
create policy "Organizers can delete photos for their sessions"
  on public.session_photos for delete to authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id and s.created_by = auth.uid())
         and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'organizer'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('session-photos', 'session-photos', true, 10485760,
        array['image/jpeg','image/png','image/webp','image/gif','image/avif'])
on conflict (id) do update set public = true, file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/avif'];

drop policy if exists "Session gallery images are publicly readable" on storage.objects;
create policy "Session gallery images are publicly readable"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'session-photos');

drop policy if exists "Organizers upload images to their sessions" on storage.objects;
create policy "Organizers upload images to their sessions"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'session-photos'
    and (storage.foldername(name))[1] is not null
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'organizer')
    and exists (select 1 from public.sessions s where s.id::text = (storage.foldername(name))[1] and s.created_by = auth.uid())
  );

drop policy if exists "Organizers replace images in their sessions" on storage.objects;
create policy "Organizers replace images in their sessions"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'session-photos'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'organizer')
    and exists (select 1 from public.sessions s where s.id::text = (storage.foldername(name))[1] and s.created_by = auth.uid())
  ) with check (
    bucket_id = 'session-photos'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'organizer')
    and exists (select 1 from public.sessions s where s.id::text = (storage.foldername(name))[1] and s.created_by = auth.uid())
  );

drop policy if exists "Organizers delete images in their sessions" on storage.objects;
create policy "Organizers delete images in their sessions"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'session-photos'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'organizer')
    and exists (select 1 from public.sessions s where s.id::text = (storage.foldername(name))[1] and s.created_by = auth.uid())
  );
