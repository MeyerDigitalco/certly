-- ============================================================
-- Certly - Migration 0004: company documents and retention
--
-- A safety file has two halves. The employee half comes off the
-- register. The company half, policies, registration, insurance and
-- letters of good standing, is uploaded once and reused in every pack.
-- Until now Certly held only the first half while the landing page
-- claimed both.
--
-- Also adds the date an identity copy was certified. Most mines want a
-- certified copy under three months old, and a pack that presents an
-- uncertified scan gets rejected at the client's desk.
-- ============================================================

create table if not exists public.company_documents (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  category        text not null default 'other'
                    check (category in (
                      'policy','registration','tax','coida','insurance',
                      'bbbee','organogram','appointment','procedure','other'
                    )),
  title           text not null,
  file_path       text,
  issued_at       date,
  expires_at      date,
  sort_order      integer not null default 0,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_company_docs_org
  on public.company_documents(organisation_id, sort_order);
create index if not exists idx_company_docs_expiry
  on public.company_documents(organisation_id, expires_at);

drop trigger if exists trg_company_docs_updated on public.company_documents;
create trigger trg_company_docs_updated before update on public.company_documents
  for each row execute function public.set_updated_at();

alter table public.company_documents enable row level security;

drop policy if exists "org read company docs" on public.company_documents;
create policy "org read company docs" on public.company_documents
  for select using (public.is_member_of(organisation_id));

drop policy if exists "org write company docs" on public.company_documents;
create policy "org write company docs" on public.company_documents
  for all using (public.is_admin_of(organisation_id))
         with check (public.is_admin_of(organisation_id));

drop trigger if exists trg_audit_company_docs on public.company_documents;
create trigger trg_audit_company_docs
  after insert or update or delete on public.company_documents
  for each row execute function public.log_audit();

-- ============================================================
-- Storage bucket for company documents
-- Members read, admins write. Same {organisation_id}/ prefix rule.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('company-documents', 'company-documents', false)
on conflict (id) do update set public = false;

drop policy if exists "org read company files" on storage.objects;
create policy "org read company files" on storage.objects
  for select using (
    bucket_id = 'company-documents'
    and public.is_member_of((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "org write company files" on storage.objects;
create policy "org write company files" on storage.objects
  for insert with check (
    bucket_id = 'company-documents'
    and public.is_admin_of((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "org update company files" on storage.objects;
create policy "org update company files" on storage.objects
  for update using (
    bucket_id = 'company-documents'
    and public.is_admin_of((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'company-documents'
    and public.is_admin_of((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "org delete company files" on storage.objects;
create policy "org delete company files" on storage.objects
  for delete using (
    bucket_id = 'company-documents'
    and public.is_admin_of((storage.foldername(name))[1]::uuid)
  );

-- ============================================================
-- Certified copy tracking
-- ============================================================

alter table public.employees
  add column if not exists id_certified_at date;
