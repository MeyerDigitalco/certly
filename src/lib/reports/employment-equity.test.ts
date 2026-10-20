import { describe, expect, it } from "vitest";
import type { ReportEmployee } from "@/lib/reports/data";
import { periodFor } from "@/lib/hr/operations";
import {
  buildEmploymentEquity,
  eeColumnKey,
  eeCompleteness,
  eeMatrix,
  missingFields,
} from "./employment-equity";

let seq = 0;

function emp(over: Partial<ReportEmployee> = {}): ReportEmployee {
  seq += 1;
  return {
    id: `e${seq}`,
    surname: `Surname${seq}`,
    names: `Name${seq}`,
    id_number: null,
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
    occupational_level: "unskilled",
    ofo_code: null,
    ee_declared_at: "2025-01-01",
    created_at: "2020-01-01T00:00:00Z",
    ...over,
  } as ReportEmployee;
}

const oct = periodFor(2026, 10);

describe("eeColumnKey", () => {
  it("puts a foreign national in the foreign column and not in A/C/I/W", () => {
    expect(eeColumnKey(emp({ id_type: "passport", gender: "female", population_group: "african" }))).toBe(
      "foreign_female",
    );
    expect(eeColumnKey(emp({ id_type: "passport", gender: "male", population_group: "white" }))).toBe(
      "foreign_male",
    );
  });

  it("puts a missing group with a gender in that gender's Not declared", () => {
    expect(eeColumnKey(emp({ gender: "female", population_group: null }))).toBe("female_nd");
    expect(eeColumnKey(emp({ gender: "male", population_group: null }))).toBe("male_nd");
  });

  it("puts a missing gender in the final Not declared column", () => {
    expect(eeColumnKey(emp({ gender: null, population_group: "indian" }))).toBe("nd");
    expect(eeColumnKey(emp({ gender: null, population_group: null, id_type: "passport" }))).toBe("nd");
  });

  it("maps declared South Africans to the matching cell", () => {
    expect(eeColumnKey(emp({ gender: "female", population_group: "coloured" }))).toBe("female_coloured");
  });
});

describe("eeMatrix", () => {
  it("places people by occupational level and keeps foreign nationals out of A/C/I/W", () => {
    const m = eeMatrix([
      emp({ occupational_level: "top_management", gender: "male", population_group: "white" }),
      emp({ occupational_level: "top_management", id_type: "passport", gender: "male", population_group: "white" }),
      emp({ occupational_level: null, gender: "female", population_group: "african" }),
    ]);
    const top = m.rows.find((r) => r.key === "top_management")!;
    expect(top.cells.male_white).toBe(1);
    expect(top.cells.foreign_male).toBe(1);
    expect(top.total).toBe(2);
    const unset = m.rows.find((r) => r.key === "unset")!;
    expect(unset.cells.female_african).toBe(1);
    expect(m.totals.total).toBe(3);
    expect(m.totals.cells.male_white).toBe(1);
    expect(m.rows[m.rows.length - 1].key).toBe("total");
  });

  it("omits the Level not set row when every level is set", () => {
    const m = eeMatrix([emp(), emp()]);
    expect(m.rows.some((r) => r.key === "unset")).toBe(false);
    expect(m.rows.length).toBe(7);
  });
});

describe("buildEmploymentEquity", () => {
  it("counts only disability === true in the disability matrix", () => {
    const r = buildEmploymentEquity(
      [emp({ disability: true }), emp({ disability: false }), emp({ disability: null })],
      oct,
    );
    expect(r.profile.totals.total).toBe(3);
    expect(r.profileDisabled.totals.total).toBe(1);
  });

  it("counts recruits by engaged_at within the EE year", () => {
    const r = buildEmploymentEquity(
      [
        emp({ engaged_at: "2026-09-01" }),
        emp({ engaged_at: "2026-10-15" }),
        emp({ engaged_at: "2026-08-31" }),
        emp({ engaged_at: "2027-09-01" }),
      ],
      oct,
    );
    expect(r.year.start).toBe("2026-09-01");
    expect(r.year.end).toBe("2027-08-31");
    expect(r.recruits.totals.total).toBe(2);
  });

  it("counts terminations by terminated_at within the EE year", () => {
    const r = buildEmploymentEquity(
      [
        emp({ terminated_at: "2026-09-30" }),
        emp({ terminated_at: "2027-08-31" }),
        emp({ terminated_at: "2026-08-31" }),
        emp(),
      ],
      oct,
    );
    expect(r.terminations.totals.total).toBe(2);
  });

  it("excludes terminated people from the headcount", () => {
    const r = buildEmploymentEquity(
      [emp(), emp({ terminated_at: "2026-10-15" }), emp({ terminated_at: "2026-11-01" }), emp({ engaged_at: "2026-11-01" })],
      oct,
    );
    expect(r.headcount).toBe(2);
    expect(r.profile.totals.total).toBe(2);
  });

  it("flags a designated employer at exactly the threshold", () => {
    const fortyNine = Array.from({ length: 49 }, () => emp());
    expect(buildEmploymentEquity(fortyNine, oct).designated).toBe(false);
    expect(buildEmploymentEquity([...fortyNine, emp()], oct).designated).toBe(true);
  });

  it("honours the site filter", () => {
    const r = buildEmploymentEquity(
      [emp({ site: "Shaft A" }), emp({ site: "Shaft B" }), emp({ site: null })],
      oct,
      "Shaft B",
    );
    expect(r.headcount).toBe(1);
    const unassigned = buildEmploymentEquity([emp({ site: null })], oct, "Unassigned");
    expect(unassigned.headcount).toBe(1);
  });

  it("summarises by population group with foreign nationals separate", () => {
    const r = buildEmploymentEquity(
      [
        emp({ population_group: "african" }),
        emp({ population_group: "white", id_type: "passport" }),
        emp({ population_group: null }),
      ],
      oct,
    );
    expect(r.byGroup).toEqual({ african: 1, coloured: 0, indian: 0, white: 0, notDeclared: 1, foreign: 1 });
  });

  it("splits male and female per level for the chart", () => {
    const r = buildEmploymentEquity(
      [
        emp({ occupational_level: "unskilled", gender: "male" }),
        emp({ occupational_level: "unskilled", gender: "female", id_type: "passport" }),
        emp({ occupational_level: "unskilled", gender: null }),
      ],
      oct,
    );
    expect(r.byLevel.categories[5]).toBe("Unskilled");
    expect(r.byLevel.male[5]).toBe(1);
    expect(r.byLevel.female[5]).toBe(1);
  });
});

describe("eeCompleteness", () => {
  it("lists which declarations are missing per person", () => {
    expect(missingFields(emp())).toEqual([]);
    expect(missingFields(emp({ gender: null, disability: null }))).toEqual(["gender", "disability"]);
    expect(missingFields(emp({ population_group: null, id_type: "passport" }))).toEqual([]);
    const c = eeCompleteness([
      emp(),
      emp({ gender: null, occupational_level: null }),
      emp({ population_group: null }),
    ]);
    expect(c.missingGender).toBe(1);
    expect(c.missingGroup).toBe(1);
    expect(c.missingDisability).toBe(0);
    expect(c.missingLevel).toBe(1);
    expect(c.people.length).toBe(2);
    expect(c.complete).toBe(1);
  });
});
