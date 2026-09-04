import type { CertStatus } from "@/lib/types/database";

/**
 * Compute the status of a single certification.
 *   expiry_date is null                     -> "no_expiry"
 *   today > expiry_date                     -> "expired"
 *   today <= expiry_date <= today + N days  -> "due_soon"
 *   otherwise                                -> "valid"
 *
 * The due-soon window N is per-organisation (organisations.due_soon_days),
 * passed in by the caller. The env var is only a fallback for callers that
 * do not have an org in hand.
 */
export function certStatus(
  expiryIso: string | null,
  dueSoonDays = Number(process.env.DEFAULT_DUE_SOON_DAYS ?? 30),
): { status: CertStatus; daysLeft: number | null } {
  if (!expiryIso) return { status: "no_expiry", daysLeft: null };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiryIso + "T00:00:00Z");
  const days = Math.floor(
    (exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days < 0) return { status: "expired", daysLeft: days };
  if (days <= dueSoonDays) return { status: "due_soon", daysLeft: days };
  return { status: "valid", daysLeft: days };
}

/** Human-readable label for a status. */
export function statusLabel(s: CertStatus): string {
  return {
    expired: "Expired",
    due_soon: "Due soon",
    valid: "Valid",
    no_expiry: "No expiry",
  }[s];
}
