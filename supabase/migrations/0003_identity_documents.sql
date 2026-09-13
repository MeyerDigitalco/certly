-- ============================================================
-- Certly - Migration 0003: stored identity documents
--
-- Safety file packs routinely require a copy of each worker's identity
-- document, passport or permit. Those scans are more sensitive than a
-- training certificate, so they do not share the certificates bucket.
--
-- Two differences from the certificates bucket, both deliberate:
--   1. A separate bucket, so retention and deletion can be handled
--      independently and a mistake in one policy cannot expose the other.
--   2. Read is restricted to owners and admins. Viewers can read the
--      training register but have no business opening passport scans.
-- ============================================================

alter table public.employees
  add column if not exists id_file_path text;

insert into storage.buckets (id, name, public)
values ('identity-documents', 'identity-documents', false)
on conflict (id) do update set public = false;

-- Path convention: {organisation_id}/{employee_id}/{uuid}.{ext}

drop policy if exists "org read identity files" on storage.objects;
create policy "org read identity files" on storage.objects
  for select using (
    bucket_id = 'identity-documents'
    and public.is_admin_of((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "org write identity files" on storage.objects;
create policy "org write identity files" on storage.objects
  for insert with check (
    bucket_id = 'identity-documents'
    and public.is_admin_of((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "org update identity files" on storage.objects;
create policy "org update identity files" on storage.objects
  for update using (
    bucket_id = 'identity-documents'
    and public.is_admin_of((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'identity-documents'
    and public.is_admin_of((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "org delete identity files" on storage.objects;
create policy "org delete identity files" on storage.objects
  for delete using (
    bucket_id = 'identity-documents'
    and public.is_admin_of((storage.foldername(name))[1]::uuid)
  );
