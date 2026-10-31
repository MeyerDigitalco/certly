-- Workspaces that are never billed.
--
-- Our own workspace sat on a fourteen day trial like any customer, so the
-- product we run the business on was two weeks away from going read only,
-- and the only ways out were paying ourselves through PayFast or pushing the
-- trial date forward every fortnight and eventually forgetting.
--
-- The same flag covers a comped account: a pilot customer, a partner, or
-- somebody whose first months were agreed as free. Those arrangements
-- otherwise get implemented as a trial date nobody remembers moving.

alter table public.organisations
  add column if not exists billing_exempt boolean not null default false;

comment on column public.organisations.billing_exempt is
  'True for our own and comped workspaces. accessFor checks it before anything else, so the workspace is never gated by a trial or a subscription state.';

-- Only the service role may set it. The hardening trigger from 0011 already
-- refuses a member who tries to change their own plan or subscription over
-- REST; this column needs the same protection or an owner could simply
-- switch their own billing off.
create or replace function public.guard_billing_exempt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.billing_exempt is distinct from old.billing_exempt
     and current_setting('role', true) is distinct from 'service_role'
     and auth.role() is distinct from 'service_role'
  then
    raise exception 'billing_exempt may only be changed by the service role';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_billing_exempt on public.organisations;
create trigger trg_guard_billing_exempt
  before update on public.organisations
  for each row execute function public.guard_billing_exempt();

revoke execute on function public.guard_billing_exempt() from public;
