-- ============================================================
-- Certly - HR Compliance SaaS
-- Migration 0001: complete multi-tenant schema
--
-- Every table carries organisation_id and is scoped by RLS.
-- The single global auth.users pool spans all tenants; org_members
-- maps auth users to organisations with a role.
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Touch updated_at helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ============================================================
-- organisations
-- ============================================================
create table if not exists public.organisations (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique
                 check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'),
  name         text not null,
  logo_url     text,
  plan         text not null default 'trial'
                 check (plan in ('trial','starter','growth','scale','enterprise')),
  trial_ends_at timestamptz not null default (now() + interval '14 days'),
  due_soon_days integer not null default 30,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_org_slug on public.organisations(slug);
drop trigger if exists trg_org_updated on public.organisations;
create trigger trg_org_updated before update on public.organisations
  for each row execute function public.set_updated_at();

-- ============================================================
-- profiles (1:1 with auth.users, global)
-- ============================================================
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row on auth signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- org_members - per-tenant admin allowlist
-- Roles: owner (one per org, full control + billing)
--        admin (full HR access)
--        viewer (read-only)
-- ============================================================
create table if not exists public.org_members (
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null default 'admin'
                    check (role in ('owner','admin','viewer')),
  created_at      timestamptz not null default now(),
  primary key (organisation_id, user_id)
);
create index if not exists idx_members_user on public.org_members(user_id);

-- Helpers
create or replace function public.current_role_in(p_org uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from public.org_members
   where organisation_id = p_org and user_id = auth.uid()
   limit 1
$$;

create or replace function public.is_member_of(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_members
     where organisation_id = p_org and user_id = auth.uid()
  )
$$;

create or replace function public.is_admin_of(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_members
     where organisation_id = p_org and user_id = auth.uid()
       and role in ('owner','admin')
  )
$$;

create or replace function public.is_owner_of(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_members
     where organisation_id = p_org and user_id = auth.uid()
       and role = 'owner'
  )
$$;

-- ============================================================
-- employees
-- ============================================================
create table if not exists public.employees (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  surname         text not null,
  names           text not null,
  sa_id           text not null check (sa_id ~ '^\d{13}$'),
  site            text,
  superior        text,
  designation     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organisation_id, sa_id)
);
create index if not exists idx_emp_org on public.employees(organisation_id);
create index if not exists idx_emp_surname on public.employees(organisation_id, surname);
drop trigger if exists trg_emp_updated on public.employees;
create trigger trg_emp_updated before update on public.employees
  for each row execute function public.set_updated_at();

-- ============================================================
-- training_types (per-tenant catalogue)
-- ============================================================
create table if not exists public.training_types (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name            text not null,
  sort_order      integer not null default 0,
  active          boolean not null default true,
  unique (organisation_id, name)
);
create index if not exists idx_tt_org on public.training_types(organisation_id, active, sort_order);

-- Seed the 24 default types into a new organisation
create or replace function public.seed_training_types(p_org uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  names text[] := array[
    'MEDICAL','INDUCTION','ONSIDE INDUCTION','TEBA','FIRST AID LEVEL 1',
    'POWER TOOLS','ENGINEERING HAND TOOLS','FIRE FIGHTING','HIRA',
    'DRUG TEST AWARENESS','SAQCC','WORKING AT HEIGHTS','SUPERVISOR',
    'LEGAL LIABILITY','FIRST AID LEVEL 2','SHE REP','HAZCHEM',
    'SABS 1475 REFRESHERS','MULTIMETER NON UNIT','SECTION CARDS',
    'CONFINED SPACE','CONVEYOR BELT SAFETY AWARENESS',
    'MINES LEGAL LIABILITY','GAS/ARC WELDING'
  ];
  i int;
begin
  for i in 1..array_length(names,1) loop
    insert into public.training_types (organisation_id, name, sort_order)
    values (p_org, names[i], i*10)
    on conflict do nothing;
  end loop;
end $$;

-- ============================================================
-- certifications
-- ============================================================
create table if not exists public.certifications (
  id                uuid primary key default gen_random_uuid(),
  organisation_id   uuid not null references public.organisations(id) on delete cascade,
  employee_id       uuid not null references public.employees(id) on delete cascade,
  training_type_id  uuid not null references public.training_types(id) on delete restrict,
  training_date     date,
  expiry_date       date,
  cert_file_path    text,
  source            text not null default 'manual'
                        check (source in ('manual','extracted')),
  extraction_meta   jsonb,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (employee_id, training_type_id)
);
create index if not exists idx_certs_org on public.certifications(organisation_id);
create index if not exists idx_certs_expiry on public.certifications(expiry_date);
create index if not exists idx_certs_employee on public.certifications(employee_id);
drop trigger if exists trg_certs_updated on public.certifications;
create trigger trg_certs_updated before update on public.certifications
  for each row execute function public.set_updated_at();

-- ============================================================
-- extraction_drafts
-- ============================================================
create table if not exists public.extraction_drafts (
  id                uuid primary key default gen_random_uuid(),
  organisation_id   uuid not null references public.organisations(id) on delete cascade,
  status            text not null default 'pending'
                        check (status in ('pending','confirmed','discarded')),
  file_name         text not null,
  storage_path      text not null,
  raw_model_output  jsonb,
  employee_match_id uuid references public.employees(id) on delete set null,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_drafts_org on public.extraction_drafts(organisation_id, status);
drop trigger if exists trg_drafts_updated on public.extraction_drafts;
create trigger trg_drafts_updated before update on public.extraction_drafts
  for each row execute function public.set_updated_at();

-- ============================================================
-- audit_log (per-tenant, append-only)
-- ============================================================
create table if not exists public.audit_log (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  actor           uuid references public.profiles(id) on delete set null,
  action          text not null,
  table_name      text not null,
  row_id          uuid,
  before          jsonb,
  after           jsonb,
  at              timestamptz not null default now()
);
create index if not exists idx_audit_org_at on public.audit_log(organisation_id, at desc);

create or replace function public.log_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_row uuid;
  v_before jsonb;
  v_after jsonb;
begin
  if TG_OP = 'INSERT' then
    v_row := (row_to_json(new)->>'id')::uuid;
    v_org := (row_to_json(new)->>'organisation_id')::uuid;
    v_before := null; v_after := to_jsonb(new);
  elsif TG_OP = 'UPDATE' then
    v_row := (row_to_json(new)->>'id')::uuid;
    v_org := (row_to_json(new)->>'organisation_id')::uuid;
    v_before := to_jsonb(old); v_after := to_jsonb(new);
    if v_before = v_after then return null; end if;
  else
    v_row := (row_to_json(old)->>'id')::uuid;
    v_org := (row_to_json(old)->>'organisation_id')::uuid;
    v_before := to_jsonb(old); v_after := null;
  end if;
  insert into public.audit_log (organisation_id, actor, action, table_name, row_id, before, after)
  values (v_org, auth.uid(), TG_OP, TG_TABLE_NAME, v_row, v_before, v_after);
  if TG_OP = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists trg_audit_employees on public.employees;
create trigger trg_audit_employees
  after insert or update or delete on public.employees
  for each row execute function public.log_audit();
drop trigger if exists trg_audit_certs on public.certifications;
create trigger trg_audit_certs
  after insert or update or delete on public.certifications
  for each row execute function public.log_audit();
drop trigger if exists trg_audit_drafts on public.extraction_drafts;
create trigger trg_audit_drafts
  after insert or update or delete on public.extraction_drafts
  for each row execute function public.log_audit();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.organisations   enable row level security;
alter table public.profiles        enable row level security;
alter table public.org_members     enable row level security;
alter table public.employees       enable row level security;
alter table public.training_types  enable row level security;
alter table public.certifications  enable row level security;
alter table public.extraction_drafts enable row level security;
alter table public.audit_log       enable row level security;

-- profiles: everyone reads their own row
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for select using (id = auth.uid());
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- organisations: readable by members, updatable by owner
drop policy if exists "read own org" on public.organisations;
create policy "read own org" on public.organisations
  for select using (public.is_member_of(id));
drop policy if exists "owner update org" on public.organisations;
create policy "owner update org" on public.organisations
  for update using (public.is_owner_of(id)) with check (public.is_owner_of(id));
-- Sign-up path inserts via the service role, not via RLS.

-- org_members
drop policy if exists "read org members" on public.org_members;
create policy "read org members" on public.org_members
  for select using (public.is_member_of(organisation_id));
drop policy if exists "owner writes members" on public.org_members;
create policy "owner writes members" on public.org_members
  for all using (public.is_owner_of(organisation_id))
         with check (public.is_owner_of(organisation_id));

-- employees, training_types, certifications, extraction_drafts:
-- admins have full read/write, viewers can only read.
do $$
declare tbl text;
begin
  foreach tbl in array array['employees','training_types','certifications','extraction_drafts'] loop
    execute format('drop policy if exists "org read" on public.%I', tbl);
    execute format('create policy "org read" on public.%I for select using (public.is_member_of(organisation_id))', tbl);
    execute format('drop policy if exists "org write" on public.%I', tbl);
    execute format('create policy "org write" on public.%I for all using (public.is_admin_of(organisation_id)) with check (public.is_admin_of(organisation_id))', tbl);
  end loop;
end $$;

-- audit_log: only owner sees it
drop policy if exists "owner reads audit" on public.audit_log;
create policy "owner reads audit" on public.audit_log
  for select using (public.is_owner_of(organisation_id));
-- Inserts happen via the trigger under security definer.

-- ============================================================
-- Storage bucket 'certificates' (private, per-org paths)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('certificates','certificates',false)
on conflict (id) do update set public = false;

-- Path convention: {organisation_id}/{...}
-- Members can read; admins can write.
drop policy if exists "org read cert files" on storage.objects;
create policy "org read cert files" on storage.objects
  for select using (
    bucket_id = 'certificates'
    and public.is_member_of((storage.foldername(name))[1]::uuid)
  );
drop policy if exists "org write cert files" on storage.objects;
create policy "org write cert files" on storage.objects
  for insert with check (
    bucket_id = 'certificates'
    and public.is_admin_of((storage.foldername(name))[1]::uuid)
  );
drop policy if exists "org update cert files" on storage.objects;
create policy "org update cert files" on storage.objects
  for update using (
    bucket_id = 'certificates'
    and public.is_admin_of((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'certificates'
    and public.is_admin_of((storage.foldername(name))[1]::uuid)
  );
drop policy if exists "org delete cert files" on storage.objects;
create policy "org delete cert files" on storage.objects
  for delete using (
    bucket_id = 'certificates'
    and public.is_admin_of((storage.foldername(name))[1]::uuid)
  );

-- ============================================================
-- Sign-up helper: create an org + owner in one call
-- Called from the service-role client during /signup.
-- ============================================================
create or replace function public.provision_organisation(
  p_slug text,
  p_name text,
  p_user_id uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
begin
  insert into public.organisations (slug, name)
  values (lower(p_slug), p_name)
  returning id into v_org_id;

  insert into public.org_members (organisation_id, user_id, role)
  values (v_org_id, p_user_id, 'owner');

  perform public.seed_training_types(v_org_id);

  return v_org_id;
end $$;
