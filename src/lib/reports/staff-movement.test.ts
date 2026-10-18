import { describe, expect, it } from "vitest";
import type { LabourPlan } from "@/lib/types/database";
import type { ReportEmployee } from "@/lib/reports/data";
import { periodFor } from "@/lib/hr/operations";
import {
  activeAtStart,
  activeOn,
  buildStaffMovement,
  buildTrend,
  turnoverPct,
} from "./staff-movement";

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

function plan(over: Partial<LabourPlan> = {}): LabourPlan {
  seq += 1;
  return {
    id: `p${seq}`,
    organisation_id: "org",
    site: "Shaft A",
    designation: "Miner",
    planned: 10,
    effective_from: "2025-01-01",
    notes: null,
    created_by: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...over,
  };
}

const sept = periodFor(2026, 9);

describe("activeOn and activeAtStart", () => {
  it("counts a mid-month joiner as a joiner and in end headcount but not start", () => {
    const e = emp({ engaged_at: "2026-09-15" });
    expect(activeAtStart(e, sept)).toBe(false);
    expect(activeOn(e, sept.end)).toBe(true);
    const r = buildStaffMovement([e], [], sept);
    expect(r.kpis.joiners).toBe(1);
    expect(r.kpis.startHeadcount).toBe(0);
    expect(r.kpis.endHeadcount).toBe(1);
  });

  it("counts a last-day termination as a leaver who is not in end headcount", () => {
    const e = emp({ terminated_at: "2026-09-30", termination_reason: "resignation" });
    expect(activeAtStart(e, sept)).toBe(true);
    expect(activeOn(e, sept.end)).toBe(false);
    const r = buildStaffMovement([e], [], sept);
    expect(r.kpis.leavers).toBe(1);
    expect(r.kpis.startHeadcount).toBe(1);
    expect(r.kpis.endHeadcount).toBe(0);
    expect(r.kpis.fault).toBe(1);
    expect(r.leavers[0]?.clsLabel).toBe("Fault");
  });

  it("treats someone who left before the period as absent throughout", () => {
    const e = emp({ terminated_at: "2026-08-31", termination_reason: "dismissal" });
    const r = buildStaffMovement([e], [], sept);
    expect(r.kpis.startHeadcount).toBe(0);
    expect(r.kpis.leavers).toBe(0);
    expect(r.kpis.endHeadcount).toBe(0);
  });
});

describe("turnover", () => {
  it("returns 0 with zero headcount instead of NaN", () => {
    expect(turnoverPct(0, 0, 0)).toBe(0);
    expect(turnoverPct(0, 0, 3)).toBe(0);
    const r = buildStaffMovement([], [], sept);
    expect(r.kpis.turnoverPct).toBe(0);
    expect(Number.isNaN(r.kpis.turnoverPct)).toBe(false);
  });

  it("uses the average of start and end headcount, rounded to one decimal", () => {
    expect(turnoverPct(10, 8, 2)).toBe(22.2);
    expect(turnoverPct(3, 3, 1)).toBe(33.3);
  });
});

describe("termination matrix", () => {
  it("splits reasons into no fault and fault with site columns and totals", () => {
    const people = [
      emp({ site: "Shaft A", terminated_at: "2026-09-10", termination_reason: "deceased" }),
      emp({ site: "Shaft B", terminated_at: "2026-09-12", termination_reason: "resignation" }),
      emp({ site: "Shaft B", terminated_at: "2026-09-20", termination_reason: "abscondment" }),
      emp({ site: "Shaft A" }),
    ];
    const r = buildStaffMovement(people, [], sept);
    expect(r.matrix.sites).toEqual(["Shaft A", "Shaft B"]);
    const noFault = r.matrix.groups[0];
    const fault = r.matrix.groups[1];
    expect(noFault.cls).toBe("no_fault");
    expect(noFault.subtotal.bySite).toEqual([1, 0]);
    expect(noFault.subtotal.total).toBe(1);
    expect(fault.subtotal.bySite).toEqual([0, 2]);
    expect(fault.subtotal.total).toBe(2);
    expect(r.matrix.grand.bySite).toEqual([1, 2]);
    expect(r.matrix.grand.total).toBe(3);
    expect(r.kpis.noFault).toBe(1);
    expect(r.kpis.fault).toBe(2);
  });

  it("keeps a leaver with no reason in the grand total as unclassified", () => {
    const r = buildStaffMovement([emp({ terminated_at: "2026-09-05" })], [], sept);
    expect(r.matrix.unclassified.total).toBe(1);
    expect(r.matrix.grand.total).toBe(1);
    expect(r.kpis.leavers).toBe(1);
    expect(r.kpis.noFault + r.kpis.fault).toBe(0);
  });
});

describe("plan vs actual", () => {
  it("shows a site with a plan but nobody, and a site with people but no plan", () => {
    const plans = [plan({ site: "Shaft C", planned: 12 })];
    const people = [emp({ site: "Shaft A" }), emp({ site: "Shaft A" })];
    const r = buildStaffMovement(people, plans, sept);
    expect(r.planVsActual.rows.map((x) => x.site)).toEqual(["Shaft A", "Shaft C"]);
    const a = r.planVsActual.rows[0];
    const c = r.planVsActual.rows[1];
    expect(a).toMatchObject({ planned: 0, actual: 2, variance: 2, variancePct: null });
    expect(c).toMatchObject({ planned: 12, actual: 0, variance: -12, variancePct: -100 });
    expect(r.planVsActual.totals).toMatchObject({ planned: 12, actual: 2, variance: -10 });
    expect(r.planVsActual.hasPlan).toBe(true);
  });

  it("sums designations into a site plan and ignores plans effective after the period", () => {
    const plans = [
      plan({ site: "Shaft A", designation: "Miner", planned: 5 }),
      plan({ site: "Shaft A", designation: "Fitter", planned: 3 }),
      plan({ site: "Shaft A", designation: "Miner", planned: 50, effective_from: "2026-10-01" }),
    ];
    const r = buildStaffMovement([emp({ site: "Shaft A" })], plans, sept);
    expect(r.planVsActual.rows[0]).toMatchObject({ planned: 8, actual: 1, variance: -7, variancePct: -87.5 });
  });

  it("reports no plan when nothing is in force", () => {
    const r = buildStaffMovement([emp()], [], sept);
    expect(r.planVsActual.hasPlan).toBe(false);
  });
});

describe("site filter", () => {
  const people = [
    emp({ site: "Shaft A", terminated_at: "2026-09-10", termination_reason: "retirement" }),
    emp({ site: "Shaft B", terminated_at: "2026-09-12", termination_reason: "resignation" }),
    emp({ site: "Shaft B", engaged_at: "2026-09-03" }),
    emp({ site: null }),
  ];
  const plans = [plan({ site: "Shaft A", planned: 4 }), plan({ site: "Shaft B", planned: 6 })];

  it("narrows every section to the chosen site", () => {
    const r = buildStaffMovement(people, plans, sept, "Shaft B");
    expect(r.site).toBe("Shaft B");
    expect(r.matrix.sites).toEqual(["Shaft B"]);
    expect(r.matrix.grand.total).toBe(1);
    expect(r.kpis.leavers).toBe(1);
    expect(r.kpis.joiners).toBe(1);
    expect(r.kpis.startHeadcount).toBe(1);
    expect(r.kpis.endHeadcount).toBe(1);
    expect(r.planVsActual.rows).toEqual([
      { site: "Shaft B", planned: 6, actual: 1, variance: -5, variancePct: -83.3 },
    ]);
    expect(r.leavers.map((l) => l.site)).toEqual(["Shaft B"]);
    expect(r.trend[5]?.fault).toBe(1);
    expect(r.trend[5]?.noFault).toBe(0);
  });

  it("groups blank sites as Unassigned and matches the filter on that name", () => {
    const r = buildStaffMovement(people, plans, sept, "Unassigned");
    expect(r.kpis.endHeadcount).toBe(1);
    expect(r.matrix.sites).toEqual(["Unassigned"]);
  });

  it("treats an empty filter as all sites", () => {
    const r = buildStaffMovement(people, plans, sept, "");
    expect(r.site).toBeNull();
    expect(r.matrix.sites).toEqual(["Shaft A", "Shaft B", "Unassigned"]);
  });
});

describe("six month trend", () => {
  it("runs oldest to newest, ending on the chosen month", () => {
    const people = [
      emp({ terminated_at: "2026-04-15", termination_reason: "deceased" }),
      emp({ terminated_at: "2026-09-15", termination_reason: "dismissal" }),
      emp({ engaged_at: "2026-07-01" }),
      emp({ terminated_at: "2026-03-31", termination_reason: "dismissal" }),
    ];
    const t = buildTrend(people, sept);
    expect(t).toHaveLength(6);
    expect(t.map((m) => m.label)).toEqual(["Apr 26", "May 26", "Jun 26", "Jul 26", "Aug 26", "Sep 26"]);
    expect(t[0]).toMatchObject({ noFault: 1, fault: 0, joiners: 0 });
    expect(t[3]).toMatchObject({ joiners: 1 });
    expect(t[5]).toMatchObject({ noFault: 0, fault: 1, leavers: 1 });
  });
});
