import { describe, expect, it } from "vitest";
import type { LabourPlan, OnboardingCandidate } from "@/lib/types/database";
import type { ReportEmployee } from "@/lib/reports/data";
import { periodFor } from "@/lib/hr/operations";
import {
  buildLabourPlan,
  daysBetween,
  describeGap,
  pipelineCounts,
} from "./labour-plan";

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

function cand(over: Partial<OnboardingCandidate> = {}): OnboardingCandidate {
  seq += 1;
  return {
    id: `c${seq}`,
    organisation_id: "org",
    surname: `Cand${seq}`,
    names: `First${seq}`,
    id_number: null,
    id_type: "sa_id",
    designation: "Miner",
    site: "Shaft A",
    status: "screening",
    screening_booked_at: null,
    screened_at: null,
    medical_booked_at: null,
    medical_at: null,
    rfac_at: null,
    medical_status: null,
    medical_review_at: null,
    teba_done: false,
    training_booked: false,
    training_start_at: null,
    expected_passout_at: null,
    employee_id: null,
    notes: null,
    created_by: null,
    created_at: "2026-09-01T08:00:00Z",
    updated_at: "2026-09-01T08:00:00Z",
    ...over,
  };
}

const sept = periodFor(2026, 9);

function row(result: ReturnType<typeof buildLabourPlan>, site: string, designation: string) {
  return result.groups
    .find((g) => g.site === site)
    ?.rows.find((r) => r.designation === designation);
}

describe("daysBetween", () => {
  it("counts whole days and reads the date part of a timestamp", () => {
    expect(daysBetween("2026-09-01T08:00:00Z", "2026-09-30")).toBe(29);
    expect(daysBetween("2026-09-30", "2026-09-30")).toBe(0);
    expect(daysBetween("2026-10-01", "2026-09-30")).toBe(-1);
  });

  it("returns 0 for unreadable input", () => {
    expect(daysBetween("", "2026-09-30")).toBe(0);
    expect(daysBetween("yesterday", "2026-09-30")).toBe(0);
  });
});

describe("buildLabourPlan plan rows", () => {
  it("ignores a plan that only takes effect after the period ends", () => {
    const plans = [
      plan({ planned: 10, effective_from: "2026-01-01" }),
      plan({ planned: 25, effective_from: "2026-10-01" }),
    ];
    const r = buildLabourPlan([emp(), emp()], plans, [], sept);
    expect(r.hasPlan).toBe(true);
    expect(row(r, "Shaft A", "Miner")?.planned).toBe(10);
    expect(row(r, "Shaft A", "Miner")?.actual).toBe(2);
    expect(row(r, "Shaft A", "Miner")?.variance).toBe(-8);
    expect(r.totals.planned).toBe(10);
  });

  it("uses the latest plan row in force on the last day of the month", () => {
    const plans = [
      plan({ planned: 10, effective_from: "2026-01-01" }),
      plan({ planned: 12, effective_from: "2026-09-15" }),
    ];
    const r = buildLabourPlan([], plans, [], sept);
    expect(row(r, "Shaft A", "Miner")?.planned).toBe(12);
  });

  it("matches designations without regard to case or surrounding whitespace", () => {
    const plans = [plan({ site: "Shaft A", designation: "Rock Drill Operator", planned: 4 })];
    const people = [
      emp({ designation: "rock drill operator" }),
      emp({ designation: "  ROCK DRILL OPERATOR " }),
      emp({ site: " Shaft A ", designation: "Rock drill operator" }),
    ];
    const r = buildLabourPlan(people, plans, [], sept);
    const group = r.groups.find((g) => g.site === "Shaft A");
    expect(group?.rows).toHaveLength(1);
    expect(group?.rows[0]?.planned).toBe(4);
    expect(group?.rows[0]?.actual).toBe(3);
    expect(group?.rows[0]?.designation).toBe("Rock Drill Operator");
  });

  it("shows planned 0 for a site with people but no plan", () => {
    const r = buildLabourPlan([emp({ site: "Shaft B", designation: "Fitter" })], [], [], sept);
    expect(r.hasPlan).toBe(false);
    const fitter = row(r, "Shaft B", "Fitter");
    expect(fitter?.planned).toBe(0);
    expect(fitter?.actual).toBe(1);
    expect(fitter?.variance).toBe(1);
    expect(fitter?.projectedGap).toBe(-1);
  });

  it("counts only people in service on the last day of the month", () => {
    const people = [
      emp({ engaged_at: "2026-09-30" }),
      emp({ engaged_at: "2026-10-01" }),
      emp({ terminated_at: "2026-09-30", termination_reason: "resignation" }),
      emp({ terminated_at: "2026-10-15", termination_reason: "resignation" }),
      emp({ engaged_at: null }),
    ];
    const r = buildLabourPlan(people, [plan({ planned: 5 })], [], sept);
    expect(row(r, "Shaft A", "Miner")?.actual).toBe(3);
  });

  it("does not clamp the projected gap and reports surplus separately", () => {
    const plans = [
      plan({ designation: "Miner", planned: 2 }),
      plan({ designation: "Fitter", planned: 3 }),
    ];
    const people = [
      emp({ designation: "Miner" }),
      emp({ designation: "Miner" }),
      emp({ designation: "Miner" }),
      emp({ designation: "Fitter" }),
    ];
    const cands = [cand({ designation: "Miner", status: "medical" })];
    const r = buildLabourPlan(people, plans, cands, sept);
    expect(row(r, "Shaft A", "Miner")?.projectedGap).toBe(-2);
    expect(row(r, "Shaft A", "Fitter")?.projectedGap).toBe(2);
    expect(r.totals.projectedGap).toBe(0);
    expect(r.stats.unfilled).toBe(2);
    expect(r.stats.surplus).toBe(2);
    expect(describeGap(-2)).toBe("2 surplus");
    expect(describeGap(2)).toBe("2 short");
    expect(describeGap(0)).toBe("On plan");
  });

  it("groups by site with subtotals and a grand total that reconcile", () => {
    const plans = [
      plan({ site: "Shaft A", designation: "Miner", planned: 4 }),
      plan({ site: "Shaft B", designation: "Miner", planned: 6 }),
    ];
    const people = [emp({ site: "Shaft A" }), emp({ site: "Shaft B" }), emp({ site: "Shaft B" })];
    const cands = [cand({ site: "Shaft B", status: "training" })];
    const r = buildLabourPlan(people, plans, cands, sept);
    expect(r.groups.map((g) => g.site)).toEqual(["Shaft A", "Shaft B"]);
    expect(r.groups[1]?.subtotal).toEqual({
      planned: 6,
      actual: 2,
      variance: -4,
      pipeline: 1,
      projectedGap: 3,
    });
    expect(r.totals).toEqual({ planned: 10, actual: 3, variance: -7, pipeline: 1, projectedGap: 6 });
    expect(r.bySite).toEqual([
      { site: "Shaft A", planned: 4, actual: 1, pipeline: 0 },
      { site: "Shaft B", planned: 6, actual: 2, pipeline: 1 },
    ]);
  });

  it("files people with no site under Unassigned", () => {
    const r = buildLabourPlan([emp({ site: null, designation: null })], [], [], sept);
    expect(r.groups[0]?.site).toBe("Unassigned");
    expect(r.groups[0]?.rows[0]?.designation).toBe("Designation not set");
  });
});

describe("pipeline", () => {
  it("excludes engaged, unfit and withdrawn candidates", () => {
    const cands = [
      cand({ status: "screening" }),
      cand({ status: "medical" }),
      cand({ status: "teba" }),
      cand({ status: "training" }),
      cand({ status: "ready" }),
      cand({ status: "engaged" }),
      cand({ status: "unfit" }),
      cand({ status: "withdrawn" }),
    ];
    const counts = pipelineCounts(cands);
    expect(counts.map((c) => c.status)).toEqual(["screening", "medical", "teba", "training", "ready"]);
    expect(counts.every((c) => c.count === 1)).toBe(true);

    const r = buildLabourPlan([], [plan({ planned: 10 })], cands, sept);
    expect(r.totals.pipeline).toBe(5);
    expect(r.pipeline).toHaveLength(5);
    expect(r.pipeline.map((p) => p.status)).toEqual(["screening", "medical", "teba", "training", "ready"]);
    expect(row(r, "Shaft A", "Miner")?.projectedGap).toBe(5);
  });

  it("matches candidates to plan rows through the same key", () => {
    const plans = [plan({ designation: "Miner", planned: 3 })];
    const cands = [cand({ designation: " miner ", status: "ready" })];
    const r = buildLabourPlan([], plans, cands, sept);
    expect(row(r, "Shaft A", "Miner")?.pipeline).toBe(1);
    expect(r.groups[0]?.rows).toHaveLength(1);
  });

  it("reports days in pipeline from the created date to the period end", () => {
    const r = buildLabourPlan([], [], [cand({ created_at: "2026-09-10T12:00:00Z" })], sept);
    expect(r.pipeline[0]?.daysInPipeline).toBe(20);
    expect(r.pipeline[0]?.screeningDate).toBe("");
  });

  it("prefers the actual screening and medical dates over the booked dates", () => {
    const c = cand({
      screening_booked_at: "2026-09-02",
      screened_at: "2026-09-04",
      medical_booked_at: "2026-09-08",
      medical_status: "pending",
    });
    const r = buildLabourPlan([], [], [c], sept);
    expect(r.pipeline[0]?.screeningDate).toBe("2026-09-04");
    expect(r.pipeline[0]?.medicalDate).toBe("2026-09-08");
    expect(r.pipeline[0]?.medicalStatusLabel).toBe("Pending");
  });
});

describe("engaged this period", () => {
  it("uses the linked employee start date when there is a link", () => {
    const e = emp({ id: "emp-1", engaged_at: "2026-09-14" });
    const late = emp({ id: "emp-2", engaged_at: "2026-10-02" });
    const cands = [
      cand({ status: "engaged", employee_id: "emp-1", updated_at: "2026-08-01T00:00:00Z" }),
      cand({ status: "engaged", employee_id: "emp-2", updated_at: "2026-09-20T00:00:00Z" }),
    ];
    const r = buildLabourPlan([e, late], [], cands, sept);
    expect(r.engaged).toHaveLength(1);
    expect(r.engaged[0]?.employeeId).toBe("emp-1");
    expect(r.engaged[0]?.engagedOn).toBe("2026-09-14");
  });

  it("falls back to the candidate's updated date when there is no link", () => {
    const cands = [
      cand({ status: "engaged", updated_at: "2026-09-21T10:00:00Z" }),
      cand({ status: "engaged", updated_at: "2026-08-21T10:00:00Z" }),
      cand({ status: "ready", updated_at: "2026-09-21T10:00:00Z" }),
    ];
    const r = buildLabourPlan([], [], cands, sept);
    expect(r.engaged).toHaveLength(1);
    expect(r.engaged[0]?.engagedOn).toBe("2026-09-21");
  });
});

describe("site filter", () => {
  it("narrows people, plan rows, pipeline and engaged to one site", () => {
    const plans = [
      plan({ site: "Shaft A", planned: 4 }),
      plan({ site: "Shaft B", planned: 6 }),
    ];
    const people = [emp({ site: "Shaft A" }), emp({ site: "Shaft B" })];
    const cands = [
      cand({ site: "Shaft A", status: "teba" }),
      cand({ site: "Shaft B", status: "teba" }),
      cand({ site: "Shaft B", status: "engaged", updated_at: "2026-09-05T00:00:00Z" }),
    ];
    const r = buildLabourPlan(people, plans, cands, sept, "Shaft B");
    expect(r.site).toBe("Shaft B");
    expect(r.groups.map((g) => g.site)).toEqual(["Shaft B"]);
    expect(r.totals).toEqual({ planned: 6, actual: 1, variance: -5, pipeline: 1, projectedGap: 4 });
    expect(r.pipeline).toHaveLength(1);
    expect(r.engaged).toHaveLength(1);
    expect(pipelineCounts(cands, "Shaft A").reduce((a, c) => a + c.count, 0)).toBe(1);
  });

  it("treats a blank site filter as all sites", () => {
    const r = buildLabourPlan([emp({ site: "Shaft A" }), emp({ site: "Shaft B" })], [], [], sept, "  ");
    expect(r.site).toBeNull();
    expect(r.groups).toHaveLength(2);
  });
});
