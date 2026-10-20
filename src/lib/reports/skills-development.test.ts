import { describe, expect, it } from "vitest";
import type { ReportEmployee, TrainingDelivered } from "@/lib/reports/data";
import type { TrainingPlan, TrainingType } from "@/lib/types/database";
import { periodFor } from "@/lib/hr/operations";
import {
  atrRows,
  buildSkillsDevelopment,
  formatRands,
  inSetaYear,
  isBlack,
  setaYear,
} from "./skills-development";

let seq = 0;

function emp(over: Partial<ReportEmployee> = {}): ReportEmployee {
  seq += 1;
  return {
    id: `e${seq}`,
    surname: `Surname${seq}`,
    names: `Name${seq}`,
    id_number: `900101500008${seq}`,
    id_type: "sa_id",
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
    gender: "male",
    population_group: "african",
    disability: false,
    occupational_level: null,
    ofo_code: null,
    ee_declared_at: null,
    created_at: "2020-01-01T00:00:00Z",
    ...over,
  } as ReportEmployee;
}

function type(over: Partial<TrainingType> = {}): TrainingType {
  seq += 1;
  return {
    id: `t${seq}`,
    organisation_id: "org",
    name: `Course ${seq}`,
    sort_order: seq,
    active: true,
    category: "short_course",
    hours: 8,
    cost_cents: 150000,
    provider: "Provider",
    nqf_level: 2,
    accredited: true,
    counts_for_atr: true,
    ...over,
  };
}

function cert(employee: ReportEmployee, t: TrainingType, date: string): TrainingDelivered {
  seq += 1;
  return {
    id: `c${seq}`,
    employee_id: employee.id,
    training_type_id: t.id,
    training_date: date,
    expiry_date: null,
  };
}

function plan(over: Partial<TrainingPlan> = {}): TrainingPlan {
  seq += 1;
  return {
    id: `p${seq}`,
    organisation_id: "org",
    training_type_id: "t0",
    seta_year: 2028,
    site: "Shaft A",
    planned_count: 5,
    planned_cost_cents: null,
    notes: null,
    created_by: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

const oct2026 = periodFor(2026, 10);
const year2027 = setaYear(2027);

describe("inSetaYear and isBlack", () => {
  it("puts 31 March in the year ending that day and 1 April in the next", () => {
    expect(inSetaYear("2027-03-31", 2027)).toBe(true);
    expect(inSetaYear("2027-04-01", 2027)).toBe(false);
    expect(inSetaYear("2027-04-01", 2028)).toBe(true);
    expect(inSetaYear("2026-04-01", 2027)).toBe(true);
    expect(inSetaYear("2026-03-31", 2027)).toBe(false);
    expect(inSetaYear(null, 2027)).toBe(false);
  });

  it("applies the B-BBEE Act definition of black people", () => {
    expect(isBlack("african")).toBe(true);
    expect(isBlack("coloured")).toBe(true);
    expect(isBlack("indian")).toBe(true);
    expect(isBlack("white")).toBe(false);
    expect(isBlack(null)).toBe(false);
  });

  it("names the SETA year for the calendar year it ends in", () => {
    expect(year2027.start).toBe("2026-04-01");
    expect(year2027.end).toBe("2027-03-31");
    expect(year2027.due).toBe("2027-04-30");
  });
});

describe("atrRows", () => {
  it("keeps only certificates in the year for courses that count for the ATR", () => {
    const e = emp();
    const counted = type();
    const induction = type({ category: "induction", counts_for_atr: false });
    const rows = atrRows(
      [e],
      [counted, induction],
      [
        cert(e, counted, "2026-06-01"),
        cert(e, counted, "2025-06-01"),
        cert(e, induction, "2026-06-01"),
      ],
      year2027,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].course).toBe(counted.name);
    expect(rows[0].date).toBe("2026-06-01");
  });

  it("drops people who were never in service during the year", () => {
    const left = emp({ terminated_at: "2026-03-31" });
    const stayed = emp({ terminated_at: "2026-04-01" });
    const t = type();
    const rows = atrRows(
      [left, stayed],
      [t],
      [cert(left, t, "2026-05-01"), cert(stayed, t, "2026-05-01")],
      year2027,
    );
    expect(rows.map((r) => r.employeeId)).toEqual([stayed.id]);
  });

  it("honours the site filter on the employee's site", () => {
    const a = emp({ site: "Shaft A" });
    const b = emp({ site: "Shaft B" });
    const t = type();
    const certs = [cert(a, t, "2026-05-01"), cert(b, t, "2026-05-01")];
    expect(atrRows([a, b], [t], certs, year2027, "Shaft B").map((r) => r.employeeId)).toEqual([
      b.id,
    ]);
    expect(atrRows([a, b], [t], certs, year2027, "")).toHaveLength(2);
  });
});

describe("buildSkillsDevelopment", () => {
  it("multiplies hours and cost by people and leaves them blank when the course has none", () => {
    const a = emp();
    const b = emp();
    const priced = type({ hours: 4, cost_cents: 120050 });
    const blank = type({ hours: null, cost_cents: null });
    const r = buildSkillsDevelopment(
      [a, b],
      [priced, blank],
      [
        cert(a, priced, "2026-05-01"),
        cert(b, priced, "2026-05-02"),
        cert(a, blank, "2026-05-03"),
      ],
      [],
      oct2026,
    );
    const pricedRow = r.courses.find((c) => c.typeId === priced.id)!;
    const blankRow = r.courses.find((c) => c.typeId === blank.id)!;
    expect(pricedRow.people).toBe(2);
    expect(pricedRow.hours).toBe(8);
    expect(pricedRow.cost).toBe(2401);
    expect(blankRow.people).toBe(1);
    expect(blankRow.hours).toBeNull();
    expect(blankRow.cost).toBeNull();
    expect(r.courseTotals.people).toBe(3);
    expect(r.courseTotals.hours).toBe(8);
    expect(r.courseTotals.cost).toBe(2401);
    expect(r.courseTotals.hoursComplete).toBe(false);
    expect(r.readiness.typesIncomplete.map((t) => t.id)).toEqual([blank.id]);
  });

  it("counts people once even with several certificates", () => {
    const a = emp({ gender: "female", population_group: "coloured", disability: true });
    const t1 = type();
    const t2 = type();
    const r = buildSkillsDevelopment(
      [a],
      [t1, t2],
      [cert(a, t1, "2026-05-01"), cert(a, t2, "2026-06-01")],
      [],
      oct2026,
    );
    expect(r.rows).toHaveLength(2);
    expect(r.demographics.peopleTrained).toBe(1);
    expect(r.demographics.disability).toBe(1);
    const female = r.demographics.rows.find((x) => x.key === "female")!;
    expect(female.cells.coloured).toBe(1);
    expect(female.total).toBe(1);
    expect(r.bbbee.blackPeople).toBe(1);
    expect(r.bbbee.blackWomen).toBe(1);
    expect(r.bbbee.disabledPeople).toBe(1);
  });

  it("works out the B-BBEE inputs from the rows", () => {
    const black = emp({ population_group: "indian", gender: "female" });
    const white = emp({ population_group: "white", gender: "male" });
    const undeclared = emp({ population_group: null, gender: null });
    const course = type({ cost_cents: 100000 });
    const learnership = type({ category: "learnership", cost_cents: 500000 });
    const r = buildSkillsDevelopment(
      [black, white, undeclared],
      [course, learnership],
      [
        cert(black, course, "2026-05-01"),
        cert(white, course, "2026-05-01"),
        cert(undeclared, course, "2026-05-01"),
        cert(black, learnership, "2026-07-01"),
        cert(white, learnership, "2026-07-01"),
      ],
      [],
      oct2026,
    );
    expect(r.bbbee.totalSpend).toBe(13000);
    expect(r.bbbee.blackSpend).toBe(6000);
    expect(r.bbbee.blackPeople).toBe(1);
    expect(r.bbbee.blackWomen).toBe(1);
    expect(r.bbbee.programmes).toBe(2);
    expect(r.bbbee.programmesBlack).toBe(1);
    expect(r.readiness.undeclared.map((u) => u.id)).toEqual([undeclared.id]);
    const notDeclared = r.demographics.rows.find((x) => x.key === "undeclared")!;
    expect(notDeclared.cells.undeclared).toBe(1);
  });

  it("keeps foreign nationals in their own column", () => {
    const foreign = emp({ id_type: "passport", population_group: "african" });
    const t = type();
    const r = buildSkillsDevelopment([foreign], [t], [cert(foreign, t, "2026-05-01")], [], oct2026);
    expect(r.demographics.foreign).toBe(1);
    const male = r.demographics.rows.find((x) => x.key === "male")!;
    expect(male.cells.foreign).toBe(1);
    expect(male.cells.african).toBe(0);
  });

  it("falls back to the course cost for the WSP and shows delivered this year", () => {
    const a = emp({ site: "Shaft A" });
    const b = emp({ site: "Shaft B" });
    const t = type({ cost_cents: 200000 });
    const r = buildSkillsDevelopment(
      [a, b],
      [t],
      [cert(a, t, "2026-05-01"), cert(b, t, "2026-05-01")],
      [
        plan({ training_type_id: t.id, seta_year: 2028, site: "Shaft A", planned_count: 3 }),
        plan({
          training_type_id: t.id,
          seta_year: 2028,
          site: "Shaft B",
          planned_count: 2,
          planned_cost_cents: 100000,
        }),
        plan({ training_type_id: t.id, seta_year: 2027, site: "Shaft A", planned_count: 9 }),
      ],
      oct2026,
    );
    expect(r.nextYear.year).toBe(2028);
    expect(r.wsp.groups).toHaveLength(1);
    const g = r.wsp.groups[0];
    expect(g.plannedPeople).toBe(5);
    expect(g.delivered).toBe(2);
    const shaftA = g.rows.find((x) => x.site === "Shaft A")!;
    const shaftB = g.rows.find((x) => x.site === "Shaft B")!;
    expect(shaftA.plannedCost).toBe(6000);
    expect(shaftA.costSource).toBe("type");
    expect(shaftA.deliveredAtSite).toBe(1);
    expect(shaftB.plannedCost).toBe(1000);
    expect(shaftB.costSource).toBe("plan");
    expect(r.wsp.totals.cost).toBe(7000);
    expect(r.wsp.totals.fallbackRows).toBe(1);
    expect(r.byCategory.categories).toEqual(["Short course"]);
    expect(r.byCategory.trained).toEqual([2]);
    expect(r.byCategory.planned).toEqual([5]);
  });

  it("applies the site filter to the WSP rows too", () => {
    const a = emp({ site: "Shaft A" });
    const t = type();
    const r = buildSkillsDevelopment(
      [a],
      [t],
      [],
      [
        plan({ training_type_id: t.id, seta_year: 2028, site: "Shaft A", planned_count: 3 }),
        plan({ training_type_id: t.id, seta_year: 2028, site: "Shaft B", planned_count: 2 }),
      ],
      oct2026,
      "Shaft B",
    );
    expect(r.wsp.totals.people).toBe(2);
    expect(r.site).toBe("Shaft B");
  });

  it("formats rands the South African way", () => {
    expect(formatRands(1234567.5)).toBe("R 1 234 567.50");
    expect(formatRands(0)).toBe("R 0.00");
    expect(formatRands(null)).toBe("");
  });
});
