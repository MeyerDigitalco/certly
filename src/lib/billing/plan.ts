export const CURRENCY = "ZAR";

/** Rands per month for a workspace, before any seats above the included count. */
export const BASE_MONTHLY_CENTS = 99_900;

/** People on the register covered by the base price. */
export const INCLUDED_SEATS = 50;

/** Rands per month for each person above the included count. */
export const EXTRA_SEAT_CENTS = 1_000;

export const TRIAL_DAYS = 14;

export type Plan = "trial" | "standard";

export type SubscriptionStatus =
  | "none"
  | "active"
  | "past_due"
  | "cancelled";

export interface Quote {
  seats: number;
  includedSeats: number;
  extraSeats: number;
  baseCents: number;
  extraCents: number;
  totalCents: number;
}

/**
 * What a workspace costs per month at its current headcount.
 *
 * Certly is not VAT registered, so there is no tax component here and none on
 * any invoice. Add one only once SARS registration is in place, and then it
 * belongs on top of this figure, not inside it.
 */
export function quoteFor(seats: number): Quote {
  const safeSeats = Number.isFinite(seats) ? Math.max(0, Math.floor(seats)) : 0;
  const extraSeats = Math.max(0, safeSeats - INCLUDED_SEATS);
  const extraCents = extraSeats * EXTRA_SEAT_CENTS;
  return {
    seats: safeSeats,
    includedSeats: INCLUDED_SEATS,
    extraSeats,
    baseCents: BASE_MONTHLY_CENTS,
    extraCents,
    totalCents: BASE_MONTHLY_CENTS + extraCents,
  };
}

/**
 * Rands for display: space thousands separator, full stop decimal, matching
 * how PayFast and every South African pricing page render a price. Formatted
 * by hand rather than through toLocaleString, whose output for en-ZA depends
 * on which ICU data the running Node was built with.
 */
export function formatRands(cents: number): string {
  const whole = Math.round(Math.abs(cents));
  const rands = Math.floor(whole / 100);
  const remainder = String(whole % 100).padStart(2, "0");
  const grouped = String(rands).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${cents < 0 ? "-" : ""}R${grouped}.${remainder}`;
}

/** The amount field PayFast expects: rands, two decimals, no separators. */
export function payfastAmount(cents: number): string {
  return (Math.round(cents) / 100).toFixed(2);
}

export type AccessState =
  | "trialing"
  | "trial_expired"
  | "subscribed"
  | "payment_failed"
  | "cancelled";

export interface AccessInput {
  plan: Plan;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: string;
  currentPeriodEnd: string | null;
}

export interface Access {
  state: AccessState;
  canWrite: boolean;
  daysLeft: number | null;
  reason: string;
}

function daysUntil(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  return Math.ceil((then - now.getTime()) / 86_400_000);
}

/**
 * Decide whether a workspace may still be written to.
 *
 * A workspace that stops paying goes read-only, never dark. The register, the
 * CSV exports and the safety file pack stay reachable, because these are the
 * customer's own statutory records and holding them hostage over an invoice is
 * both a bad look for a compliance product and a POPIA problem. What stops is
 * adding and changing data, which is what makes the register go stale and is
 * the actual reason to pay.
 */
export function accessFor(input: AccessInput, now: Date = new Date()): Access {
  const periodDaysLeft = daysUntil(input.currentPeriodEnd, now);

  if (input.subscriptionStatus === "active") {
    return {
      state: "subscribed",
      canWrite: true,
      daysLeft: periodDaysLeft,
      reason: "",
    };
  }

  if (input.subscriptionStatus === "past_due") {
    const stillInPeriod = periodDaysLeft !== null && periodDaysLeft >= 0;
    return {
      state: "payment_failed",
      canWrite: stillInPeriod,
      daysLeft: periodDaysLeft,
      reason: stillInPeriod
        ? "The last debit order did not go through. Update your payment details before the period ends."
        : "The last debit order did not go through, so this workspace is read only. Your records are all still here.",
    };
  }

  if (input.subscriptionStatus === "cancelled") {
    const stillInPeriod = periodDaysLeft !== null && periodDaysLeft >= 0;
    return {
      state: "cancelled",
      canWrite: stillInPeriod,
      daysLeft: periodDaysLeft,
      reason: stillInPeriod
        ? "This subscription is cancelled and runs until the end of the paid period."
        : "This subscription is cancelled, so this workspace is read only. Your records are all still here and you can still export them.",
    };
  }

  const trialDaysLeft = daysUntil(input.trialEndsAt, now);
  if (trialDaysLeft !== null && trialDaysLeft >= 0) {
    return {
      state: "trialing",
      canWrite: true,
      daysLeft: trialDaysLeft,
      reason: "",
    };
  }

  return {
    state: "trial_expired",
    canWrite: false,
    daysLeft: trialDaysLeft,
    reason:
      "The trial has ended, so this workspace is read only. Everything you loaded is still here, and you can still export it and build a safety file pack.",
  };
}

export function isPlan(value: unknown): value is Plan {
  return value === "trial" || value === "standard";
}

export function isSubscriptionStatus(
  value: unknown,
): value is SubscriptionStatus {
  return (
    value === "none" ||
    value === "active" ||
    value === "past_due" ||
    value === "cancelled"
  );
}
