import { todayIso } from "@/lib/certifications/status";

/**
 * How old a certified copy may be before a client rejects it.
 *
 * Most South African mines and large contractors want a certified copy of an
 * identity document that was certified within the last three months. The rule
 * is not statutory, it is a house rule that varies by client, but three months
 * is the common denominator and the one that gets packs sent back.
 *
 * Ninety days rather than three calendar months, deliberately. A pack assembled
 * on the ninety first day is already an argument at the gate, and rounding in
 * the customer's favour here would be rounding against them at the desk.
 */
export const CERTIFIED_COPY_MAX_DAYS = 90;

/** Flag it before it lapses, so there is time to walk to a police station. */
export const CERTIFIED_COPY_WARN_DAYS = 75;

export type CertifiedCopyState = "missing" | "stale" | "expiring" | "fresh";

export interface CertifiedCopyCheck {
  state: CertifiedCopyState;
  ageDays: number | null;
  daysLeft: number | null;
  label: string;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
const MS_PER_DAY = 86_400_000;

function parseIso(value: string): number | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  return Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
}

/**
 * How a certified copy stands today. Dates are compared on the calendar in
 * South African time, matching how every other expiry in Certly is counted.
 */
export function certifiedCopyStatus(
  certifiedAt: string | null | undefined,
  hasFile: boolean = true,
  today: string = todayIso(),
): CertifiedCopyCheck {
  if (!hasFile) {
    return {
      state: "missing",
      ageDays: null,
      daysLeft: null,
      label: "No identity copy on file",
    };
  }

  if (!certifiedAt) {
    return {
      state: "missing",
      ageDays: null,
      daysLeft: null,
      label: "Certification date not recorded",
    };
  }

  const from = parseIso(certifiedAt);
  const to = parseIso(today);
  if (from === null || to === null) {
    return {
      state: "missing",
      ageDays: null,
      daysLeft: null,
      label: "Certification date not recorded",
    };
  }

  const ageDays = Math.round((to - from) / MS_PER_DAY);
  const daysLeft = CERTIFIED_COPY_MAX_DAYS - ageDays;

  // A date in the future is a typo, not a fresh copy.
  if (ageDays < 0) {
    return {
      state: "missing",
      ageDays,
      daysLeft: null,
      label: "Certification date is in the future",
    };
  }

  if (ageDays > CERTIFIED_COPY_MAX_DAYS) {
    return {
      state: "stale",
      ageDays,
      daysLeft,
      label: `Certified ${ageDays} days ago, most clients want under ${CERTIFIED_COPY_MAX_DAYS}`,
    };
  }

  if (ageDays >= CERTIFIED_COPY_WARN_DAYS) {
    return {
      state: "expiring",
      ageDays,
      daysLeft,
      label: `Certified ${ageDays} days ago, needs recertifying within ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
    };
  }

  return {
    state: "fresh",
    ageDays,
    daysLeft,
    label: `Certified ${ageDays} day${ageDays === 1 ? "" : "s"} ago`,
  };
}

export function isCertifiedCopyProblem(state: CertifiedCopyState): boolean {
  return state === "missing" || state === "stale";
}

/**
 * The date a copy stops being acceptable, so a renewals list can show a
 * deadline in the same column as every other expiry rather than showing the
 * date it was certified, which reads as the opposite of what it means.
 */
export function recertifyBy(certifiedAt: string | null): string | null {
  if (!certifiedAt) return null;
  const from = parseIso(certifiedAt);
  if (from === null) return null;
  return new Date(from + CERTIFIED_COPY_MAX_DAYS * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}
