-- ============================================================
-- Certly - Migration 0006: the register as a view
--
-- getRegisterRows loaded every certification in a workspace and
-- filtered, sorted and counted them in JavaScript, twice per page
-- load once the KPI cards are counted. That is fine at fifty people
-- and falls over at five hundred.
--
-- Everything it did in JavaScript is expressible in SQL, because
-- status is a pure function of expiry_date, today, and the
-- workspace's own due_soon_days:
--
--   expiry_date is null                     -> no_expiry
--   expiry_date < today                     -> expired
--   expiry_date <= today + due_soon_days    -> due_soon
--   otherwise                               -> valid
--
-- security_invoker is the whole point of this file. A view defaults
-- to running as its owner, which would bypass every RLS policy on
-- the tables underneath and hand any signed in user the entire
-- register of every workspace. With security_invoker the policies
-- apply as the calling user, exactly as they do on a direct select.
-- Do not remove it, and do not recreate this view without it.
--
-- Today is taken in South African time rather than UTC, so the
-- expired boundary matches what the application shows and what a
-- supervisor sees on the wall calendar.
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

-- ============================================================
-- Indexes for the filters and sorts the register actually uses
-- ============================================================

create index if not exists idx_certs_org_expiry
  on public.certifications(organisation_id, expiry_date);

create index if not exists idx_employees_org_surname
  on public.employees(organisation_id, surname);

create index if not exists idx_employees_org_site
  on public.employees(organisation_id, site);

-- Case-insensitive search over the three fields the register searches.
create index if not exists idx_employees_org_surname_lower
  on public.employees(organisation_id, lower(surname));

create index if not exists idx_employees_org_names_lower
  on public.employees(organisation_id, lower(names));

create index if not exists idx_employees_org_idnumber_lower
  on public.employees(organisation_id, lower(id_number));
