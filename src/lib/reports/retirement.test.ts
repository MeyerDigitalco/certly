import { describe, expect, it } from "vitest";
import type { ReportEmployee } from "@/lib/reports/data";
import { periodFor } from "@/lib/hr/operations";
import {
  buildRetirement,
  classifyRetirement,
  maskId,
  monthsBetween,
  sixMonthsAfter,
} from "./retirement";

let seq = 0;

function emp(over: Partial<ReportEmployee> = {}): ReportEmployee {
  seq += 1;
  return {
    id: `e${seq}`,
    surname: `Surname${seq}`,
    names: `Name${seq}`,
    id_number: null,
    id_type: null,
    id_country: null,
    site: "Shaft A",
    designation: "Miner",
    superior: null,
    date_of_birth: null,
    engaged_at: "2020-01-01",
    retirement_age: null,
    approved_retirement_date: null,
    terminated_at: null,
    termination_reason: null,
    termination_notes: null,
    created_at: "2020-01-01T00:00:00Z",
    ...over,
  } as ReportEmployee;
}

const oct = periodFor(2026, 10);
const DEFAULT_AGE = 60;

describe("monthsBetween and maskId", () => {
  it("counts whole calendar months regardless of the day", () => {
    expect(monthsBetween("2026-08-31", "2026-10-31")).toBe(2);
    expect(monthsBetween("2026-08-01", "2026-10-31")).toBe(2);
    expect(monthsBetween("2026-10-31", "2027-03-31")).toBe(5);
    expect(monthsBetween("2026-10-31", "2026-08-31")).toBe(-2);
    expect(monthsBetween("bad", "2026-08-31")).toBe(0);
  });

  it("masks everything but the last four characters", () => {
    expect(maskId("6603155012088")).toBe("******2088");
    expect(maskId(" 6603 1550 1208 8 ")).toBe("******2088");
    expect(maskId(null)).toBe("");
    expect(maskId("")).toBe("");
  });

  it("finds the last day of the sixth month after the period", () => {
    expect(sixMonthsAfter(oct)).toBe("2027-04-30");
    expect(sixMonthsAfter(periodFor(2026, 2))).toBe("2026-08-31");
    expect(sixMonthsAfter(periodFor(2026, 12))).toBe("2027-06-30");
  });
});

describe("classifyRetirement", () => {
  it("marks a person whose retirement month is the period month as due this month", () => {
    const c = classifyRetirement(emp({ date_of_birth: "1966-10-15" }), oct, DEFAULT_AGE);
    expect(c?.status).toBe("due_this_month");
    expect(c?.officialDate).toBe("2026-10-31");
    expect(c?.age).toBe(60);
    expect(c?.ageIsDefault).toBe(true);
    expect(c?.months).toBe(0);
  });

  it("marks a person two months past with no approval as overdue by two months", () => {
    const c = classifyRetirement(emp({ date_of_birth: "1966-08-10" }), oct, DEFAULT_AGE);
    expect(c?.status).toBe("overdue");
    expect(c?.officialDate).toBe("2026-08-31");
    expect(c?.months).toBe(2);
  });

  it("marks an approved extension later than the period start as extended", () => {
    const c = classifyRetirement(
      emp({ date_of_birth: "1966-05-01", approved_retirement_date: "2027-03-31" }),
      oct,
      DEFAULT_AGE,
    );
    expect(c?.status).toBe("extended");
    expect(c?.approvedDate).toBe("2027-03-31");
    expect(c?.months).toBe(5);
  });

  it("marks an approved extension that has already expired as overdue", () => {
    const c = classifyRetirement(
      emp({ date_of_birth: "1966-05-01", approved_retirement_date: "2026-09-30" }),
      oct,
      DEFAULT_AGE,
    );
    expect(c?.status).toBe("overdue");
    expect(c?.months).toBe(1);
  });

  it("lets an employee override beat the org default", () => {
    const c = classifyRetirement(
      emp({ date_of_birth: "1961-10-15", retirement_age: 65 }),
      oct,
      DEFAULT_AGE,
    );
    expect(c?.status).toBe("due_this_month");
    expect(c?.retirementAge).toBe(65);
    expect(c?.ageIsDefault).toBe(false);
    const d = classifyRetirement(emp({ date_of_birth: "1961-10-15" }), oct, DEFAULT_AGE);
    expect(d?.status).toBe("overdue");
    expect(d?.retirementAge).toBe(60);
  });

  it("puts the due soon boundary at exactly six months after the period", () => {
    const inside = classifyRetirement(emp({ date_of_birth: "1967-04-01" }), oct, DEFAULT_AGE);
    expect(inside?.status).toBe("due_soon");
    expect(inside?.officialDate).toBe("2027-04-30");
    expect(inside?.months).toBe(6);
    const outside = classifyRetirement(emp({ date_of_birth: "1967-05-01" }), oct, DEFAULT_AGE);
    expect(outside).toBeNull();
  });

  it("returns null without a date of birth or a usable age", () => {
    expect(classifyRetirement(emp(), oct, DEFAULT_AGE)).toBeNull();
    expect(classifyRetirement(emp({ date_of_birth: "1966-10-15" }), oct, NaN)).toBeNull();
  });
});

describe("buildRetirement", () => {
  it("counts people with no date of birth and lists them separately", () => {
    const r = buildRetirement(
      [emp(), emp({ date_of_birth: "1966-10-15" }), emp({ site: "Shaft B" })],
      oct,
      DEFAULT_AGE,
    );
    expect(r.counts.missingDob).toBe(2);
    expect(r.missingDob).toHaveLength(2);
    expect(r.counts.assessed).toBe(1);
    expect(r.rows).toHaveLength(1);
  });

  it("excludes people who had left by the period end", () => {
    const r = buildRetirement(
      [
        emp({ date_of_birth: "1960-01-01", terminated_at: "2026-10-15", termination_reason: "retirement" }),
        emp({ terminated_at: "2026-09-30" }),
        emp({ date_of_birth: "1960-01-01", engaged_at: "2026-11-01" }),
      ],
      oct,
      DEFAULT_AGE,
    );
    expect(r.rows).toHaveLength(0);
    expect(r.counts.missingDob).toBe(0);
    expect(r.counts.overdue).toBe(0);
  });

  it("sorts overdue first, then by official retirement date, and counts by site", () => {
    const r = buildRetirement(
      [
        emp({ surname: "Soon", date_of_birth: "1967-01-10", site: "Shaft B" }),
        emp({ surname: "Month", date_of_birth: "1966-10-10", site: "Shaft A" }),
        emp({ surname: "Older", date_of_birth: "1965-12-10", site: "Shaft B" }),
        emp({ surname: "Newer", date_of_birth: "1966-07-10", site: "Shaft A" }),
        emp({
          surname: "Extended",
          date_of_birth: "1966-01-10",
          approved_retirement_date: "2026-12-31",
          site: "Shaft A",
        }),
      ],
      oct,
      DEFAULT_AGE,
    );
    expect(r.rows.map((x) => x.surname)).toEqual(["Older", "Newer", "Extended", "Month", "Soon"]);
    expect(r.counts).toEqual({
      overdue: 2,
      extended: 1,
      dueThisMonth: 1,
      dueSoon: 1,
      missingDob: 0,
      assessed: 5,
    });
    expect(r.bySite.sites).toEqual(["Shaft A", "Shaft B"]);
    expect(r.bySite.overdue).toEqual([1, 1]);
    expect(r.bySite.extended).toEqual([1, 0]);
    expect(r.bySite.dueWithinSix).toEqual([1, 1]);
    expect(r.rows[0]?.monthsLabel).toBe("10 months overdue");
    expect(r.rows[2]?.monthsLabel).toBe("2 months remaining");
    expect(r.rows[3]?.monthsLabel).toBe("This month");
  });

  it("honours the site filter and masks the identity number on the row", () => {
    const r = buildRetirement(
      [
        emp({ date_of_birth: "1966-08-10", site: "Shaft A", id_number: "6608105012088" }),
        emp({ date_of_birth: "1966-08-10", site: "Shaft B" }),
        emp({ site: "Shaft B" }),
      ],
      oct,
      DEFAULT_AGE,
      "Shaft B",
    );
    expect(r.site).toBe("Shaft B");
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.site).toBe("Shaft B");
    expect(r.counts.missingDob).toBe(1);
    expect(r.bySite.sites).toEqual(["Shaft B"]);

    const all = buildRetirement(
      [emp({ date_of_birth: "1966-08-10", id_number: "6608105012088" })],
      oct,
      DEFAULT_AGE,
      "",
    );
    expect(all.site).toBeNull();
    expect(all.rows[0]?.idMasked).toBe("******2088");
    expect(all.rows[0]?.idNumber).toBe("6608105012088");
  });
});
