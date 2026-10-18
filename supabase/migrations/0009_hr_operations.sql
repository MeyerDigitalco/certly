-- ============================================================
-- Certly - Migration 0009: HR operations
--
-- Until now Certly knew who is on the register and what tickets they
-- hold. It did not know when they started, when they left or why,
-- how old they are, how many people the client has approved for a
-- site, or who is in the pipeline to join. Those are the facts a
-- contractor's monthly HR report is made of, and this migration adds
-- them.
--
-- Deliberately out of scope: medical incapacity cases and disciplinary
-- cases. Both are special personal information under POPIA section 26
-- and need a rewritten privacy policy and an operator agreement with
-- each client before a row is captured. Nothing here touches either.
--
-- Terminated employees stay on the table. Their history is the report,
-- and deleting them would delete the thing the client is paying to
-- see. What changes is that they stop counting as seats and drop out
-- of the live register by default.
-- ============================================================

-- ============================================================
-- Employees: lifecycle and age
-- ============================================================

alter table public.employees
  add column if not exists date_of_birth date,
  add column if not exists engaged_at date,
  add column if not exists retirement_age integer
    check (retirement_age is null or (retirement_age between 50 and 75)),
  add column if not exists approved_retirement_date date,
  add column if not exists terminated_at date,
  add column if not exists termination_reason text
    check (termination_reason is null or termination_reason in (
      'deceased',
      'retirement',
      'medical_incapacity',
      'fixed_term_end',
      'retrenchment',
      'resignation',
      'dismissal',
      'abscondment'
    )),
  add column if not exists termination_notes text;

-- A reason without a date, or a date without a reason, is a half
-- recorded termination that no report can place.
alter table public.employees
  drop constraint if exists employees_termination_complete;
alter table public.employees
  add constraint employees_termination_complete
  check (
    (terminated_at is null and termination_reason is null)
    or (terminated_at is not null and termination_reason is not null)
  );

create index if not exists idx_employees_org_terminated
  on public.employees(organisation_id, terminated_at);

create index if not exists idx_employees_org_engaged
  on public.employees(organisation_id, engaged_at);

create index if not exists idx_employees_org_dob
  on public.employees(organisation_id, date_of_birth)
  where date_of_birth is not null;

-- ============================================================
-- Organisations: the default retirement age
--
-- South Africa has no statutory retirement age. It is whatever the
-- contract or the fund rules say, and on the mines it is usually 60
-- to 65. Per employee overrides live on the employee row; this is
-- what applies when none is set.
-- ============================================================

alter table public.organisations
  add column if not exists default_retirement_age integer not null default 63
    check (default_retirement_age between 50 and 75);

-- ============================================================
-- labour_plans: what the client has approved per site and role
--
-- One row per site, designation and effective date. The plan in force
-- for a month is the latest row whose effective_from is on or before
-- the last day of that month, so a plan can change mid year without
-- rewriting history.
-- ============================================================

create table if not exists public.labour_plans (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  site            text not null,
  designation     text not null,
  planned         integer not null check (planned >= 0),
  effective_from  date not null,
  notes           text,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists idx_labour_plan_key
  on public.labour_plans(organisation_id, site, designation, effective_from);

create index if not exists idx_labour_plan_org_site
  on public.labour_plans(organisation_id, site, effective_from desc);

drop trigger if exists trg_labour_plan_updated on public.labour_plans;
create trigger trg_labour_plan_updated before update on public.labour_plans
  for each row execute function public.set_updated_at();

-- ============================================================
-- onboarding_candidates: the pipeline between offer and first shift
--
-- On a mine a new hire is not on the register the day they say yes.
-- They are screened, medically assessed, registered with TEBA, put
-- through induction and only then engaged. Each of those is a date a
-- site manager is asked for every week. The status column is what the
-- report counts; the dates are the evidence behind it.
-- ============================================================

create table if not exists public.onboarding_candidates (
  id                   uuid primary key default gen_random_uuid(),
  organisation_id      uuid not null references public.organisations(id) on delete cascade,
  surname              text not null,
  names                text not null,
  id_number            text,
  id_type              text default 'sa_id'
                         check (id_type in ('sa_id','passport','work_permit','asylum','other')),
  designation          text not null,
  site                 text not null,
  status               text not null default 'screening'
                         check (status in (
                           'screening',
                           'medical',
                           'teba',
                           'training',
                           'ready',
                           'engaged',
                           'unfit',
                           'withdrawn'
                         )),
  screening_booked_at  date,
  screened_at          date,
  medical_booked_at    date,
  medical_at           date,
  rfac_at              date,
  medical_status       text
                         check (medical_status is null or medical_status in ('fit','unfit','pending')),
  medical_review_at    date,
  teba_done            boolean not null default false,
  training_booked      boolean not null default false,
  training_start_at    date,
  expected_passout_at  date,
  employee_id          uuid references public.employees(id) on delete set null,
  notes                text,
  created_by           uuid references public.profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_onboarding_org_status
  on public.onboarding_candidates(organisation_id, status);

create index if not exists idx_onboarding_org_site
  on public.onboarding_candidates(organisation_id, site);

drop trigger if exists trg_onboarding_updated on public.onboarding_candidates;
create trigger trg_onboarding_updated before update on public.onboarding_candidates
  for each row execute function public.set_updated_at();

-- ============================================================
-- Row level security and audit, same shape as every other tenant table
-- ============================================================

alter table public.labour_plans          enable row level security;
alter table public.onboarding_candidates enable row level security;

do $$
declare tbl text;
begin
  foreach tbl in array array['labour_plans','onboarding_candidates'] loop
    execute format('drop policy if exists "org read" on public.%I', tbl);
    execute format('create policy "org read" on public.%I for select using (public.is_member_of(organisation_id))', tbl);
    execute format('drop policy if exists "org write" on public.%I', tbl);
    execute format('create policy "org write" on public.%I for all using (public.is_admin_of(organisation_id)) with check (public.is_admin_of(organisation_id))', tbl);
  end loop;
end $$;

drop trigger if exists trg_audit_labour_plans on public.labour_plans;
create trigger trg_audit_labour_plans
  after insert or update or delete on public.labour_plans
  for each row execute function public.log_audit();

drop trigger if exists trg_audit_onboarding on public.onboarding_candidates;
create trigger trg_audit_onboarding
  after insert or update or delete on public.onboarding_candidates
  for each row execute function public.log_audit();

-- ============================================================
-- The register view learns about terminations
--
-- Recreated rather than altered because Postgres cannot add a column
-- to a view in place. security_invoker is kept, and that is the whole
-- reason this is spelled out in full rather than patched.
-- ============================================================

drop view if exists public.register_rows;

create view public.register_rows
with (security_invoker = true)
as
select
  c.id                as certification_id,
  c.organisation_id   as organisation_id,
  c.employee_id       as employee_id,
  e.surname           as surname,
  e.names             as names,
  e.id_number         as id_number,
  e.id_type           as id_type,
  e.site              as site,
  e.superior          as superior,
  e.terminated_at     as terminated_at,
  t.name              as training_type,
  t.sort_order        as training_sort,
  c.training_date     as training_date,
  c.expiry_date       as expiry_date,
  c.cert_file_path is not null as has_file,
  case
    when c.expiry_date is null then null
    else (c.expiry_date
          - (now() at time zone 'Africa/Johannesburg')::date)
  end                 as days_left,
  case
    when c.expiry_date is null then 'no_expiry'
    when c.expiry_date
         < (now() at time zone 'Africa/Johannesburg')::date then 'expired'
    when c.expiry_date
         <= (now() at time zone 'Africa/Johannesburg')::date
            + o.due_soon_days then 'due_soon'
    else 'valid'
  end                 as status,
  case
    when c.expiry_date is null then 3
    when c.expiry_date
         < (now() at time zone 'Africa/Johannesburg')::date then 0
    when c.expiry_date
         <= (now() at time zone 'Africa/Johannesburg')::date
            + o.due_soon_days then 1
    else 2
  end                 as urgency
from public.certifications c
join public.employees      e on e.id = c.employee_id
join public.training_types t on t.id = c.training_type_id
join public.organisations  o on o.id = c.organisation_id;

comment on view public.register_rows is
  'Flattened training register with status computed in SQL. security_invoker so RLS applies as the calling user. Always filter on organisation_id: a user may belong to more than one workspace and RLS alone will return every one they belong to.';

grant select on public.register_rows to authenticated;
