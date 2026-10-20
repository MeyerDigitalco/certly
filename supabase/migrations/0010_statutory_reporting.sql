-- ============================================================
-- Certly - Migration 0010: statutory reporting
--
-- Three reports a South African employer owes by law or loses money
-- without, and one it owes its client:
--
--   Employment Equity (EEA2) needs gender, population group, disability
--   and occupational level per person. Designated employers (50 or more
--   employees) report every year between 1 September and 15 January.
--
--   Annual Training Report and Workplace Skills Plan go to the SETA by
--   30 April. The ATR is the training delivered in the year that ended
--   31 March, which Certly already holds as certifications; what was
--   missing is the category, hours, cost and provider per training type,
--   and a place to record what is planned for next year.
--
--   Labour unavailability is absence by reason, per site, per month.
--
-- Population group, gender and disability status are special personal
-- information under POPIA section 26. Processing is permitted under
-- section 27(1)(b) because the Employment Equity Act 55 of 1998 and the
-- Skills Development Act 97 of 1998 require it, and under the EE
-- regulations the employee declares it on form EEA1 which the employer
-- keeps on file. Certly stores the declared values only, never an
-- inference. Every column is nullable so an employer who is not
-- designated, or an employee who declines to declare, leaves it blank.
--
-- Still out of scope: health information, disciplinary records and
-- earnings. The EEA4 income differential statement needs payroll data
-- Certly does not hold and does not want.
-- ============================================================

-- ============================================================
-- Employees: employment equity declaration
-- ============================================================

alter table public.employees
  add column if not exists gender text
    check (gender is null or gender in ('male','female')),
  add column if not exists population_group text
    check (population_group is null or population_group in ('african','coloured','indian','white')),
  add column if not exists disability boolean,
  add column if not exists occupational_level text
    check (occupational_level is null or occupational_level in (
      'top_management',
      'senior_management',
      'professionally_qualified',
      'skilled_technical',
      'semi_skilled',
      'unskilled'
    )),
  add column if not exists ofo_code text
    check (ofo_code is null or char_length(ofo_code) <= 12),
  add column if not exists ee_declared_at date;

comment on column public.employees.population_group is
  'Declared by the employee on form EEA1. Special personal information under POPIA s26, processed under s27(1)(b) for the Employment Equity Act. Never inferred.';
comment on column public.employees.disability is
  'Declared by the employee on form EEA1. Yes or no only, never the nature of the disability.';

-- ============================================================
-- Organisations: SETA and skills levy details
-- ============================================================

alter table public.organisations
  add column if not exists seta text
    check (seta is null or char_length(seta) <= 40),
  add column if not exists sdl_number text
    check (sdl_number is null or char_length(sdl_number) <= 20),
  add column if not exists ee_reference text
    check (ee_reference is null or char_length(ee_reference) <= 40);

-- ============================================================
-- Training types: what the SETA wants to know about each course
-- ============================================================

alter table public.training_types
  add column if not exists category text not null default 'short_course'
    check (category in (
      'short_course',
      'skills_programme',
      'learnership',
      'apprenticeship',
      'internship',
      'bursary',
      'induction',
      'other'
    )),
  add column if not exists hours numeric(6,1)
    check (hours is null or hours >= 0),
  add column if not exists cost_cents integer
    check (cost_cents is null or cost_cents >= 0),
  add column if not exists provider text
    check (provider is null or char_length(provider) <= 160),
  add column if not exists nqf_level integer
    check (nqf_level is null or nqf_level between 1 and 10),
  add column if not exists accredited boolean not null default false,
  add column if not exists counts_for_atr boolean not null default true;

comment on column public.training_types.counts_for_atr is
  'False for site inductions and client-specific access tickets that the SETA does not regard as training.';

-- ============================================================
-- training_plans: the Workplace Skills Plan, one row per course per year
-- ============================================================

create table if not exists public.training_plans (
  id                uuid primary key default gen_random_uuid(),
  organisation_id   uuid not null references public.organisations(id) on delete cascade,
  training_type_id  uuid not null references public.training_types(id) on delete cascade,
  seta_year         integer not null check (seta_year between 2020 and 2100),
  site              text not null default '',
  planned_count     integer not null check (planned_count >= 0),
  planned_cost_cents integer check (planned_cost_cents is null or planned_cost_cents >= 0),
  notes             text,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.training_plans is
  'Workplace Skills Plan rows. seta_year is the year in which the SETA financial year ends: 2027 means 1 April 2026 to 31 March 2027.';

create unique index if not exists idx_training_plan_key
  on public.training_plans(organisation_id, training_type_id, seta_year, site);

create index if not exists idx_training_plan_org_year
  on public.training_plans(organisation_id, seta_year);

drop trigger if exists trg_training_plan_updated on public.training_plans;
create trigger trg_training_plan_updated before update on public.training_plans
  for each row execute function public.set_updated_at();

-- ============================================================
-- absences: labour unavailability
--
-- One row per spell of absence. Days are counted on the calendar within
-- the spell; a contractor on a continuous-operations site works
-- weekends, so a working-day calendar would be wrong more often than
-- right. Sick leave is a count of days, not a diagnosis, and is the same
-- figure the employer already reports to the Department of Labour on
-- the UI-19. Nothing medical is stored.
-- ============================================================

create table if not exists public.absences (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  employee_id     uuid not null references public.employees(id) on delete cascade,
  starts_on       date not null,
  ends_on         date not null,
  reason          text not null check (reason in (
    'annual_leave',
    'sick_leave',
    'family_responsibility',
    'study_leave',
    'unpaid_leave',
    'absent_without_leave',
    'injury_on_duty',
    'other'
  )),
  half_day        boolean not null default false,
  notes           text check (notes is null or char_length(notes) <= 300),
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint absences_span check (ends_on >= starts_on),
  constraint absences_half_day_single check (half_day = false or ends_on = starts_on)
);

create index if not exists idx_absences_org_dates
  on public.absences(organisation_id, starts_on, ends_on);

create index if not exists idx_absences_employee
  on public.absences(employee_id, starts_on);

drop trigger if exists trg_absence_updated on public.absences;
create trigger trg_absence_updated before update on public.absences
  for each row execute function public.set_updated_at();

-- ============================================================
-- Row level security and audit
-- ============================================================

alter table public.training_plans enable row level security;
alter table public.absences       enable row level security;

do $$
declare tbl text;
begin
  foreach tbl in array array['training_plans','absences'] loop
    execute format('drop policy if exists "org read" on public.%I', tbl);
    execute format('create policy "org read" on public.%I for select using (public.is_member_of(organisation_id))', tbl);
    execute format('drop policy if exists "org write" on public.%I', tbl);
    execute format('create policy "org write" on public.%I for all using (public.is_admin_of(organisation_id)) with check (public.is_admin_of(organisation_id))', tbl);
  end loop;
end $$;

drop trigger if exists trg_audit_training_plans on public.training_plans;
create trigger trg_audit_training_plans
  after insert or update or delete on public.training_plans
  for each row execute function public.log_audit();

drop trigger if exists trg_audit_absences on public.absences;
create trigger trg_audit_absences
  after insert or update or delete on public.absences
  for each row execute function public.log_audit();

-- ============================================================
-- Guard: an absence must belong to an employee of the same workspace
-- ============================================================

create or replace function public.absence_employee_same_org()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.employees e
    where e.id = new.employee_id and e.organisation_id = new.organisation_id
  ) then
    raise exception 'absence employee belongs to a different workspace';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_absence_same_org on public.absences;
create trigger trg_absence_same_org
  before insert or update on public.absences
  for each row execute function public.absence_employee_same_org();

create or replace function public.training_plan_type_same_org()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.training_types t
    where t.id = new.training_type_id and t.organisation_id = new.organisation_id
  ) then
    raise exception 'training plan type belongs to a different workspace';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_training_plan_same_org on public.training_plans;
create trigger trg_training_plan_same_org
  before insert or update on public.training_plans
  for each row execute function public.training_plan_type_same_org();
