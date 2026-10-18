import { describe, expect, it } from "vitest";
import type { ReportEmployee } from "@/lib/reports/data";
import { periodFor } from "@/lib/hr/operations";
import {
  buildFaultTerminations,
  bySiteToMonth,
  changePct,
  monthlyCounts,
  yearTotalsToMonth,
} from "./fault-terminations";

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

const sept = periodFor(2026, 9);

describe("monthlyCounts", () => {
  it("lands each fault termination in the right month and year", () => {
    const employees = [
      emp({ terminated_at: "2026-03-10", termination_reason: "resignation" }),
      emp({ terminated_at: "2026-03-28", termination_reason: "dismissal" }),
      emp({ terminated_at: "2026-11-02", termination_reason: "abscondment" }),
      emp({ terminated_at: "2025-03-10", termination_reason: "resignation" }),
    ];
    const c = monthlyCounts(employees, 2026);
    expect(c.resignation[2]).toBe(1);
    expect(c.dismissal[2]).toBe(1);
    expect(c.abscondment[10]).toBe(1);
    expect(c.total[2]).toBe(2);
    expect(c.total.reduce((a, b) => a + b, 0)).toBe(3);
    const p = monthlyCounts(employees, 2025);
    expect(p.resignation[2]).toBe(1);
    expect(p.total.reduce((a, b) => a + b, 0)).toBe(1);
  });

  it("treats 31 December of the previous year as the previous year", () => {
    const employees = [
      emp({ terminated_at: "2025-12-31", termination_reason: "resignation" }),
      emp({ terminated_at: "2026-01-01", termination_reason: "resignation" }),
    ];
    const current = monthlyCounts(employees, 2026);
    const previous = monthlyCounts(employees, 2025);
    expect(previous.resignation[11]).toBe(1);
    expect(current.resignation[0]).toBe(1);
    expect(current.resignation[11]).toBe(0);
  });

  it("excludes no fault reasons and leavers with no reason", () => {
    const employees = [
      emp({ terminated_at: "2026-02-01", termination_reason: "retirement" }),
      emp({ terminated_at: "2026-02-01", termination_reason: "deceased" }),
      emp({ terminated_at: "2026-02-01", termination_reason: "retrenchment" }),
      emp({ terminated_at: "2026-02-01", termination_reason: "fixed_term_end" }),
      emp({ terminated_at: "2026-02-01", termination_reason: "medical_incapacity" }),
      emp({ terminated_at: "2026-02-01", termination_reason: null }),
      emp({ terminated_at: "2026-02-01", termination_reason: "dismissal" }),
    ];
    const c = monthlyCounts(employees, 2026);
    expect(c.total[1]).toBe(1);
    expect(c.dismissal[1]).toBe(1);
  });

  it("honours the site filter", () => {
    const employees = [
      emp({ site: "Shaft A", terminated_at: "2026-05-05", termination_reason: "resignation" }),
      emp({ site: "Shaft B", terminated_at: "2026-05-05", termination_reason: "resignation" }),
      emp({ site: null, terminated_at: "2026-05-05", termination_reason: "abscondment" }),
    ];
    expect(monthlyCounts(employees, 2026, "Shaft A").total[4]).toBe(1);
    expect(monthlyCounts(employees, 2026, "Unassigned").abscondment[4]).toBe(1);
    expect(monthlyCounts(employees, 2026).total[4]).toBe(3);
    expect(monthlyCounts(employees, 2026, "").total[4]).toBe(3);
  });
});

describe("yearTotalsToMonth", () => {
  it("ignores months after the selected month", () => {
    const employees = [
      emp({ terminated_at: "2026-01-15", termination_reason: "resignation" }),
      emp({ terminated_at: "2026-09-30", termination_reason: "dismissal" }),
      emp({ terminated_at: "2026-10-01", termination_reason: "abscondment" }),
      emp({ terminated_at: "2026-12-20", termination_reason: "resignation" }),
    ];
    const c = monthlyCounts(employees, 2026);
    const ytd = yearTotalsToMonth(c, 9);
    expect(ytd.total).toBe(2);
    expect(ytd.resignation).toBe(1);
    expect(ytd.dismissal).toBe(1);
    expect(ytd.abscondment).toBe(0);
    expect(yearTotalsToMonth(c, 12).total).toBe(4);
  });
});

describe("changePct", () => {
  it("returns null rather than Infinity when the previous year is zero", () => {
    expect(changePct(0, 5)).toBeNull();
    expect(changePct(0, 0)).toBeNull();
  });

  it("rounds to one decimal", () => {
    expect(changePct(3, 4)).toBe(33.3);
    expect(changePct(4, 3)).toBe(-25);
  });
});

describe("buildFaultTerminations", () => {
  const employees = [
    emp({ site: "Shaft A", terminated_at: "2025-02-10", termination_reason: "resignation" }),
    emp({ site: "Shaft A", terminated_at: "2025-11-10", termination_reason: "dismissal" }),
    emp({ site: "Shaft A", terminated_at: "2026-04-10", termination_reason: "resignation" }),
    emp({ site: "Shaft B", terminated_at: "2026-09-12", termination_reason: "abscondment" }),
    emp({ site: "Shaft B", terminated_at: "2026-09-20", termination_reason: "retirement" }),
    emp({ site: "Shaft A", terminated_at: "2026-10-03", termination_reason: "dismissal" }),
  ];

  it("labels the current year YTD and the previous year in full", () => {
    const r = buildFaultTerminations(employees, sept);
    expect(r.currentYear).toBe(2026);
    expect(r.previousYear).toBe(2025);
    expect(r.stats.currentYtd.total).toBe(2);
    expect(r.stats.previousSameMonths.total).toBe(1);
    expect(r.stats.previousFullYear.total).toBe(2);
    expect(r.stats.change).toBe(1);
    expect(r.stats.changePct).toBe(100);
    expect(r.totals.previousTotal).toBe(2);
    expect(r.totals.currentTotal).toBe(2);
    expect(r.totals.change).toBe(1);
  });

  it("still shows months after the period but marks them to date", () => {
    const r = buildFaultTerminations(employees, sept);
    expect(r.months).toHaveLength(12);
    expect(r.months[9].currentTotal).toBe(1);
    expect(r.months[9].toDate).toBe(true);
    expect(r.months[8].toDate).toBe(false);
  });

  it("lists only fault leavers in the selected period", () => {
    const r = buildFaultTerminations(employees, sept);
    expect(r.leavers).toHaveLength(1);
    expect(r.leavers[0].reason).toBe("abscondment");
    expect(r.leavers[0].site).toBe("Shaft B");
  });

  it("splits the current YTD per site", () => {
    const r = buildFaultTerminations(employees, sept);
    expect(r.bySite.map((s) => s.site).sort()).toEqual(["Shaft A", "Shaft B"]);
    expect(r.bySiteTotals.total).toBe(2);
    expect(bySiteToMonth(employees, 2026, 10)).toHaveLength(2);
    expect(bySiteToMonth(employees, 2026, 10).find((s) => s.site === "Shaft A")?.total).toBe(2);
  });

  it("applies the site filter across every section", () => {
    const r = buildFaultTerminations(employees, sept, "Shaft A");
    expect(r.site).toBe("Shaft A");
    expect(r.stats.currentYtd.total).toBe(1);
    expect(r.stats.previousSameMonths.total).toBe(1);
    expect(r.stats.changePct).toBe(0);
    expect(r.leavers).toHaveLength(0);
    expect(r.bySite).toHaveLength(1);
    expect(r.bySite[0].site).toBe("Shaft A");
    expect(r.months[8].currentTotal).toBe(0);
  });

  it("reports an empty register without NaN", () => {
    const r = buildFaultTerminations([], sept);
    expect(r.hasAnyTermination).toBe(false);
    expect(r.stats.changePct).toBeNull();
    expect(r.stats.change).toBe(0);
    expect(r.bySite).toHaveLength(0);
    expect(r.months.every((m) => m.currentTotal === 0 && m.previousTotal === 0)).toBe(true);
  });
});
