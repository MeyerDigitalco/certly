-- ============================================================
-- Certly - Migration 0007: invitations
--
-- Until now an owner typed an email address and that person was a
-- member of the workspace, immediately, without ever agreeing to it.
-- For an account that already existed this was worse than rude: it
-- silently attached somebody else's login to a workspace full of
-- other people's identity numbers, and the first they knew of it was
-- a new workspace appearing in their list.
--
-- An invitation is now a claim on an email address that becomes a
-- membership only when the person holding that address accepts it.
--
-- The token is stored hashed. An invitation row is readable by every
-- owner and admin of the workspace that issued it, so storing the raw
-- token would let one admin accept another person's invitation. The
-- raw token exists only in the link the owner shares.
-- ============================================================

create table if not exists public.invitations (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  email           text not null,
  role            text not null default 'admin'
                    check (role in ('owner', 'admin', 'viewer')),
  token_hash      text not null unique,
  invited_by      uuid references public.profiles(id) on delete set null,
  expires_at      timestamptz not null default (now() + interval '14 days'),
  accepted_at     timestamptz,
  accepted_by     uuid references public.profiles(id) on delete set null,
  revoked_at      timestamptz,
  created_at      timestamptz not null default now()
);

-- One live invitation per address per workspace. A second invite to
-- the same person replaces the first rather than stacking up.
create unique index if not exists idx_invitation_live
  on public.invitations(organisation_id, lower(email))
  where accepted_at is null and revoked_at is null;

create index if not exists idx_invitation_org
  on public.invitations(organisation_id, created_at desc);

alter table public.invitations enable row level security;

-- Owners and admins see the invitations their workspace issued, so
-- the roster screen can show what is outstanding.
drop policy if exists "org reads invitations" on public.invitations;
create policy "org reads invitations" on public.invitations
  for select using (public.is_admin_of(organisation_id));

-- Only owners issue and withdraw them.
drop policy if exists "owner writes invitations" on public.invitations;
create policy "owner writes invitations" on public.invitations
  for all using (public.is_owner_of(organisation_id))
         with check (public.is_owner_of(organisation_id));

-- Acceptance runs under the service role after the application has
-- matched the token to the signed-in user's own email address. No
-- policy lets a signed-in user write a membership for themselves.

-- ============================================================
-- Existing memberships are left alone
--
-- Backfilling invitations for people already in a workspace would
-- either lock out colleagues who are legitimately working today, or
-- manufacture a consent record for something they never agreed to.
-- Neither is honest. The rule applies from here forward.
-- ============================================================
