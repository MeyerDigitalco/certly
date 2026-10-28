-- Per workspace rate limiting for endpoints that cost money to serve.
--
-- The AI extraction action calls a paid API with a file of up to 15 MB. Role
-- and billing checks say who may call it, not how often, so an admin of any
-- workspace could previously loop it without bound. Serverless instances do
-- not share memory, so the counter has to live in the database to mean
-- anything.

create table if not exists public.rate_limits (
  organisation_id  uuid not null references public.organisations(id) on delete cascade,
  bucket           text not null,
  window_start     timestamptz not null,
  count            integer not null default 0 check (count >= 0),
  primary key (organisation_id, bucket, window_start)
);

create index if not exists idx_rate_limits_sweep
  on public.rate_limits(window_start);

alter table public.rate_limits enable row level security;

-- No policies. The table is reached only through consume_rate_limit below,
-- which is security definer. A member has no reason to read or edit a counter
-- that exists to constrain them.

/**
 * Take one unit from a workspace's bucket for the current window.
 *
 * Returns true when the call may proceed and false when the workspace has
 * spent its allowance. The increment and the test happen in one statement, so
 * two concurrent calls cannot both see the same remaining unit.
 *
 * Security definer because the table has no policies, so membership is
 * verified here instead. Execute is revoked from public: a definer function
 * left executable by public is an unauthenticated endpoint on PostgREST.
 */
create or replace function public.consume_rate_limit(
  p_org             uuid,
  p_bucket          text,
  p_limit           integer,
  p_window_seconds  integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_count  integer;
begin
  if not public.is_member_of(p_org) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;

  if p_limit <= 0 or p_window_seconds <= 0 then
    raise exception 'limit and window must be positive';
  end if;

  v_window := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limits (organisation_id, bucket, window_start, count)
  values (p_org, p_bucket, v_window, 1)
  on conflict (organisation_id, bucket, window_start)
    do update set count = rate_limits.count + 1
  returning rate_limits.count into v_count;

  -- Sweep occasionally rather than on every call. Expired rows cost nothing
  -- to leave for a while and a delete on every request would not pay for
  -- itself.
  if random() < 0.01 then
    delete from public.rate_limits
     where window_start < now() - interval '1 day';
  end if;

  return v_count <= p_limit;
end;
$$;

revoke execute on function public.consume_rate_limit(uuid, text, integer, integer) from public;
grant execute on function public.consume_rate_limit(uuid, text, integer, integer) to authenticated;
grant execute on function public.consume_rate_limit(uuid, text, integer, integer) to service_role;

comment on table public.rate_limits is
  'Counters for paid endpoints, one row per workspace per bucket per window. Written only by consume_rate_limit.';
