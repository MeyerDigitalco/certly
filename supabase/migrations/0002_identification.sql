-- ============================================================
-- Certly - Migration 0002: identification beyond South African IDs
--
-- The original employees table assumed every worker holds a 13 digit
-- South African identity number. Cross border crews are normal on South
-- African sites, so a Zimbabwean, Mozambican or Malawian national on a
-- passport or work permit could not be captured at all.
--
-- sa_id becomes id_number and loses its format check. The kind of
-- document, the issuing country and the document's own expiry date are
-- now recorded, because a work permit lapsing stops a person at the gate
-- exactly like a lapsed induction does.
-- ============================================================

alter table public.employees
  drop constraint if exists employees_sa_id_check;

alter table public.employees
  drop constraint if exists employees_organisation_id_sa_id_key;

do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'employees'
       and column_name = 'sa_id'
  ) then
    alter table public.employees rename column sa_id to id_number;
  end if;
end $$;

alter table public.employees
  add column if not exists id_type text not null default 'sa_id';

alter table public.employees
  drop constraint if exists employees_id_type_check;
alter table public.employees
  add constraint employees_id_type_check
  check (id_type in ('sa_id','passport','work_permit','asylum','other'));

alter table public.employees
  add column if not exists id_country text;

alter table public.employees
  add column if not exists id_expiry date;

alter table public.employees
  alter column id_number set not null;

alter table public.employees
  drop constraint if exists employees_org_id_number_key;
alter table public.employees
  add constraint employees_org_id_number_key
  unique (organisation_id, id_number);

create index if not exists idx_emp_id_number
  on public.employees(organisation_id, id_number);

update public.employees
   set id_country = 'ZA'
 where id_type = 'sa_id' and id_country is null;
