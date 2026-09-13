import { describe, it, expect } from "vitest";
import {
  splitCsvLine,
  parseImportDate,
  parseImport,
  countIssues,
  IMPORT_TEMPLATE,
  IMPORT_MAX_ROWS,
} from "./import";

const HEADER =
  "surname,names,id_number,id_type,id_country,id_expiry,site,superior,designation,training_type,training_date,expiry_date";

describe("splitCsvLine", () => {
  it("splits a plain line", () => {
    expect(splitCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("keeps a comma inside quotes, which company names have", () => {
    expect(splitCsvLine('Smith,"Acme, Scaffolding",x')).toEqual([
      "Smith",
      "Acme, Scaffolding",
      "x",
    ]);
  });

  it("handles a doubled quote inside a quoted field", () => {
    expect(splitCsvLine('a,"He said ""go""",c')).toEqual([
      "a",
      'He said "go"',
      "c",
    ]);
  });

  it("keeps empty trailing fields", () => {
    expect(splitCsvLine("a,,")).toEqual(["a", "", ""]);
  });

  it("trims surrounding whitespace", () => {
    expect(splitCsvLine("  a , b ")).toEqual(["a", "b"]);
  });
});

describe("parseImportDate", () => {
  it("reads an ISO date", () => {
    expect(parseImportDate("2026-02-10").iso).toBe("2026-02-10");
  });

  it("reads a South African date day first", () => {
    expect(parseImportDate("10/02/2026").iso).toBe("2026-02-10");
    expect(parseImportDate("3/4/2026").iso).toBe("2026-04-03");
    expect(parseImportDate("10-02-2026").iso).toBe("2026-02-10");
    expect(parseImportDate("10.02.2026").iso).toBe("2026-02-10");
  });

  it("refuses a month-first date rather than silently shifting it", () => {
    const result = parseImportDate("02/25/2026");
    expect(result.iso).toBeNull();
    expect(result.issue).toContain("month-first");
    expect(result.issue).toContain("25/02/2026");
  });

  it("treats an empty cell as no date, not as an error", () => {
    expect(parseImportDate("")).toEqual({ iso: null, issue: null });
    expect(parseImportDate("   ")).toEqual({ iso: null, issue: null });
  });

  it("rejects a date that does not exist", () => {
    expect(parseImportDate("31/02/2026").iso).toBeNull();
    expect(parseImportDate("2026-02-30").iso).toBeNull();
    expect(parseImportDate("32/01/2026").iso).toBeNull();
  });

  it("rejects text that is not a date at all", () => {
    expect(parseImportDate("soon").issue).toContain("not a date");
    expect(parseImportDate("2026").issue).toContain("not a date");
  });

  it("expands a two digit year the way a spreadsheet does", () => {
    expect(parseImportDate("10/02/26").iso).toBe("2026-02-10");
    expect(parseImportDate("10/02/85").iso).toBe("1985-02-10");
  });
});

describe("parseImport", () => {
  it("refuses an empty file", () => {
    expect(parseImport("").fatal).toContain("empty");
  });

  it("names the required columns that are missing instead of guessing", () => {
    const plan = parseImport("surname,names\nDlamini,Sipho");
    expect(plan.missingColumns).toEqual(["ID number"]);
    expect(plan.rows).toHaveLength(0);
  });

  it("parses the template it hands out", () => {
    const plan = parseImport(IMPORT_TEMPLATE);
    expect(plan.fatal).toBeNull();
    expect(plan.rows).toHaveLength(2);
    expect(countIssues(plan).errors).toBe(0);
    expect(plan.rows[0].surname).toBe("Dlamini");
    expect(plan.rows[0].expiryDate).toBe("2027-02-10");
    expect(plan.rows[1].idType).toBe("passport");
  });

  it("refuses a file bigger than one sitting", () => {
    const many = [HEADER]
      .concat(
        Array.from(
          { length: IMPORT_MAX_ROWS + 1 },
          (_, i) => `A${i},B,800101500908${i % 10},sa_id,,,,,,,,`,
        ),
      )
      .join("\n");
    expect(parseImport(many).fatal).toContain("at most");
  });

  it("flags an invalid SA ID as an error, not a warning", () => {
    const plan = parseImport(`${HEADER}\nDlamini,Sipho,1234567890123,sa_id,,,,,,,,`);
    expect(plan.validRows).toHaveLength(0);
    expect(plan.rows[0].issues[0].severity).toBe("error");
  });

  it("accepts a foreign passport that is not thirteen digits", () => {
    const plan = parseImport(
      `${HEADER}\nBanda,Chikondi,MW0099123,passport,MW,30/06/2028,,,,,,`,
    );
    expect(plan.validRows).toHaveLength(1);
    expect(plan.rows[0].idExpiry).toBe("2028-06-30");
  });

  it("catches the same person twice in one file", () => {
    const plan = parseImport(
      `${HEADER}\nDlamini,Sipho,8001015009087,sa_id,,,,,,,,\nDlamini,S,8001015009087,sa_id,,,,,,,,`,
    );
    expect(plan.validRows).toHaveLength(1);
    expect(
      plan.rows[1].issues.some((i) => i.message.includes("more than once")),
    ).toBe(true);
  });

  it("warns about a training type it will have to create, and lists it", () => {
    const plan = parseImport(
      `${HEADER}\nDlamini,Sipho,8001015009087,sa_id,,,,,,Confined space,10/02/2026,10/02/2027`,
      { knownTrainingTypes: ["Working at heights"], knownIdNumbers: [] },
    );
    expect(plan.newTrainingTypes).toEqual(["Confined space"]);
    expect(plan.validRows).toHaveLength(1);
    expect(countIssues(plan).warnings).toBe(1);
  });

  it("does not warn about a training type that already exists", () => {
    const plan = parseImport(
      `${HEADER}\nDlamini,Sipho,8001015009087,sa_id,,,,,,Working at heights,10/02/2026,10/02/2027`,
      { knownTrainingTypes: ["working at heights"], knownIdNumbers: [] },
    );
    expect(plan.newTrainingTypes).toEqual([]);
    expect(countIssues(plan).warnings).toBe(0);
  });

  it("refuses a training date with no training type to file it against", () => {
    const plan = parseImport(
      `${HEADER}\nDlamini,Sipho,8001015009087,sa_id,,,,,,,10/02/2026,`,
    );
    expect(plan.validRows).toHaveLength(0);
    expect(
      plan.rows[0].issues.some((i) => i.message.includes("no training type")),
    ).toBe(true);
  });

  it("counts how many people are new to the register", () => {
    const plan = parseImport(
      `${HEADER}\nDlamini,Sipho,8001015009087,sa_id,,,,,,,,\nBanda,Chikondi,MW0099123,passport,,,,,,,,`,
      { knownTrainingTypes: [], knownIdNumbers: ["8001015009087"] },
    );
    expect(plan.newPeople).toBe(1);
  });

  it("reports the line number as it appears in the spreadsheet", () => {
    const plan = parseImport(
      `${HEADER}\nDlamini,Sipho,8001015009087,sa_id,,,,,,,,\nBanda,Chikondi,MW0099123,passport,,,,,,,,`,
    );
    expect(plan.rows[0].line).toBe(2);
    expect(plan.rows[1].line).toBe(3);
  });

  it("survives a file saved by Excel with a byte order mark and CRLF", () => {
    const plan = parseImport(
      `﻿${HEADER}\r\nDlamini,Sipho,8001015009087,sa_id,,,,,,,,\r\n`,
    );
    expect(plan.fatal).toBeNull();
    expect(plan.validRows).toHaveLength(1);
  });

  it("keeps a good row usable even when another row is broken", () => {
    const plan = parseImport(
      `${HEADER}\nDlamini,Sipho,8001015009087,sa_id,,,,,,,,\n,NoSurname,1234567890123,sa_id,,,,,,,,`,
    );
    expect(plan.rows).toHaveLength(2);
    expect(plan.validRows).toHaveLength(1);
    expect(plan.validRows[0].surname).toBe("Dlamini");
  });
});
