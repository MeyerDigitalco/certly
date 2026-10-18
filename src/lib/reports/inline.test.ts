import { describe, it, expect } from "vitest";
import {
  leaverCandidates,
  retirementAgeOptions,
  terminationReasonOptions,
} from "./inline";
import type { ReportEmployee } from "./data";

const e = (o: Partial<ReportEmployee>): ReportEmployee =>
  ({
    id: "x",
    surname: "Zulu",
    names: "A",
    id_number: null,
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
    created_at: "2020-01-01T00:00:00Z",
    ...o,
  }) as ReportEmployee;

describe("terminationReasonOptions", () => {
  it("groups by class and can restrict to fault", () => {
    const all = terminationReasonOptions();
    expect(all.some((o) => o.group === "No fault")).toBe(true);
    expect(all.some((o) => o.group === "Fault")).toBe(true);
    const fault = terminationReasonOptions(true);
    expect(fault.every((o) => o.group === "Fault")).toBe(true);
    expect(fault.map((o) => o.value)).toEqual(["resignation", "dismissal", "abscondment"]);
  });
});

describe("retirementAgeOptions", () => {
  it("runs 50 to 75 and marks the workspace default", () => {
    const opts = retirementAgeOptions(63);
    expect(opts).toHaveLength(26);
    expect(opts[0].value).toBe("50");
    expect(opts[25].value).toBe("75");
    expect(opts.find((o) => o.value === "63")?.label).toBe("63 (default)");
  });
});

describe("leaverCandidates", () => {
  it("lists only people in service at period end, sorted, within the site", () => {
    const out = leaverCandidates(
      [
        e({ id: "1", surname: "Mokoena" }),
        e({ id: "2", surname: "Adams", terminated_at: "2026-07-31", termination_reason: "resignation" }),
        e({ id: "3", surname: "Botha", engaged_at: "2026-09-15" }),
        e({ id: "4", surname: "Cele", site: "Shaft 2" }),
        e({ id: "5", surname: "Dlamini", site: null }),
      ],
      "2026-08-31",
      "Shaft 1",
    );
    expect(out.map((c) => c.id)).toEqual(["1"]);
    const all = leaverCandidates(
      [e({ id: "1", surname: "Mokoena" }), e({ id: "5", surname: "Dlamini", site: null })],
      "2026-08-31",
    );
    expect(all.map((c) => c.name)).toEqual(["Dlamini, A", "Mokoena, A"]);
    expect(all[0].site).toBe("Unassigned");
  });
});
