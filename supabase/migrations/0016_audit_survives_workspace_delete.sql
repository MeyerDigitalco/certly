-- Let a workspace actually be closed.
--
-- Deleting an organisation cascades every tenant table. Each of those tables
-- carries an after-delete audit trigger, and the trigger wrote an audit row
-- stamped with the organisation id. By then the organisation row was already
-- gone, so the insert failed the foreign key on audit_log and took the whole
-- delete down with it:
--
--   23503: insert or update on table "audit_log" violates foreign key
--   constraint "audit_log_organisation_id_fkey"
--
-- The effect was worse than a refusal. closeAccount removes the stored files
-- before deleting the rows, so a workspace could be left with its register
-- intact and every certificate and identity document already destroyed.
--
-- The guard: write no audit row once the organisation has gone. Nothing is
-- lost by that. The audit log is scoped to a workspace and cascades with it,
-- so a record written during its deletion is deleted in the same statement.
-- Ordinary deletes, where the workspace stays, are audited exactly as before.

create or replace function public.log_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_row uuid;
  v_before jsonb;
  v_after jsonb;
begin
  if TG_OP = 'INSERT' then
    v_row := (row_to_json(new)->>'id')::uuid;
    v_org := (row_to_json(new)->>'organisation_id')::uuid;
    v_before := null; v_after := to_jsonb(new);
  elsif TG_OP = 'UPDATE' then
    v_row := (row_to_json(new)->>'id')::uuid;
    v_org := (row_to_json(new)->>'organisation_id')::uuid;
    v_before := to_jsonb(old); v_after := to_jsonb(new);
    if v_before = v_after then return null; end if;
  else
    v_row := (row_to_json(old)->>'id')::uuid;
    v_org := (row_to_json(old)->>'organisation_id')::uuid;
    v_before := to_jsonb(old); v_after := null;
  end if;

  -- The workspace is being destroyed and this row is going with it. Auditing
  -- it would write into a table that is already being emptied, and fail.
  if v_org is null
     or not exists (select 1 from public.organisations o where o.id = v_org)
  then
    if TG_OP = 'DELETE' then return old; end if;
    return new;
  end if;

  insert into public.audit_log (organisation_id, actor, action, table_name, row_id, before, after)
  values (v_org, auth.uid(), TG_OP, TG_TABLE_NAME, v_row, v_before, v_after);

  if TG_OP = 'DELETE' then return old; end if;
  return new;
end $$;

revoke execute on function public.log_audit() from public;

comment on function public.log_audit() is
  'Audit trigger for tenant tables. Skips writing when the owning organisation no longer exists, so closing a workspace is not blocked by its own audit trail.';
