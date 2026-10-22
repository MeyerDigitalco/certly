-- ============================================================
-- Certly - Migration 0013: compliance snapshots
--
-- One row per workspace per day recording the compliance score and its
-- parts. The overview writes today's row when an admin opens it and reads
-- the history back to say "up 4 since last month" and draw the line. A
-- score with no history is a trophy; a score with a direction is a reason
-- to open the page again.
--
-- Written by admins through RLS, because every figure in a row is
-- computed from data the admin can already read. There is nothing here
-- that a forged row could leak or unlock; the worst a hostile admin can
-- do is lie to their own dashboard about last month.
-- ============================================================

create table if not exists public.compliance_snapshots (
  id                 uuid primary key default gen_random_uuid(),
  organisation_id    uuid not null references public.organisations(id) on delete cascade,
  taken_on           date not null,
  score              integer not null check (score between 0 and 100),
  certificates_pct   numeric(5,1),
  declarations_pct   numeric(5,1),
  company_docs_pct   numeric(5,1),
  training_pct       numeric(5,1),
  headcount          integer not null default 0 check (headcount >= 0),
  cannot_pass        integer not null default 0 check (cannot_pass >= 0),
  created_at         timestamptz not null default now(),
  unique (organisation_id, taken_on)
);

create index if not exists idx_snapshots_org_date
  on public.compliance_snapshots(organisation_id, taken_on desc);

alter table public.compliance_snapshots enable row level security;

drop policy if exists "org read" on public.compliance_snapshots;
create policy "org read" on public.compliance_snapshots
  for select using (public.is_member_of(organisation_id));

drop policy if exists "org write" on public.compliance_snapshots;
create policy "org write" on public.compliance_snapshots
  for all using (public.is_admin_of(organisation_id))
         with check (public.is_admin_of(organisation_id));

comment on table public.compliance_snapshots is
  'Daily compliance score per workspace, written when an admin views the overview. Read for the trend.';
