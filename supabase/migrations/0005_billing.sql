-- ============================================================
-- Certly - Migration 0005: billing and plan enforcement
--
-- The original plan enum carried four tiers that were never sold.
-- Certly has one paid plan: a monthly base that covers fifty people
-- on the register, plus a per-person charge above that. This
-- collapses the enum to what is actually offered and adds the
-- subscription state the app needs to decide whether a workspace is
-- still writable.
--
-- Read-only, never dark. A workspace that stops paying keeps its
-- reads, its CSV exports and its safety file packs, because those are
-- the customer's own statutory records. Enforcement lives in the
-- application layer; these columns are the state it reads.
--
-- Amounts are stored in cents to keep money off floating point.
-- ============================================================

-- ============================================================
-- Plan and subscription state on the workspace
-- ============================================================

-- Existing rows were seeded as 'trial'; anything else was aspirational.
update public.organisations
   set plan = 'standard'
 where plan in ('starter', 'growth', 'scale', 'enterprise');

alter table public.organisations
  drop constraint if exists organisations_plan_check;

alter table public.organisations
  add constraint organisations_plan_check
  check (plan in ('trial', 'standard'));

alter table public.organisations
  add column if not exists subscription_status text not null default 'none'
    check (subscription_status in ('none', 'active', 'past_due', 'cancelled')),
  add column if not exists payfast_token text,
  add column if not exists current_period_end timestamptz,
  add column if not exists billing_email text,
  add column if not exists billed_seats integer,
  add column if not exists billed_amount_cents integer,
  add column if not exists subscribed_at timestamptz,
  add column if not exists cancelled_at timestamptz;

create unique index if not exists idx_org_payfast_token
  on public.organisations(payfast_token)
  where payfast_token is not null;

create index if not exists idx_org_trial_ends
  on public.organisations(trial_ends_at)
  where subscription_status = 'none';

-- ============================================================
-- billing_events: the audit trail behind every state change
--
-- PayFast retries a notification it did not get a clean 200 for, so
-- the same payment can arrive several times. pf_payment_id is unique
-- and the handler treats a conflict as "already processed" rather
-- than as an error. Rows are kept even after a workspace cancels,
-- because this is the evidence for a disputed charge.
-- ============================================================

create table if not exists public.billing_events (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  source          text not null default 'payfast'
                    check (source in ('payfast', 'manual')),
  event_type      text not null,
  pf_payment_id   text,
  payfast_token   text,
  amount_cents    integer,
  seats           integer,
  status          text,
  raw             jsonb,
  at              timestamptz not null default now()
);

create unique index if not exists idx_billing_pf_payment
  on public.billing_events(pf_payment_id)
  where pf_payment_id is not null;

create index if not exists idx_billing_org_at
  on public.billing_events(organisation_id, at desc);

alter table public.billing_events enable row level security;

-- The owner is the only role with any billing sight. Admins run the
-- register; they have no business seeing what the workspace pays.
drop policy if exists "owner reads billing" on public.billing_events;
create policy "owner reads billing" on public.billing_events
  for select using (public.is_owner_of(organisation_id));

-- Writes arrive from the PayFast notify handler under the service
-- role, which bypasses RLS. No policy grants insert to a signed-in
-- user, so a customer cannot forge a payment for their own workspace.

-- ============================================================
-- Seat count: what a workspace is billed for
--
-- One seat per person on the register. Certifications are unlimited;
-- the headcount is what scales the price.
--
-- Counted in the application with the ordinary tenant-scoped client,
-- deliberately not through a security definer helper. A definer
-- function bypasses RLS by design, so it would have handed any signed
-- in user the headcount of any workspace whose id they could guess,
-- and no amount of application-side filtering would have undone that.
-- ============================================================
