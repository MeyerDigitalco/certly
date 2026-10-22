import { describe, expect, it } from "vitest";
import type { ReportEmployee, TrainingDelivered } from "@/lib/reports/data";
import type { Absence, CompanyDocument, RegisterRow, TrainingType } from "@/lib/types/database";
import type { AuditEntry } from "@/lib/hr/audit";
import {
  buildEvidenceSheets,
  companyDocumentStatus,
  leaversInWindow,
  oneYearBefore,
  shiftDays,
  trainingDeliveredRows,
  type EvidenceInput,
} from "./evidence";

let seq = 0;

function emp(over: Partial<ReportEmployee> = {}): ReportEmployee {
  seq += 1;
  return {
    id: `e${seq}`,
    surname: `Surname${seq}`,
    names: `Name${seq}`,
    id_number: `900101500008${seq % 10}`,
    id_type: "sa_id",
    id_country: null,
    site: "Shaft A",
    designation: "Miner",
    superior: null,
    date_of_birth: "1990-01-01",
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
    nqf_level: null,
    accredited: true,
    counts_for_atr: true,
    ...over,
  };
}

function delivered(over: Partial<TrainingDelivered> = {}): TrainingDelivered {
  seq += 1;
  return {
    id: `c${seq}`,
    employee_id: "e1",
    training_type_id: "t1",
    training_date: "2026-06-01",
    expiry_date: null,
    ...over,
  };
}

function doc(over: Partial<CompanyDocument> = {}): CompanyDocument {
  seq += 1;
  return {
    id: `d${seq}`,
    organisation_id: "org",
    category: "coida",
    title: `Document ${seq}`,
    file_path: null,
    issued_at: null,
    expires_at: null,
    sort_order: seq,
    created_by: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

function absence(over: Partial<Absence> = {}): Absence {
  seq += 1;
  return {
    id: `a${seq}`,
    organisation_id: "org",
    employee_id: "e1",
    starts_on: "2026-05-04",
    ends_on: "2026-05-06",
    reason: "sick_leave",
    half_day: false,
    notes: null,
    created_by: null,
    created_at: "2026-05-04T00:00:00Z",
    updated_at: "2026-05-04T00:00:00Z",
    ...over,
  };
}

function registerRow(over: Partial<RegisterRow> = {}): RegisterRow {
  seq += 1;
  return {
    certification_id: `cert${seq}`,
    employee_id: "e1",
    surname: "Surname",
    names: "Name",
    id_number: "9001015000089",
    id_type: "sa_id",
    site: "Shaft A",
    superior: null,
    training_type: "Induction",
    training_date: "2026-01-01",
    expiry_date: "2027-01-01",
    status: "valid",
    days_left: 100,
    ...over,
  } as RegisterRow;
}

function auditEntry(over: Partial<AuditEntry> = {}): AuditEntry {
  seq += 1;
  return {
    id: `log${seq}`,
    actor: "user-1",
    actorEmail: "owner@example.com",
    action: "UPDATE",
    table_name: "employees",
    row_id: "e1",
    at: "2026-10-01T08:00:00Z",
    summary: "Employee changed",
    changed: [],
    ...over,
  };
}

const AS_OF = "2026-10-22";

function input(over: Partial<EvidenceInput> = {}): EvidenceInput {
  return {
    asOf: AS_OF,
    generatedBy: "admin@example.com",
    generatedOn: AS_OF,
    org: {
      name: "Test Contractors",
      slug: "test",
      sector: "mining",
      seta: "MQA",
      sdl_number: "L123",
      ee_reference: "EE999",
      due_soon_days: 30,
    },
    employees: [],
    register: [],
    companyDocuments: [],
    renewals: { expired: [], dueSeven: [], dueThirty: [], horizonDays: 30 },
    absences: [],
    trainingTypes: [],
    trainingDelivered: [],
    audit: [],
    auditReadable: true,
    ...over,
  };
}

function sheet(sheets: ReturnType<typeof buildEvidenceSheets>, name: string) {
  const found = sheets.find((s) => s.name === name);
  if (!found) throw new Error(`No sheet named ${name}`);
  return found;
}

describe("date helpers", () => {
  it("goes back exactly one calendar year and clamps 29 February", () => {
    expect(oneYearBefore("2026-10-22")).toBe("2025-10-22");
    expect(oneYearBefore("2028-02-29")).toBe("2027-02-28");
  });

  it("shifts days across month and year ends", () => {
    expect(shiftDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDays("2026-10-22", -90)).toBe("2026-07-24");
  });
});

describe("leavers", () => {
  it("uses a 12 month window that includes both ends", () => {
    const onStart = emp({ terminated_at: "2025-10-22", termination_reason: "resignation" });
    const dayBefore = emp({ terminated_at: "2025-10-21", termination_reason: "resignation" });
    const onEnd = emp({ terminated_at: "2026-10-22", termination_reason: "retirement" });
    const dayAfter = emp({ terminated_at: "2026-10-23", termination_reason: "retirement" });
    const stillHere = emp();
    const ids = leaversInWindow([onStart, dayBefore, onEnd, dayAfter, stillHere], AS_OF).map((e) => e.id);
    expect(ids).toContain(onStart.id);
    expect(ids).toContain(onEnd.id);
    expect(ids).not.toContain(dayBefore.id);
    expect(ids).not.toContain(dayAfter.id);
    expect(ids).not.toContain(stillHere.id);
  });

  it("labels the reason and the fault class", () => {
    const sheets = buildEvidenceSheets(
      input({
        employees: [
          emp({ terminated_at: "2026-03-01", termination_reason: "abscondment" }),
          emp({ terminated_at: "2026-04-01", termination_reason: "retrenchment" }),
        ],
      }),
    );
    const rows = sheet(sheets, "Leavers").rows;
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => [r.reason, r.cls])).toEqual([
      ["Retrenchment", "No fault"],
      ["Abscondment", "Fault"],
    ]);
  });
});

describe("company document status", () => {
  it("applies the 30 day window against asOf", () => {
    expect(companyDocumentStatus("2026-10-21", AS_OF).status).toBe("Expired");
    expect(companyDocumentStatus("2026-10-22", AS_OF).status).toBe("Due soon");
    expect(companyDocumentStatus("2026-11-21", AS_OF).status).toBe("Due soon");
    expect(companyDocumentStatus("2026-11-22", AS_OF).status).toBe("Current");
    expect(companyDocumentStatus(null, AS_OF)).toEqual({ status: "No expiry", daysLeft: null });
  });

  it("writes the status and days left on the sheet", () => {
    const sheets = buildEvidenceSheets(
      input({
        companyDocuments: [
          doc({ category: "coida", title: "Letter of good standing", expires_at: "2026-10-01" }),
          doc({ category: "bbbee", title: "B-BBEE certificate", expires_at: "2027-06-30" }),
        ],
      }),
    );
    const rows = sheet(sheets, "Company documents").rows;
    expect(rows[0]).toMatchObject({ category: "Compensation Fund", status: "Expired", daysLeft: -21 });
    expect(rows[1]).toMatchObject({ category: "B-BBEE", status: "Current" });
  });
});

describe("training delivered", () => {
  it("respects the SETA year boundary and counts_for_atr", () => {
    const person = emp();
    const atr = type({ id: "atr", counts_for_atr: true });
    const induction = type({ id: "ind", category: "induction", counts_for_atr: false });
    const rows = trainingDeliveredRows(
      [
        delivered({ employee_id: person.id, training_type_id: "atr", training_date: "2026-04-01" }),
        delivered({ employee_id: person.id, training_type_id: "atr", training_date: "2026-03-31" }),
        delivered({ employee_id: person.id, training_type_id: "atr", training_date: "2027-03-31" }),
        delivered({ employee_id: person.id, training_type_id: "atr", training_date: "2027-04-01" }),
        delivered({ employee_id: person.id, training_type_id: "ind", training_date: "2026-06-01" }),
        delivered({ employee_id: person.id, training_type_id: "atr", training_date: null }),
      ],
      [atr, induction],
      [person],
      AS_OF,
    );
    expect(rows.map((r) => r.date)).toEqual(["2026-04-01", "2027-03-31"]);
    expect(rows[0].cost).toBe(1500);
    expect(rows[0].hours).toBe(8);
    expect(rows[0].category).toBe("Short course");
  });

  it("keeps training delivered to someone who has since left", () => {
    const leaver = emp({ terminated_at: "2026-09-01", termination_reason: "resignation" });
    const t = type({ id: "atr" });
    const rows = trainingDeliveredRows(
      [delivered({ employee_id: leaver.id, training_type_id: "atr", training_date: "2026-05-01" })],
      [t],
      [leaver],
      AS_OF,
    );
    expect(rows).toHaveLength(1);
  });
});

describe("people sheet", () => {
  it("excludes terminated people and anyone not yet engaged", () => {
    const here = emp({ surname: "Here" });
    const gone = emp({ surname: "Gone", terminated_at: "2026-01-15", termination_reason: "dismissal" });
    const future = emp({ surname: "Future", engaged_at: "2026-11-01" });
    const sheets = buildEvidenceSheets(input({ employees: [here, gone, future] }));
    const rows = sheet(sheets, "People").rows;
    expect(rows.map((r) => r.surname)).toEqual(["Here"]);
  });

  it("labels the EEA1 fields and flags foreign nationals", () => {
    const sheets = buildEvidenceSheets(
      input({
        employees: [
          emp({
            id_type: "passport",
            gender: "female",
            population_group: null,
            disability: null,
            occupational_level: "skilled_technical",
          }),
        ],
      }),
    );
    const row = sheet(sheets, "People").rows[0];
    expect(row).toMatchObject({
      idType: "Passport",
      gender: "Female",
      group: "",
      disability: "",
      foreign: "Yes",
      level: "Skilled technical",
    });
    expect(sheet(sheets, "People").notes).toContain(
      "Population group, gender and disability are the employee's own EEA1 declarations.",
    );
  });
});

describe("cover sheet", () => {
  function coverValue(sheets: ReturnType<typeof buildEvidenceSheets>, startsWith: string) {
    const row = sheet(sheets, "Cover").rows.find((r) => String(r.label).startsWith(startsWith));
    return row?.value;
  }

  it("flags a designated employer at 50 in service and not at 49", () => {
    const fortyNine = Array.from({ length: 49 }, () => emp());
    expect(coverValue(buildEvidenceSheets(input({ employees: fortyNine })), "Designated employer")).toBe("No");
    const fifty = [...fortyNine, emp()];
    expect(coverValue(buildEvidenceSheets(input({ employees: fifty })), "Designated employer")).toBe("Yes");
    expect(coverValue(buildEvidenceSheets(input({ employees: fifty })), "People in service")).toBe(50);
  });

  it("does not count leavers toward the designated threshold", () => {
    const people = [
      ...Array.from({ length: 49 }, () => emp()),
      emp({ terminated_at: "2026-06-30", termination_reason: "resignation" }),
    ];
    const sheets = buildEvidenceSheets(input({ employees: people }));
    expect(coverValue(sheets, "Designated employer")).toBe("No");
    expect(coverValue(sheets, "People who left")).toBe(1);
  });

  it("names the sector, the Act and the workspace", () => {
    const sheets = buildEvidenceSheets(input());
    expect(coverValue(sheets, "Sector")).toBe("Mining and minerals");
    expect(coverValue(sheets, "Primary Act")).toBe("Mine Health and Safety Act 29 of 1996");
    expect(coverValue(sheets, "Workspace")).toBe("certly.co.za/test");
    expect(coverValue(sheets, "As at")).toBe(AS_OF);
  });
});

describe("ID numbers", () => {
  it("are strings with a text number format on every sheet that carries them", () => {
    const person = emp({ id_number: "9001015000089" });
    const t = type({ id: "atr" });
    const sheets = buildEvidenceSheets(
      input({
        employees: [person],
        register: [registerRow({ employee_id: person.id, id_number: "9001015000089" })],
        trainingTypes: [t],
        trainingDelivered: [
          delivered({ employee_id: person.id, training_type_id: "atr", training_date: "2026-06-01" }),
        ],
      }),
    );
    for (const name of ["Register", "People", "Training delivered"]) {
      const s = sheet(sheets, name);
      const col = s.columns.find((c) => c.key === "idNumber");
      expect(col?.numFmt).toBe("@");
      expect(s.rows.length).toBeGreaterThan(0);
      for (const row of s.rows) {
        expect(typeof row.idNumber).toBe("string");
        expect(row.idNumber).toBe("9001015000089");
      }
    }
  });
});

describe("register sheet", () => {
  it("recomputes status against asOf and sorts by surname then training type", () => {
    const sheets = buildEvidenceSheets(
      input({
        register: [
          registerRow({ surname: "Zulu", training_type: "First aid", expiry_date: "2026-10-01" }),
          registerRow({ surname: "Abrahams", training_type: "Working at heights", expiry_date: "2026-11-01" }),
          registerRow({ surname: "Abrahams", training_type: "First aid", expiry_date: null }),
        ],
      }),
    );
    const rows = sheet(sheets, "Register").rows;
    expect(rows.map((r) => `${r.surname}/${r.trainingType}`)).toEqual([
      "Abrahams/First aid",
      "Abrahams/Working at heights",
      "Zulu/First aid",
    ]);
    expect(rows[0]).toMatchObject({ status: "No expiry", daysLeft: null });
    expect(rows[1]).toMatchObject({ status: "Due soon", daysLeft: 10 });
    expect(rows[2]).toMatchObject({ status: "Expired", daysLeft: -21 });
  });
});

describe("absences and EEA2", () => {
  it("counts only the days inside the 12 month window", () => {
    const person = emp();
    const sheets = buildEvidenceSheets(
      input({
        employees: [person],
        absences: [
          absence({ employee_id: person.id, starts_on: "2025-10-20", ends_on: "2025-10-23" }),
          absence({ employee_id: person.id, starts_on: "2025-01-01", ends_on: "2025-01-05" }),
          absence({ employee_id: person.id, starts_on: "2026-06-01", ends_on: "2026-06-01", half_day: true, reason: "annual_leave" }),
        ],
      }),
    );
    const rows = sheet(sheets, "Absences").rows;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ firstDay: "2025-10-20", days: 2, planned: "Unplanned", reason: "Sick leave" });
    expect(rows[1]).toMatchObject({ days: 0.5, planned: "Planned", reason: "Annual leave" });
  });

  it("builds the EEA2 matrix over people in service only", () => {
    const sheets = buildEvidenceSheets(
      input({
        employees: [
          emp({ gender: "male", population_group: "african", occupational_level: "unskilled" }),
          emp({ gender: "female", population_group: "white", occupational_level: "top_management" }),
          emp({ id_type: "passport", gender: "male", occupational_level: "unskilled" }),
          emp({ gender: "male", population_group: "african", terminated_at: "2026-01-01", termination_reason: "resignation" }),
        ],
      }),
    );
    const s = sheet(sheets, "EEA2 profile");
    expect(s.columns.map((c) => c.header)).toEqual([
      "Occupational level",
      "Male A",
      "Male C",
      "Male I",
      "Male W",
      "Male not declared",
      "Female A",
      "Female C",
      "Female I",
      "Female W",
      "Female not declared",
      "Foreign M",
      "Foreign F",
      "Not declared",
      "Total",
    ]);
    const unskilled = s.rows.find((r) => r.level === "Unskilled");
    expect(unskilled).toMatchObject({ male_african: 1, foreign_male: 1, total: 2 });
    expect(s.totals).toMatchObject({ level: "Total", total: 3 });
  });
});

describe("workbook shape", () => {
  it("returns the ten sheets in order", () => {
    const names = buildEvidenceSheets(input()).map((s) => s.name);
    expect(names).toEqual([
      "Cover",
      "Register",
      "People",
      "Leavers",
      "Company documents",
      "Expiring",
      "EEA2 profile",
      "Absences",
      "Training delivered",
      "Activity",
    ]);
  });

  it("caps activity at 500 rows and explains when the log is not readable", () => {
    const entries = Array.from({ length: 520 }, () => auditEntry());
    const readable = sheet(buildEvidenceSheets(input({ audit: entries })), "Activity");
    expect(readable.rows).toHaveLength(500);
    expect(readable.notes?.[0]).toBe("Written by database triggers. Cannot be edited or deleted by any user.");
    const hidden = sheet(buildEvidenceSheets(input({ auditReadable: false })), "Activity");
    expect(hidden.rows).toHaveLength(0);
    expect(hidden.notes?.some((n) => n.includes("workspace owner only"))).toBe(true);
  });

  it("never writes an em dash into a title, note or header", () => {
    const sheets = buildEvidenceSheets(input({ employees: [emp()] }));
    const text = JSON.stringify(sheets);
    expect(text.includes(String.fromCharCode(0x2014))).toBe(false);
  });
});
