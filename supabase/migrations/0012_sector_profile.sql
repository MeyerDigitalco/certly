-- ============================================================
-- Certly - Migration 0012: sector profile
--
-- A workspace declares which world it works in. The product is the same
-- for both; what changes is the starting point. A mining contractor gets
-- TEBA, Mines Legal Liability and Section Cards seeded on day one and the
-- MQA as its default SETA. A general-industry employer gets a catalogue
-- that does not mention a shaft, and no SETA default, because theirs
-- depends on what they do.
--
-- Nothing is hidden by sector. Every workspace keeps every report and
-- every training type it chooses to add. The sector can be changed in
-- settings at any time; only the seed list is decided at signup.
--
-- Existing workspaces were all seeded with the mining catalogue, so they
-- are labelled mining here rather than left on the new default.
-- ============================================================

alter table public.organisations
  add column if not exists sector text not null default 'general'
    check (sector in ('mining', 'general'));

update public.organisations set sector = 'mining' where sector = 'general';

-- ============================================================
-- Seeds per sector
-- ============================================================

create or replace function public.seed_training_types(p_org uuid, p_sector text)
returns void language plpgsql security definer set search_path = public as $$
declare
  names text[];
  i int;
begin
  if p_sector = 'mining' then
    names := array[
      'MEDICAL','INDUCTION','ONSIDE INDUCTION','TEBA','FIRST AID LEVEL 1',
      'POWER TOOLS','ENGINEERING HAND TOOLS','FIRE FIGHTING','HIRA',
      'DRUG TEST AWARENESS','SAQCC','WORKING AT HEIGHTS','SUPERVISOR',
      'LEGAL LIABILITY','FIRST AID LEVEL 2','SHE REP','HAZCHEM',
      'SABS 1475 REFRESHERS','MULTIMETER NON UNIT','SECTION CARDS',
      'CONFINED SPACE','CONVEYOR BELT SAFETY AWARENESS',
      'MINES LEGAL LIABILITY','GAS/ARC WELDING'
    ];
  else
    names := array[
      'MEDICAL','INDUCTION','FIRST AID LEVEL 1','FIRE FIGHTING','HIRA',
      'WORKING AT HEIGHTS','SHE REP','LEGAL LIABILITY','SUPERVISOR',
      'POWER TOOLS','HAZCHEM','CONFINED SPACE','FORKLIFT OPERATOR',
      'PDP','FIRST AID LEVEL 2','SCAFFOLDING','EVACUATION WARDEN',
      'FOOD SAFETY','BASIC RIGGING','GAS/ARC WELDING'
    ];
  end if;

  for i in 1..array_length(names, 1) loop
    insert into public.training_types (organisation_id, name, sort_order)
    values (p_org, names[i], i * 10)
    on conflict do nothing;
  end loop;
end $$;

-- The one-argument form stays for anything still calling it and seeds the
-- catalogue that argument always meant.
create or replace function public.seed_training_types(p_org uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.seed_training_types(p_org, 'mining');
end $$;

revoke execute on function public.seed_training_types(uuid, text) from public;
grant execute on function public.seed_training_types(uuid, text) to service_role;

-- ============================================================
-- Provisioning takes the sector
-- ============================================================

create or replace function public.provision_organisation(
  p_slug text,
  p_name text,
  p_user_id uuid,
  p_sector text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_sector text;
begin
  v_sector := case when p_sector in ('mining', 'general') then p_sector else 'general' end;

  insert into public.organisations (slug, name, sector)
  values (lower(p_slug), p_name, v_sector)
  returning id into v_org_id;

  insert into public.org_members (organisation_id, user_id, role)
  values (v_org_id, p_user_id, 'owner');

  perform public.seed_training_types(v_org_id, v_sector);

  return v_org_id;
end $$;

create or replace function public.provision_organisation(
  p_slug text,
  p_name text,
  p_user_id uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  return public.provision_organisation(p_slug, p_name, p_user_id, 'general');
end $$;

revoke execute on function public.provision_organisation(text, text, uuid, text) from public;
grant execute on function public.provision_organisation(text, text, uuid, text) to service_role;
revoke execute on function public.provision_organisation(text, text, uuid) from public;
grant execute on function public.provision_organisation(text, text, uuid) to service_role;

-- Sector is a workspace preference, not a billing field, so the owner may
-- change it. The billing guard from 0011 does not list it and so allows it.
comment on column public.organisations.sector is
  'mining or general. Decides the seeded training catalogue and defaults; hides nothing.';
