-- Backstops against a record being created twice.
--
-- Most creates are already protected by a natural key: an employee by
-- identification number, a certificate by person and training type, a
-- training type by name, a labour plan by its own key. Three tables had no
-- such key, so a second write, from a double-clicked button, a retried
-- request or a refreshed form, simply landed twice.
--
-- Two of the three get a key here. Company documents deliberately do not: two
-- documents may legitimately share a title and category, so that one is
-- handled in the form instead.

-- An absence spell for the same person, over the same dates, for the same
-- reason, is the same absence. There is no reading of the data where two of
-- those rows mean something different from one.
create unique index if not exists idx_absence_unique_spell
  on public.absences(organisation_id, employee_id, starts_on, ends_on, reason);

-- Two candidates with one identification number are one candidate, the same
-- rule the employees table already applies. Candidates without a number yet
-- are left alone, because that is a normal state early in screening.
create unique index if not exists idx_candidate_unique_id
  on public.onboarding_candidates(organisation_id, id_number)
  where id_number is not null and id_number <> '';

comment on index public.idx_absence_unique_spell is
  'Stops the same absence being recorded twice. createAbsence relies on this to make a repeated submission do nothing rather than duplicate.';
