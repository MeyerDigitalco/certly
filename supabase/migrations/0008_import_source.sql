-- ============================================================
-- Certly - Migration 0008: bulk import provenance
--
-- certifications.source recorded whether a record was typed in or
-- read off a scanned document. Bulk import adds a third origin, and
-- it is worth distinguishing: a certificate that arrived in a
-- spreadsheet has never been checked against a piece of paper by
-- anyone at Certly or by the person importing it, and when a client
-- disputes a record that provenance is the answer.
-- ============================================================

alter table public.certifications
  drop constraint if exists certifications_source_check;

alter table public.certifications
  add constraint certifications_source_check
  check (source in ('manual', 'extracted', 'import'));
