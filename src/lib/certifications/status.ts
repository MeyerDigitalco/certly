import { envOr } from "@/lib/env-shape";
import type { CertStatus } from "@/lib/types/database";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
const MS_PER_DAY = 86_400_000;

/**
 * Whole days between two calendar dates, counted on the calendar rather than
 * on the clock. Both sides are pinned to UTC midnight first, so the answer
 * does not shift when the server runs in a different timezone to the user.
 * The earlier version mixed local midnight with a UTC-parsed expiry, which
 * moved the expired / due-soon boundary by a day anywhere west of Greenwich.
 */
function daysBetween(fromIso: string, toIso: string): number | null {
  const a = ISO_DATE.exec(fromIso);
  const b = ISO_DATE.exec(toIso);
  if (!a || !b) return null;
  const from = Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3]));
  const to = Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3]));
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.round((to - from) / MS_PER_DAY);
}

/** Today in the workspace's timezone, as a plain ISO date. */
export function todayIso(timeZone = "Africa/Johannesburg"): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Compute the status of a single certification.
 *   expiry_date is null                     -> "no_expiry"
 *   expiry_date is before today             -> "expired"
 *   today <= expiry_date <= today + N days  -> "due_soon"
 *   otherwise                               -> "valid"
 *
 * A certificate that expires today is still valid today, which is how a gate
 * reads it. The due-soon window N is per-organisation
 * (organisations.due_soon_days), passed in by the caller. The env var is only
 * a fallback for callers that do not have an org in hand.
 */
export function certStatus(
  expiryIso: string | null,
  dueSoonDays = Number(envOr("DEFAULT_DUE_SOON_DAYS", "30")),
  today: string = todayIso(),
): { status: CertStatus; daysLeft: number | null } {
  if (!expiryIso) return { status: "no_expiry", daysLeft: null };

  const days = daysBetween(today, expiryIso);
  if (days === null) return { status: "no_expiry", daysLeft: null };

  const window = Number.isFinite(dueSoonDays) ? dueSoonDays : 30;
  if (days < 0) return { status: "expired", daysLeft: days };
  if (days <= window) return { status: "due_soon", daysLeft: days };
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
