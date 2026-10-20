import { describe, it, expect } from "vitest";
import {
  TERMINATION_REASONS,
  terminationClass,
  terminationLabel,
  isTerminationReason,
  periodFor,
  parsePeriod,
  previousPeriod,
  inPeriod,
  ageOn,
  officialRetirementDate,
  siteOf,
  UNASSIGNED_SITE,
  eeReportingYear,
  isForeignNational,
  overlapDays,
  setaYearFor,
  setaYearRange,
} from "./operations";

describe("termination reasons", () => {
  it("puts the three the client blames the contractor for on the fault side", () => {
    expect(terminationClass("resignation")).toBe("fault");
    expect(terminationClass("dismissal")).toBe("fault");
    expect(terminationClass("abscondment")).toBe("fault");
  });

  it("puts the five nobody chose on the no fault side", () => {
    for (const r of [
      "deceased",
      "retirement",
      "medical_incapacity",
      "fixed_term_end",
      "retrenchment",
    ] as const) {
      expect(terminationClass(r)).toBe("no_fault");
    }
  });

  it("covers every reason exactly once", () => {
    const values = TERMINATION_REASONS.map((r) => r.value);
    expect(new Set(values).size).toBe(values.length);
    expect(values).toHaveLength(8);
  });

  it("labels and guards", () => {
    expect(terminationLabel("fixed_term_end")).toContain("contract");
    expect(terminationLabel(null)).toBe("");
    expect(isTerminationReason("dismissal")).toBe(true);
    expect(isTerminationReason("fired")).toBe(false);
  });
});

describe("periods", () => {
  it("builds a calendar month with the right last day", () => {
    expect(periodFor(2026, 2)).toMatchObject({
      start: "2026-02-01",
      end: "2026-02-28",
      label: "February 2026",
    });
    expect(periodFor(2028, 2).end).toBe("2028-02-29");
    expect(periodFor(2026, 12).end).toBe("2026-12-31");
  });

  it("parses YYYY-MM and clamps nonsense", () => {
    expect(parsePeriod("2026-09").label).toBe("September 2026");
    expect(parsePeriod("2026-9").label).toBe("September 2026");
    expect(periodFor(2026, 13).month).toBe(12);
    expect(periodFor(2026, 0).month).toBe(1);
  });

  it("falls back to a real month rather than throwing", () => {
    const p = parsePeriod(null);
    expect(p.month).toBeGreaterThanOrEqual(1);
    expect(p.month).toBeLessThanOrEqual(12);
  });

  it("walks back across a year boundary", () => {
    expect(previousPeriod(periodFor(2026, 1))).toMatchObject({ year: 2025, month: 12 });
    expect(previousPeriod(periodFor(2026, 6))).toMatchObject({ year: 2026, month: 5 });
  });

  it("tests membership inclusively on both ends", () => {
    const p = periodFor(2026, 6);
    expect(inPeriod("2026-06-01", p)).toBe(true);
    expect(inPeriod("2026-06-30", p)).toBe(true);
    expect(inPeriod("2026-05-31", p)).toBe(false);
    expect(inPeriod("2026-07-01", p)).toBe(false);
    expect(inPeriod(null, p)).toBe(false);
  });
});

describe("ageOn", () => {
  it("counts a birthday as the day you turn, not the day after", () => {
    expect(ageOn("1961-03-15", "2026-03-14")).toBe(64);
    expect(ageOn("1961-03-15", "2026-03-15")).toBe(65);
    expect(ageOn("1961-03-15", "2026-03-16")).toBe(65);
  });

  it("handles a December birthday against a January date", () => {
    expect(ageOn("1963-12-31", "2026-01-01")).toBe(62);
  });

  it("returns null on rubbish rather than NaN", () => {
    expect(ageOn("not-a-date", "2026-01-01")).toBeNull();
  });
});

describe("officialRetirementDate", () => {
  it("is the last day of the birthday month in the retirement year", () => {
    expect(officialRetirementDate("1961-03-15", 63)).toBe("2024-03-31");
    expect(officialRetirementDate("1966-02-10", 62)).toBe("2028-02-29");
    expect(officialRetirementDate("1958-06-01", 62)).toBe("2020-06-30");
  });
});

describe("siteOf", () => {
  it("groups blank sites rather than dropping them", () => {
    expect(siteOf(null)).toBe(UNASSIGNED_SITE);
    expect(siteOf("   ")).toBe(UNASSIGNED_SITE);
    expect(siteOf("Impala 14 Shaft")).toBe("Impala 14 Shaft");
  });
});

describe("employment equity and SETA calendars", () => {
  it("places a period in the EE reporting year that runs September to August", () => {
    expect(eeReportingYear("2026-10-31")).toEqual({
      start: "2026-09-01",
      end: "2027-08-31",
      label: "1 Sep 2026 to 31 Aug 2027",
    });
    expect(eeReportingYear("2026-08-31").start).toBe("2025-09-01");
    expect(eeReportingYear("2026-09-01").start).toBe("2026-09-01");
  });

  it("names the SETA year for the calendar year in which it ends", () => {
    expect(setaYearFor("2026-03-31")).toBe(2026);
    expect(setaYearFor("2026-04-01")).toBe(2027);
    expect(setaYearRange(2027)).toEqual({
      start: "2026-04-01",
      end: "2027-03-31",
      label: "1 Apr 2026 to 31 Mar 2027",
      due: "2027-04-30",
    });
  });

  it("treats every non SA ID holder as a foreign national on the EEA2", () => {
    expect(isForeignNational("sa_id")).toBe(false);
    expect(isForeignNational("passport")).toBe(true);
    expect(isForeignNational("work_permit")).toBe(true);
    expect(isForeignNational(null)).toBe(false);
  });
});

describe("overlapDays", () => {
  it("counts calendar days of a spell inside a window, inclusive", () => {
    expect(overlapDays("2026-08-30", "2026-09-02", "2026-08-01", "2026-08-31")).toBe(2);
    expect(overlapDays("2026-08-10", "2026-08-10", "2026-08-01", "2026-08-31")).toBe(1);
    expect(overlapDays("2026-07-01", "2026-07-31", "2026-08-01", "2026-08-31")).toBe(0);
    expect(overlapDays("2026-08-01", "2026-08-31", "2026-08-01", "2026-08-31")).toBe(31);
  });

  it("counts a half day as 0.5 when it falls in the window", () => {
    expect(overlapDays("2026-08-10", "2026-08-10", "2026-08-01", "2026-08-31", true)).toBe(0.5);
    expect(overlapDays("2026-09-10", "2026-09-10", "2026-08-01", "2026-08-31", true)).toBe(0);
  });
});
