-- Suggestions sent from inside a workspace.
--
-- The people who find the gaps in this product are the ones using it at a
-- gate on a Monday morning, and they will not open a support portal to tell
-- anyone. A box on the screen they are already looking at is the only channel
-- that gets used.
--
-- The row is the record and the email is the notification, in that order. A
-- suggestion that was written down but not delivered can still be read later;
-- one that was emailed and not stored is gone the moment the inbox is tidied.

create table if not exists public.suggestions (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations(id) on delete cascade,
  submitted_by     uuid references auth.users(id) on delete set null,
  body             text not null check (char_length(btrim(body)) between 5 and 4000),
  -- Where they were when they wrote it, which is usually the real subject of
  -- the suggestion and is never typed accurately by hand.
  context          text,
  created_at       timestamptz not null default now()
);

create index if not exists idx_suggestions_org_recent
  on public.suggestions(organisation_id, created_at desc);

alter table public.suggestions enable row level security;

-- Any member may write one, including a viewer. Somebody who can only read
-- the register still has opinions about it, and a role check here would
-- silence exactly the people furthest from the owner.
drop policy if exists "member writes suggestions" on public.suggestions;
create policy "member writes suggestions" on public.suggestions
  for insert with check (
    public.is_member_of(organisation_id)
    and submitted_by = auth.uid()
  );

-- Readable by the workspace that wrote them, so a team can see what has
-- already been asked for rather than sending it four times.
drop policy if exists "member reads suggestions" on public.suggestions;
create policy "member reads suggestions" on public.suggestions
  for select using (public.is_member_of(organisation_id));

-- No update and no delete policy. A suggestion is a sent message: editing
-- one after the email has gone out makes the stored copy disagree with the
-- copy that was received.

comment on table public.suggestions is
  'Product suggestions sent from inside a workspace. Insert only; the stored row is the record of what was sent.';
