-- Correct the guard added in 0018.
--
-- That version allowed only the service role to change billing_exempt, which
-- also locked out the SQL editor, where the connection is postgres rather
-- than service_role. The flag could then be set from nowhere except a
-- deployed build, which is the wrong failure: the one time it is needed most
-- is when a deploy is broken.
--
-- Blocking postgres bought nothing anyway. A superuser that cannot update
-- the column can drop this trigger in one statement. The real threat is the
-- roles reachable over PostgREST with somebody's session, so those are what
-- the guard names, and everything else is already trusted.

create or replace function public.guard_billing_exempt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.billing_exempt is distinct from old.billing_exempt
     and auth.role() in ('authenticated', 'anon')
  then
    raise exception
      'billing_exempt may not be changed by a signed-in user';
  end if;
  return new;
end;
$$;

comment on function public.guard_billing_exempt() is
  'Stops an owner switching their own billing off over PostgREST. Allows the service role, the SQL editor and any maintenance connection.';
