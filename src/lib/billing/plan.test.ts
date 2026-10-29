import { describe, it, expect } from "vitest";
import {
  basePriceCents,
  LIST_BASE_MONTHLY_CENTS,
  quoteFor,
  accessFor,
  formatRands,
  payfastAmount,
  isPlan,
  isSubscriptionStatus,
  INCLUDED_SEATS,
  BASE_MONTHLY_CENTS,
  type AccessInput,
} from "./plan";

const NOW = new Date("2026-09-08T10:00:00Z");

function input(over: Partial<AccessInput> = {}): AccessInput {
  return {
    plan: "trial",
    subscriptionStatus: "none",
    trialEndsAt: "2026-09-20T00:00:00Z",
    currentPeriodEnd: null,
    ...over,
  };
}

describe("quoteFor", () => {
  it("charges the base price for an empty register", () => {
    expect(quoteFor(0).totalCents).toBe(BASE_MONTHLY_CENTS);
    expect(quoteFor(0).extraSeats).toBe(0);
  });

  it("charges nothing extra up to and including the last included seat", () => {
    expect(quoteFor(INCLUDED_SEATS).totalCents).toBe(BASE_MONTHLY_CENTS);
    expect(quoteFor(INCLUDED_SEATS).extraSeats).toBe(0);
    expect(quoteFor(49).extraSeats).toBe(0);
  });

  it("charges ten rand for the fifty first person, not for the fiftieth", () => {
    expect(quoteFor(51).extraSeats).toBe(1);
    expect(quoteFor(51).extraCents).toBe(1_000);
    expect(quoteFor(51).totalCents).toBe(100_900);
  });

  it("scales linearly above the included count", () => {
    expect(quoteFor(100).extraSeats).toBe(50);
    expect(quoteFor(100).totalCents).toBe(BASE_MONTHLY_CENTS + 50_000);
    expect(quoteFor(1_000).totalCents).toBe(BASE_MONTHLY_CENTS + 950_000);
  });

  it("does not go below the base price on nonsense input", () => {
    expect(quoteFor(-10).totalCents).toBe(BASE_MONTHLY_CENTS);
    expect(quoteFor(Number.NaN).totalCents).toBe(BASE_MONTHLY_CENTS);
    expect(quoteFor(12.7).seats).toBe(12);
  });
});

describe("formatRands and payfastAmount", () => {
  it("prints rands with two decimals", () => {
    expect(formatRands(99_900)).toBe("R999.00");
    expect(formatRands(0)).toBe("R0.00");
    expect(formatRands(50)).toBe("R0.50");
  });

  it("groups thousands with a non-breaking space so a price never wraps", () => {
    expect(formatRands(100_900)).toBe("R1\u00A0009.00");
    expect(formatRands(123_456_789)).toBe("R1\u00A0234\u00A0567.89");
    expect(formatRands(100_900)).not.toContain("\u0020");
  });

  it("gives PayFast a bare amount with no symbol or separator", () => {
    expect(payfastAmount(99_900)).toBe("999.00");
    expect(payfastAmount(100_900)).toBe("1009.00");
    expect(payfastAmount(quoteFor(137).totalCents)).toBe("1869.00");
  });
});

describe("accessFor", () => {
  it("lets a workspace inside its trial write", () => {
    const access = accessFor(input(), NOW);
    expect(access.state).toBe("trialing");
    expect(access.canWrite).toBe(true);
    expect(access.daysLeft).toBe(12);
  });

  it("keeps the last day of the trial writable", () => {
    const access = accessFor(
      input({ trialEndsAt: "2026-09-08T23:59:00Z" }),
      NOW,
    );
    expect(access.state).toBe("trialing");
    expect(access.canWrite).toBe(true);
  });

  it("goes read only once the trial has passed", () => {
    const access = accessFor(
      input({ trialEndsAt: "2026-09-07T00:00:00Z" }),
      NOW,
    );
    expect(access.state).toBe("trial_expired");
    expect(access.canWrite).toBe(false);
    expect(access.reason).toContain("still here");
  });

  it("lets an active subscription write regardless of the trial date", () => {
    const access = accessFor(
      input({
        plan: "standard",
        subscriptionStatus: "active",
        trialEndsAt: "2020-01-01T00:00:00Z",
        currentPeriodEnd: "2026-10-08T00:00:00Z",
      }),
      NOW,
    );
    expect(access.state).toBe("subscribed");
    expect(access.canWrite).toBe(true);
    expect(access.daysLeft).toBe(30);
  });

  it("keeps a failed payment writable until the paid period actually ends", () => {
    const inside = accessFor(
      input({
        plan: "standard",
        subscriptionStatus: "past_due",
        currentPeriodEnd: "2026-09-20T00:00:00Z",
      }),
      NOW,
    );
    expect(inside.state).toBe("payment_failed");
    expect(inside.canWrite).toBe(true);

    const after = accessFor(
      input({
        plan: "standard",
        subscriptionStatus: "past_due",
        currentPeriodEnd: "2026-09-01T00:00:00Z",
      }),
      NOW,
    );
    expect(after.state).toBe("payment_failed");
    expect(after.canWrite).toBe(false);
  });

  it("honours the paid period after a cancellation instead of cutting it short", () => {
    const access = accessFor(
      input({
        plan: "standard",
        subscriptionStatus: "cancelled",
        currentPeriodEnd: "2026-09-30T00:00:00Z",
      }),
      NOW,
    );
    expect(access.canWrite).toBe(true);
    expect(access.reason).toContain("end of the paid period");
  });

  it("goes read only once a cancelled period has run out", () => {
    const access = accessFor(
      input({
        plan: "standard",
        subscriptionStatus: "cancelled",
        currentPeriodEnd: "2026-08-31T00:00:00Z",
      }),
      NOW,
    );
    expect(access.canWrite).toBe(false);
    expect(access.reason).toContain("export");
  });

  it("does not throw on a malformed date", () => {
    expect(accessFor(input({ trialEndsAt: "not-a-date" }), NOW).canWrite).toBe(
      false,
    );
    expect(
      accessFor(
        input({ subscriptionStatus: "past_due", currentPeriodEnd: "rubbish" }),
        NOW,
      ).canWrite,
    ).toBe(false);
  });

  it("never leaves a read-only workspace without an explanation", () => {
    const states: AccessInput[] = [
      input({ trialEndsAt: "2026-09-01T00:00:00Z" }),
      input({ subscriptionStatus: "past_due", currentPeriodEnd: "2026-09-01T00:00:00Z" }),
      input({ subscriptionStatus: "cancelled", currentPeriodEnd: "2026-09-01T00:00:00Z" }),
    ];
    for (const state of states) {
      const access = accessFor(state, NOW);
      expect(access.canWrite).toBe(false);
      expect(access.reason.length).toBeGreaterThan(20);
    }
  });
});

describe("billing guards", () => {
  it("recognises only the two plans that exist", () => {
    expect(isPlan("trial")).toBe(true);
    expect(isPlan("standard")).toBe(true);
    for (const bad of ["starter", "growth", "scale", "enterprise", "", null]) {
      expect(isPlan(bad)).toBe(false);
    }
  });

  it("recognises only the four subscription states", () => {
    for (const good of ["none", "active", "past_due", "cancelled"]) {
      expect(isSubscriptionStatus(good)).toBe(true);
    }
    expect(isSubscriptionStatus("trialing")).toBe(false);
    expect(isSubscriptionStatus(undefined)).toBe(false);
  });
});

describe("basePriceCents", () => {
  it("is the list price when nothing overrides it", () => {
    expect(basePriceCents(undefined)).toBe(LIST_BASE_MONTHLY_CENTS);
    expect(basePriceCents("")).toBe(LIST_BASE_MONTHLY_CENTS);
    expect(basePriceCents("   ")).toBe(LIST_BASE_MONTHLY_CENTS);
  });

  it("accepts a lower price for a live payment test", () => {
    expect(basePriceCents("900")).toBe(900);
    expect(basePriceCents(" 900 ")).toBe(900);
    expect(basePriceCents("100")).toBe(100);
  });

  it("refuses to raise the price above the list price", () => {
    // An extra zero must never turn R999 into R9990.
    expect(basePriceCents("999000")).toBe(LIST_BASE_MONTHLY_CENTS);
    expect(basePriceCents(String(LIST_BASE_MONTHLY_CENTS + 1))).toBe(
      LIST_BASE_MONTHLY_CENTS,
    );
  });

  it("refuses anything below one rand, including zero and negatives", () => {
    expect(basePriceCents("0")).toBe(LIST_BASE_MONTHLY_CENTS);
    expect(basePriceCents("99")).toBe(LIST_BASE_MONTHLY_CENTS);
    expect(basePriceCents("-900")).toBe(LIST_BASE_MONTHLY_CENTS);
  });

  it("refuses anything that is not a whole number of cents", () => {
    expect(basePriceCents("abc")).toBe(LIST_BASE_MONTHLY_CENTS);
    expect(basePriceCents("9.5")).toBe(LIST_BASE_MONTHLY_CENTS);
    expect(basePriceCents("1e3")).toBe(LIST_BASE_MONTHLY_CENTS);
    expect(basePriceCents("0x384")).toBe(LIST_BASE_MONTHLY_CENTS);
    expect(basePriceCents("+900")).toBe(LIST_BASE_MONTHLY_CENTS);
    expect(basePriceCents("NaN")).toBe(LIST_BASE_MONTHLY_CENTS);
    expect(basePriceCents("Infinity")).toBe(LIST_BASE_MONTHLY_CENTS);
  });

  it("quotes and formats the overridden price consistently", () => {
    // What the billing page shows and what PayFast is asked for come from the
    // same number, so a test charge cannot display one price and bill another.
    const q = quoteFor(10);
    expect(q.baseCents).toBe(BASE_MONTHLY_CENTS);
    expect(q.totalCents).toBe(BASE_MONTHLY_CENTS);
    expect(payfastAmount(q.totalCents)).toBe(
      (BASE_MONTHLY_CENTS / 100).toFixed(2),
    );
  });
});
