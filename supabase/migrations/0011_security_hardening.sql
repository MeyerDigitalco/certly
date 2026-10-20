-- ============================================================
-- Certly - Migration 0011: security hardening
--
-- Findings from an adversarial review of the schema. The threat model is
-- an authenticated user of a legitimate workspace holding the public anon
-- key, which is in the browser bundle by design, talking straight to the
-- PostgREST API and ignoring the application entirely. Anything the
-- database permits, that user can do.
--
-- Four real problems, fixed below:
--
--   1. Every SECURITY DEFINER function was executable by PUBLIC, which
--      PostgREST exposes as an RPC endpoint. provision_organisation could
--      be called by an unauthenticated caller to mint workspaces and owner
--      memberships for arbitrary user ids.
--
--   2. The owner of a workspace could update any column of their own
--      organisations row, including plan, subscription_status and
--      current_period_end. The billing gate reads exactly those columns, so
--      an owner could grant themselves a paid subscription over REST.
--
--   3. certifications, onboarding_candidates and extraction_drafts had no
--      guarantee that a referenced employee or training type belonged to
--      the same workspace, and the unique constraint on certifications was
--      global rather than per workspace. A user who learned another
--      workspace's row ids could permanently occupy a slot in it.
--
--   4. Role changes, billing changes and invitations were not audited, so
--      an owner could promote an account, read the register and demote it
--      again with nothing written down.
-- ============================================================

-- ============================================================
-- 1. Definer functions are not public RPC endpoints
--
-- Postgres grants EXECUTE to PUBLIC by default and PostgREST publishes
-- anything the caller may execute, so a definer function with no revoke is
-- an unauthenticated endpoint.
-- ============================================================

revoke execute on function public.provision_organisation(text, text, uuid)
  from public;
revoke execute on function public.seed_training_types(uuid)
  from public;

-- Signup calls provision_organisation through the service-role client, and
-- that role reached it only through the PUBLIC grant just removed, so it
-- has to be granted back explicitly or signup stops working entirely.
grant execute on function public.provision_organisation(text, text, uuid)
  to service_role;
grant execute on function public.seed_training_types(uuid)
  to service_role;

-- The membership helpers stay callable. RLS policies evaluate them as the
-- calling user, and each one answers only about auth.uid(), so they leak
-- nothing whatever argument is passed. Listed here so the decision is
-- visible rather than assumed.
grant execute on function public.is_member_of(uuid) to authenticated;
grant execute on function public.is_admin_of(uuid) to authenticated;
grant execute on function public.is_owner_of(uuid) to authenticated;

-- ============================================================
-- 2. Billing columns are writable only by the payment process
--
-- RLS cannot restrict columns, so this is a trigger. PostgREST switches
-- role per request, so the role the trigger runs under tells us who is
-- writing: service_role for the webhook and the cron, authenticated for a
-- person, postgres for a migration.
-- ============================================================

create or replace function public.guard_billing_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if new.plan is distinct from old.plan
     or new.subscription_status is distinct from old.subscription_status
     or new.payfast_token is distinct from old.payfast_token
     or new.current_period_end is distinct from old.current_period_end
     or new.billed_seats is distinct from old.billed_seats
     or new.billed_amount_cents is distinct from old.billed_amount_cents
     or new.subscribed_at is distinct from old.subscribed_at
     or new.cancelled_at is distinct from old.cancelled_at
     or new.trial_ends_at is distinct from old.trial_ends_at
  then
    raise exception 'billing fields are set by the payment process, not by a workspace';
  end if;

  return new;
end $$;

drop trigger if exists trg_guard_billing on public.organisations;
create trigger trg_guard_billing
  before update on public.organisations
  for each row execute function public.guard_billing_columns();

-- ============================================================
-- 3. A child row cannot reference a parent in another workspace
--
-- TG_ARGV is read in pairs: the column on this table, then the table it
-- points at. A null reference is allowed; a reference to a row in another
-- workspace is refused.
-- ============================================================

create or replace function public.child_row_same_org()
returns trigger
language plpgsql
as $$
declare
  i int;
  v_col text;
  v_tbl text;
  v_id uuid;
  v_ok boolean;
begin
  i := 0;
  while i < tg_nargs loop
    v_col := tg_argv[i];
    v_tbl := tg_argv[i + 1];

    execute format('select ($1).%I', v_col) into v_id using new;

    if v_id is not null then
      execute format(
        'select exists (select 1 from public.%I t where t.id = $1 and t.organisation_id = $2)',
        v_tbl
      ) into v_ok using v_id, new.organisation_id;

      if not v_ok then
        raise exception '%.% references a row in a different workspace',
          tg_table_name, v_col;
      end if;
    end if;

    i := i + 2;
  end loop;
  return new;
end $$;

drop trigger if exists trg_cert_same_org on public.certifications;
create trigger trg_cert_same_org
  before insert or update on public.certifications
  for each row execute function public.child_row_same_org(
    'employee_id', 'employees', 'training_type_id', 'training_types'
  );

drop trigger if exists trg_onboarding_employee_same_org on public.onboarding_candidates;
create trigger trg_onboarding_employee_same_org
  before insert or update on public.onboarding_candidates
  for each row execute function public.child_row_same_org('employee_id', 'employees');

drop trigger if exists trg_draft_employee_same_org on public.extraction_drafts;
create trigger trg_draft_employee_same_org
  before insert or update on public.extraction_drafts
  for each row execute function public.child_row_same_org('employee_match_id', 'employees');

-- The uniqueness of a certificate per person per training type was global
-- rather than per workspace, so a row written against another workspace's
-- employee id would occupy that workspace's slot forever. Scoping the
-- constraint to the organisation is what was always meant.
alter table public.certifications
  drop constraint if exists certifications_employee_id_training_type_id_key;

create unique index if not exists idx_certs_unique_per_org
  on public.certifications(organisation_id, employee_id, training_type_id);

-- ============================================================
-- 4. Audit the tables where privilege and money change
--
-- log_audit reads organisation_id off the row, which organisations does
-- not have: its own id is the workspace. It therefore needs its own
-- function rather than the shared one, and getting that wrong would make
-- every subscription update fail.
-- ============================================================

create or replace function public.log_audit_org()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_before jsonb;
  v_after jsonb;
begin
  if tg_op = 'INSERT' then
    v_before := null; v_after := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    v_before := to_jsonb(old); v_after := to_jsonb(new);
    if v_before = v_after then return null; end if;
  else
    v_before := to_jsonb(old); v_after := null;
  end if;

  insert into public.audit_log
    (organisation_id, actor, action, table_name, row_id, before, after)
  values (
    coalesce(new.id, old.id),
    auth.uid(),
    tg_op,
    tg_table_name,
    coalesce(new.id, old.id),
    v_before,
    v_after
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

revoke execute on function public.log_audit_org() from public;

drop trigger if exists trg_audit_organisations on public.organisations;
create trigger trg_audit_organisations
  after insert or update on public.organisations
  for each row execute function public.log_audit_org();

drop trigger if exists trg_audit_org_members on public.org_members;
create trigger trg_audit_org_members
  after insert or update or delete on public.org_members
  for each row execute function public.log_audit();

drop trigger if exists trg_audit_invitations on public.invitations;
create trigger trg_audit_invitations
  after insert or update or delete on public.invitations
  for each row execute function public.log_audit();
