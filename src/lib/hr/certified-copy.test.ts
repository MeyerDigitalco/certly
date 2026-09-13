import { describe, it, expect } from "vitest";
import {
  certifiedCopyStatus,
  isCertifiedCopyProblem,
  CERTIFIED_COPY_MAX_DAYS,
  CERTIFIED_COPY_WARN_DAYS,
} from "./certified-copy";

const TODAY = "2026-09-08";

function daysAgo(days: number): string {
  const base = Date.UTC(2026, 8, 8);
  return new Date(base - days * 86_400_000).toISOString().slice(0, 10);
}

describe("certifiedCopyStatus", () => {
  it("reports a missing file before it reports a missing date", () => {
    const check = certifiedCopyStatus(daysAgo(10), false, TODAY);
    expect(check.state).toBe("missing");
    expect(check.label).toContain("No identity copy");
  });

  it("reports a file with no certification date as missing", () => {
    expect(certifiedCopyStatus(null, true, TODAY).state).toBe("missing");
    expect(certifiedCopyStatus("", true, TODAY).state).toBe("missing");
  });

  it("counts a copy certified today as fresh", () => {
    const check = certifiedCopyStatus(TODAY, true, TODAY);
    expect(check.state).toBe("fresh");
    expect(check.ageDays).toBe(0);
    expect(check.daysLeft).toBe(CERTIFIED_COPY_MAX_DAYS);
  });

  it("holds fresh right up to the warning threshold", () => {
    expect(certifiedCopyStatus(daysAgo(74), true, TODAY).state).toBe("fresh");
    expect(
      certifiedCopyStatus(daysAgo(CERTIFIED_COPY_WARN_DAYS), true, TODAY).state,
    ).toBe("expiring");
  });

  it("is still acceptable on the ninetieth day and stale on the ninety first", () => {
    const lastGood = certifiedCopyStatus(
      daysAgo(CERTIFIED_COPY_MAX_DAYS),
      true,
      TODAY,
    );
    expect(lastGood.state).toBe("expiring");
    expect(lastGood.daysLeft).toBe(0);

    const tooOld = certifiedCopyStatus(
      daysAgo(CERTIFIED_COPY_MAX_DAYS + 1),
      true,
      TODAY,
    );
    expect(tooOld.state).toBe("stale");
    expect(tooOld.daysLeft).toBe(-1);
  });

  it("treats a future date as a typo rather than a very fresh copy", () => {
    const check = certifiedCopyStatus("2026-12-01", true, TODAY);
    expect(check.state).toBe("missing");
    expect(check.label).toContain("future");
  });

  it("does not throw on a malformed date", () => {
    expect(certifiedCopyStatus("not-a-date", true, TODAY).state).toBe("missing");
    expect(certifiedCopyStatus("2026-13", true, TODAY).state).toBe("missing");
  });

  it("always explains itself in words a supervisor can act on", () => {
    for (const age of [0, 30, 80, 120]) {
      const check = certifiedCopyStatus(daysAgo(age), true, TODAY);
      expect(check.label.length).toBeGreaterThan(10);
    }
  });
});

describe("isCertifiedCopyProblem", () => {
  it("counts missing and stale as problems, not expiring", () => {
    expect(isCertifiedCopyProblem("missing")).toBe(true);
    expect(isCertifiedCopyProblem("stale")).toBe(true);
    expect(isCertifiedCopyProblem("expiring")).toBe(false);
    expect(isCertifiedCopyProblem("fresh")).toBe(false);
  });
});
