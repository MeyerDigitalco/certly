import { describe, expect, it } from "vitest";
import type { Absence } from "@/lib/types/database";
import type { ReportEmployee } from "@/lib/reports/data";
import { ABSENCE_REASONS, periodFor } from "@/lib/hr/operations";
import {
  availabilityPct,
  buildLabourUnavailability,
  daysInPeriod,
  repeatUnplanned,
  spellDaysInPeriod,
} from "./labour-unavailability";

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

function abs(over: Partial<Absence> & { employee_id: string }): Absence {
  seq += 1;
  return {
    id: `a${seq}`,
    organisation_id: "org",
    starts_on: "2026-09-10",
    ends_on: "2026-09-10",
    reason: "sick_leave",
    half_day: false,
    notes: null,
    created_by: null,
    created_at: "2026-09-10T00:00:00Z",
    updated_at: "2026-09-10T00:00:00Z",
    ...over,
  };
}

const sept = periodFor(2026, 9);

describe("daysInPeriod", () => {
  it("counts calendar days inclusive of both ends", () => {
    expect(daysInPeriod(periodFor(2026, 9))).toBe(30);
    expect(daysInPeriod(periodFor(2026, 2))).toBe(28);
    expect(daysInPeriod(periodFor(2028, 2))).toBe(29);
    expect(daysInPeriod(periodFor(2026, 10))).toBe(31);
  });
});

describe("spellDaysInPeriod", () => {
  it("counts only the days inside the month for a spell straddling the boundary", () => {
    const a = abs({ employee_id: "x", starts_on: "2026-08-29", ends_on: "2026-09-03" });
    expect(spellDaysInPeriod(a, sept)).toBe(3);
    expect(spellDaysInPeriod(a, periodFor(2026, 8))).toBe(3);
    expect(spellDaysInPeriod(a, periodFor(2026, 10))).toBe(0);
  });

  it("counts a half day as 0.5", () => {
    const a = abs({ employee_id: "x", half_day: true });
    expect(spellDaysInPeriod(a, sept)).toBe(0.5);
  });
});

describe("availabilityPct", () => {
  it("is 0 and never NaN when nobody is in service", () => {
    expect(availabilityPct(0, 0)).toBe(0);
    expect(Number.isNaN(availabilityPct(0, 5))).toBe(false);
  });

  it("is 100 when nothing is lost", () => {
    expect(availabilityPct(300, 0)).toBe(100);
  });
});

describe("buildLabourUnavailability", () => {
  it("reports 100% availability when there are no absences", () => {
    const employees = [emp(), emp(), emp()];
    const r = buildLabourUnavailability(employees, [], sept);
    expect(r.stats.inService).toBe(3);
    expect(r.stats.calendarDays).toBe(30);
    expect(r.stats.availableManDays).toBe(90);
    expect(r.stats.daysLost).toBe(0);
    expect(r.stats.availabilityPct).toBe(100);
    expect(r.hasAnyAbsence).toBe(false);
    expect(r.spells).toHaveLength(0);
  });

  it("gives 0 not NaN when nobody is in service", () => {
    const r = buildLabourUnavailability([], [], sept);
    expect(r.stats.availableManDays).toBe(0);
    expect(r.stats.availabilityPct).toBe(0);
    expect(Number.isNaN(r.stats.availabilityPct)).toBe(false);
    expect(r.bySiteTotal.availabilityPct).toBe(0);
    expect(r.trend.every((m) => !Number.isNaN(m.availabilityPct))).toBe(true);
  });

  it("sums days lost from the days inside the month and classifies by reason", () => {
    const a = emp();
    const b = emp();
    const absences = [
      abs({ employee_id: a.id, starts_on: "2026-08-30", ends_on: "2026-09-02", reason: "annual_leave" }),
      abs({ employee_id: b.id, starts_on: "2026-09-15", ends_on: "2026-09-15", reason: "sick_leave", half_day: true }),
      abs({ employee_id: b.id, starts_on: "2026-09-20", ends_on: "2026-09-21", reason: "absent_without_leave" }),
    ];
    const r = buildLabourUnavailability([a, b], absences, sept);
    expect(r.stats.daysLost).toBe(4.5);
    expect(r.stats.plannedDaysLost).toBe(2);
    expect(r.stats.unplannedDaysLost).toBe(2.5);
    expect(r.stats.awolDays).toBe(2);
    expect(r.stats.availableManDays).toBe(60);
    expect(r.stats.availabilityPct).toBe(92.5);
    expect(r.stats.spellCount).toBe(3);

    const annual = r.byReason.find((x) => x.reason === "annual_leave");
    const sick = r.byReason.find((x) => x.reason === "sick_leave");
    expect(annual?.total).toBe(2);
    expect(annual?.planned).toBe(true);
    expect(sick?.total).toBe(0.5);
    expect(sick?.planned).toBe(false);
    expect(r.plannedSubtotal.total).toBe(2);
    expect(r.unplannedSubtotal.total).toBe(2.5);
    expect(r.grandTotal.total).toBe(4.5);
  });

  it("follows ABSENCE_REASONS for the planned flag and keeps every reason as a row", () => {
    const r = buildLabourUnavailability([emp()], [], sept);
    expect(r.byReason).toHaveLength(ABSENCE_REASONS.length);
    for (const reason of ABSENCE_REASONS) {
      const row = r.byReason.find((x) => x.reason === reason.value);
      expect(row?.planned).toBe(reason.planned);
      expect(row?.total).toBe(0);
    }
  });

  it("excludes terminated people from the stats and shows their spells nowhere", () => {
    const stayed = emp();
    const left = emp({ terminated_at: "2026-09-15" });
    const absences = [
      abs({ employee_id: stayed.id, starts_on: "2026-09-01", ends_on: "2026-09-01" }),
      abs({ employee_id: left.id, starts_on: "2026-09-02", ends_on: "2026-09-05", reason: "absent_without_leave" }),
      abs({ employee_id: left.id, starts_on: "2026-08-01", ends_on: "2026-08-02", reason: "sick_leave" }),
      abs({ employee_id: left.id, starts_on: "2026-07-01", ends_on: "2026-07-02", reason: "sick_leave" }),
    ];
    const r = buildLabourUnavailability([stayed, left], absences, sept);
    expect(r.stats.inService).toBe(1);
    expect(r.stats.daysLost).toBe(1);
    expect(r.stats.awolDays).toBe(0);
    expect(r.spells.map((s) => s.employeeId)).toEqual([stayed.id]);
    expect(r.repeat).toHaveLength(0);
    expect(r.grandTotal.total).toBe(1);
  });

  it("counts people engaged during the month and ignores people engaged after it", () => {
    const during = emp({ engaged_at: "2026-09-20" });
    const after = emp({ engaged_at: "2026-10-01" });
    const r = buildLabourUnavailability([during, after], [], sept);
    expect(r.stats.inService).toBe(1);
  });

  it("honours the site filter across stats, reasons, sites and spells", () => {
    const a = emp({ site: "Shaft A" });
    const b = emp({ site: "Shaft B" });
    const absences = [
      abs({ employee_id: a.id, starts_on: "2026-09-01", ends_on: "2026-09-03", reason: "sick_leave" }),
      abs({ employee_id: b.id, starts_on: "2026-09-01", ends_on: "2026-09-10", reason: "annual_leave" }),
    ];
    const all = buildLabourUnavailability([a, b], absences, sept);
    expect(all.sites).toEqual(["Shaft A", "Shaft B"]);
    expect(all.stats.daysLost).toBe(13);
    expect(all.bySite.map((s) => s.total)).toEqual([3, 10]);

    const onlyB = buildLabourUnavailability([a, b], absences, sept, "Shaft B");
    expect(onlyB.site).toBe("Shaft B");
    expect(onlyB.sites).toEqual(["Shaft B"]);
    expect(onlyB.stats.inService).toBe(1);
    expect(onlyB.stats.daysLost).toBe(10);
    expect(onlyB.stats.plannedDaysLost).toBe(10);
    expect(onlyB.spells).toHaveLength(1);
    expect(onlyB.spells[0].employeeId).toBe(b.id);
    expect(onlyB.byReason.find((x) => x.reason === "sick_leave")?.total).toBe(0);
    expect(onlyB.bySite).toHaveLength(1);
  });

  it("builds a six month trend ending on the selected month, oldest first", () => {
    const e = emp();
    const absences = [
      abs({ employee_id: e.id, starts_on: "2026-07-05", ends_on: "2026-07-06", reason: "absent_without_leave" }),
    ];
    const r = buildLabourUnavailability([e], absences, sept);
    expect(r.trend).toHaveLength(6);
    expect(r.trend.map((m) => m.key)).toEqual([
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
    expect(r.trend[3].daysLost).toBe(2);
    expect(r.trend[3].awolDays).toBe(2);
    expect(r.trend[5].daysLost).toBe(0);
    expect(r.trend[0].shortLabel).toBe("Apr");
  });

  it("flags a spell that touches the month without a day inside it as 0 and drops it", () => {
    const e = emp();
    const absences = [abs({ employee_id: e.id, starts_on: "2026-10-01", ends_on: "2026-10-02" })];
    const r = buildLabourUnavailability([e], absences, sept);
    expect(r.spells).toHaveLength(0);
    expect(r.hasAnyAbsence).toBe(true);
  });
});

describe("repeatUnplanned", () => {
  it("lists people with three or more unplanned spells in the trailing 90 days", () => {
    const three = emp();
    const two = emp();
    const planned = emp();
    const absences = [
      abs({ employee_id: three.id, starts_on: "2026-07-10", ends_on: "2026-07-10", reason: "sick_leave" }),
      abs({ employee_id: three.id, starts_on: "2026-08-10", ends_on: "2026-08-11", reason: "unpaid_leave" }),
      abs({ employee_id: three.id, starts_on: "2026-09-10", ends_on: "2026-09-10", reason: "absent_without_leave", half_day: true }),
      abs({ employee_id: two.id, starts_on: "2026-08-10", ends_on: "2026-08-10", reason: "sick_leave" }),
      abs({ employee_id: two.id, starts_on: "2026-09-10", ends_on: "2026-09-10", reason: "sick_leave" }),
      abs({ employee_id: planned.id, starts_on: "2026-07-10", ends_on: "2026-07-10", reason: "annual_leave" }),
      abs({ employee_id: planned.id, starts_on: "2026-08-10", ends_on: "2026-08-10", reason: "annual_leave" }),
      abs({ employee_id: planned.id, starts_on: "2026-09-10", ends_on: "2026-09-10", reason: "study_leave" }),
    ];
    const rows = repeatUnplanned([three, two, planned], absences, sept.end);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(three.id);
    expect(rows[0].spells).toBe(3);
    expect(rows[0].days).toBe(3.5);
  });

  it("ignores spells that fall outside the 90 day window", () => {
    const e = emp();
    const absences = [
      abs({ employee_id: e.id, starts_on: "2026-06-01", ends_on: "2026-06-01", reason: "sick_leave" }),
      abs({ employee_id: e.id, starts_on: "2026-08-10", ends_on: "2026-08-10", reason: "sick_leave" }),
      abs({ employee_id: e.id, starts_on: "2026-09-10", ends_on: "2026-09-10", reason: "sick_leave" }),
    ];
    expect(repeatUnplanned([e], absences, sept.end)).toHaveLength(0);
    expect(repeatUnplanned([e], absences, sept.end, 365)).toHaveLength(1);
    expect(repeatUnplanned([e], absences, sept.end, 90, 2)).toHaveLength(1);
  });

  it("counts the window as 90 days inclusive of the end date", () => {
    const e = emp();
    const absences = [
      abs({ employee_id: e.id, starts_on: "2026-07-03", ends_on: "2026-07-03", reason: "sick_leave" }),
      abs({ employee_id: e.id, starts_on: "2026-07-02", ends_on: "2026-07-02", reason: "sick_leave" }),
      abs({ employee_id: e.id, starts_on: "2026-08-01", ends_on: "2026-08-01", reason: "sick_leave" }),
      abs({ employee_id: e.id, starts_on: "2026-09-30", ends_on: "2026-09-30", reason: "sick_leave" }),
    ];
    const rows = repeatUnplanned([e], absences, "2026-09-30");
    expect(rows).toHaveLength(1);
    expect(rows[0].spells).toBe(3);
    expect(rows[0].days).toBe(3);
  });

  it("drops people no longer in service on the as of date", () => {
    const e = emp({ terminated_at: "2026-09-30" });
    const absences = [
      abs({ employee_id: e.id, starts_on: "2026-09-01", ends_on: "2026-09-01", reason: "sick_leave" }),
      abs({ employee_id: e.id, starts_on: "2026-09-02", ends_on: "2026-09-02", reason: "sick_leave" }),
      abs({ employee_id: e.id, starts_on: "2026-09-03", ends_on: "2026-09-03", reason: "sick_leave" }),
    ];
    expect(repeatUnplanned([e], absences, "2026-09-30")).toHaveLength(0);
  });
});
