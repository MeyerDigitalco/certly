import { describe, it, expect } from "vitest";
import {
  buildOverview,
  hasFullDeclaration,
  nextAnnual,
  daysBetween,
  type OverviewInput,
} from "./overview";
import type { ReportEmployee } from "@/lib/reports/data";
import type { CompanyDocument, TrainingType } from "@/lib/types/database";

const e = (o: Partial<ReportEmployee> = {}): ReportEmployee =>
  ({
    id: Math.random().toString(36).slice(2),
    surname: "A",
    names: "B",
    id_number: "1",
    id_type: "sa_id",
    id_country: null,
    site: "Shaft 1",
    designation: "Miner",
    superior: null,
    date_of_birth: null,
    engaged_at: "2020-01-01",
    retirement_age: null,
    approved_retirement_date: null,
    terminated_at: null,
    termination_reason: null,
    termination_notes: null,
    gender: "male",
    population_group: "african",
    disability: false,
    occupational_level: "semi_skilled",
    ofo_code: null,
    ee_declared_at: null,
    created_at: "",
    ...o,
  }) as ReportEmployee;

const type = (o: Partial<TrainingType> = {}): TrainingType => ({
  id: Math.random().toString(36).slice(2),
  organisation_id: "o",
  name: "T",
  sort_order: 1,
  active: true,
  category: "short_course",
  hours: 8,
  cost_cents: 100000,
  provider: null,
  nqf_level: null,
  accredited: false,
  counts_for_atr: true,
  ...o,
});

const doc = (o: Partial<CompanyDocument> = {}): CompanyDocument => ({
  id: Math.random().toString(36).slice(2),
  organisation_id: "o",
  category: "coida",
  title: "Letter of good standing",
  file_path: null,
  issued_at: null,
  expires_at: "2027-06-30",
  sort_order: 0,
  created_by: null,
  created_at: "",
  updated_at: "",
  ...o,
});

function input(over: Partial<OverviewInput> = {}): OverviewInput {
  return {
    today: "2026-10-22",
    sector: "mining",
    seta: "MQA",
    dueSoonDays: 30,
    employees: [],
    kpis: { expired: 0, due_soon: 0, valid: 0, no_expiry: 0 },
    sites: [],
    expiredBySite: [],
    companyDocs: [],
    trainingTypes: [],
    trainingPlans: [],
    ...over,
  };
}

describe("calendar helpers", () => {
  it("finds the next 15 January and the next 30 April from a date", () => {
    expect(nextAnnual("2026-10-22", 1, 15)).toBe("2027-01-15");
    expect(nextAnnual("2027-01-15", 1, 15)).toBe("2027-01-15");
    expect(nextAnnual("2027-01-16", 1, 15)).toBe("2028-01-15");
    expect(nextAnnual("2026-10-22", 4, 30)).toBe("2027-04-30");
    expect(daysBetween("2026-10-22", "2027-01-15")).toBe(85);
  });

  it("requires all four EEA1 fields for a full declaration", () => {
    expect(hasFullDeclaration(e())).toBe(true);
    expect(hasFullDeclaration(e({ disability: null }))).toBe(false);
    expect(hasFullDeclaration(e({ occupational_level: null }))).toBe(false);
  });
});

describe("buildOverview", () => {
  it("treats fewer than 50 people as voluntary and 50 as designated", () => {
    const small = buildOverview(input({ employees: Array.from({ length: 49 }, () => e()) }), "acme");
    expect(small.designated).toBe(false);
    expect(small.deadlines[0].status).toBe("voluntary");
    const big = buildOverview(input({ employees: Array.from({ length: 50 }, () => e()) }), "acme");
    expect(big.designated).toBe(true);
    expect(big.deadlines[0].status).toBe("ready");
  });

  it("counts people without a declaration and marks urgency inside 45 days", () => {
    const emps = [...Array.from({ length: 48 }, () => e()), e({ gender: null }), e({ population_group: null })];
    const far = buildOverview(input({ employees: emps, today: "2026-10-22" }), "acme");
    expect(far.deadlines[0].headline).toBe("2 of 50 people have no complete EEA1 declaration");
    expect(far.deadlines[0].status).toBe("behind");
    const near = buildOverview(input({ employees: emps, today: "2026-12-20" }), "acme");
    expect(near.deadlines[0].status).toBe("urgent");
  });

  it("excludes people who have left from the headcount", () => {
    const emps = [e(), e({ terminated_at: "2026-09-30", termination_reason: "resignation" })];
    expect(buildOverview(input({ employees: emps }), "acme").headcount).toBe(1);
  });

  it("flags a missing SETA, incomplete training types and a missing plan", () => {
    const o = buildOverview(
      input({ seta: null, sector: "general", trainingTypes: [type({ hours: null }), type()] }),
      "acme",
    );
    expect(o.deadlines[1].status).toBe("missing");
    expect(o.deadlines[1].headline).toContain("SETA not set");
    expect(o.deadlines[1].headline).toContain("1 training types without hours or cost");
    expect(o.deadlines[1].headline).toContain("no plan for next year");
  });

  it("is ready for the SETA when everything is in place", () => {
    const o = buildOverview(
      input({
        trainingTypes: [type()],
        trainingPlans: [
          { id: "p", organisation_id: "o", training_type_id: "t", seta_year: 2028, site: "", planned_count: 1, planned_cost_cents: null, notes: null, created_by: null, created_at: "", updated_at: "" },
        ],
      }),
      "acme",
    );
    expect(o.deadlines[1].status).toBe("ready");
    expect(o.deadlines[1].headline).toBe("Ready to submit to the MQA");
  });

  it("uses the mining default SETA when none is set", () => {
    const o = buildOverview(input({ seta: null, sector: "mining" }), "acme");
    expect(o.deadlines[1].detail).toContain("MQA");
  });

  it("reads the letter of good standing from company documents", () => {
    expect(buildOverview(input(), "acme").deadlines[2].status).toBe("missing");
    expect(buildOverview(input({ companyDocs: [doc()] }), "acme").deadlines[2].status).toBe("ready");
    expect(buildOverview(input({ companyDocs: [doc({ expires_at: "2026-11-10" })] }), "acme").deadlines[2].status).toBe("urgent");
    const late = buildOverview(input({ companyDocs: [doc({ expires_at: "2026-10-01" })] }), "acme");
    expect(late.deadlines[2].status).toBe("late");
    expect(late.deadlines[2].headline).toBe("Expired 21 days ago");
  });

  it("scores with renormalised weights when a component has no data", () => {
    const o = buildOverview(
      input({
        kpis: { expired: 10, due_soon: 0, valid: 90, no_expiry: 5 },
        employees: Array.from({ length: 10 }, () => e()),
        companyDocs: [doc()],
      }),
      "acme",
    );
    expect(o.score.components.find((c) => c.key === "certificates")?.pct).toBe(90);
    expect(o.score.components.find((c) => c.key === "declarations")?.pct).toBe(100);
    expect(o.score.components.find((c) => c.key === "company_documents")?.pct).toBe(100);
    expect(o.score.components.find((c) => c.key === "training_details")?.pct).toBeNull();
    expect(o.score.pct).toBe(Math.round((90 * 45 + 100 * 25 + 100 * 20) / 90));
  });

  it("gives zero for company documents when there is no letter of good standing", () => {
    const o = buildOverview(input({ companyDocs: [doc({ category: "bbbee" })] }), "acme");
    expect(o.score.components.find((c) => c.key === "company_documents")?.pct).toBe(0);
  });

  it("counts people who cannot pass a gate per site, never above the headcount", () => {
    const o = buildOverview(
      input({
        sites: [
          { site: "Shaft 1", people: 10, records: 30, expired: 4, dueSoon: 2, valid: 24, noExpiry: 0, readiness: 80 },
          { site: "Plant", people: 5, records: 10, expired: 0, dueSoon: 1, valid: 9, noExpiry: 0, readiness: 90 },
        ],
        expiredBySite: [
          { employee_id: "a", site: "Shaft 1" },
          { employee_id: "a", site: "Shaft 1" },
          { employee_id: "b", site: "Shaft 1" },
        ],
      }),
      "acme",
    );
    expect(o.gate.sites[0].cannotPass).toBe(2);
    expect(o.gate.sites[0].canPass).toBe(8);
    expect(o.gate.sites[1].cannotPass).toBe(0);
    expect(o.gate.people).toBe(15);
    expect(o.gate.cannotPass).toBe(2);
    expect(o.gate.readiness).toBe(87);
  });

  it("pins reports by sector", () => {
    expect(buildOverview(input({ sector: "mining" }), "acme").pinnedReports[0]).toBe("staff-movement");
    expect(buildOverview(input({ sector: "general" }), "acme").pinnedReports[0]).toBe("employment-equity");
  });
});
