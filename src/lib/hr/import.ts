import { normaliseTrainingTypeName } from "@/lib/hr/training-type-name";
import {
  validateIdentification,
  normaliseIdNumber,
  isIdType,
  type IdType,
} from "@/lib/validation/identification";

/**
 * CSV import for the register.
 *
 * The rule this file exists to enforce is that nothing is written until the
 * whole file has been read and shown back. A half-applied import of four
 * hundred rows is worse than no import: the customer cannot tell which people
 * landed, and the register they are about to hand a client is now part
 * fiction.
 *
 * So parsing produces a plan, the plan is rendered for confirmation, and only
 * then does anything touch the database.
 */

export type ImportSeverity = "error" | "warning";

export interface ImportIssue {
  severity: ImportSeverity;
  message: string;
}

export interface ImportRow {
  line: number;
  surname: string;
  names: string;
  idType: IdType;
  idNumber: string;
  idCountry: string | null;
  idExpiry: string | null;
  site: string | null;
  superior: string | null;
  designation: string | null;
  trainingType: string | null;
  trainingDate: string | null;
  expiryDate: string | null;
  issues: ImportIssue[];
}

export interface ImportPlan {
  rows: ImportRow[];
  validRows: ImportRow[];
  headers: string[];
  missingColumns: string[];
  fatal: string | null;
  newPeople: number;
  newTrainingTypes: string[];
}

export const IMPORT_MAX_ROWS = 2000;

export const IMPORT_COLUMNS = [
  { key: "surname", label: "Surname", required: true },
  { key: "names", label: "Names", required: true },
  { key: "id_number", label: "ID number", required: true },
  { key: "id_type", label: "ID type", required: false },
  { key: "id_country", label: "Country", required: false },
  { key: "id_expiry", label: "Document expiry", required: false },
  { key: "site", label: "Site", required: false },
  { key: "superior", label: "Superior", required: false },
  { key: "designation", label: "Designation", required: false },
  { key: "training_type", label: "Training type", required: false },
  { key: "training_date", label: "Training date", required: false },
  { key: "expiry_date", label: "Expiry date", required: false },
] as const;

export const IMPORT_TEMPLATE = `${IMPORT_COLUMNS.map((c) => c.key).join(",")}
Dlamini,Sipho,8001015009087,sa_id,ZA,,Impala 14 Shaft,T. Mokoena,Rigger,Working at heights,2026-02-10,2027-02-10
Banda,Chikondi,MW0099123,passport,MW,2028-06-30,Sibanye Driefontein,T. Mokoena,General worker,First aid,2026-03-01,2029-03-01
`;

/**
 * Split one CSV line, honouring quoted fields and doubled quotes inside them.
 * Written by hand rather than pulled in as a dependency: the format is small,
 * and this file has to be certain about what it does with a comma inside a
 * company name.
 */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      out.push(field);
      field = "";
    } else {
      field += char;
    }
  }
  out.push(field);
  return out.map((f) => f.trim());
}

/**
 * Read a date the way a South African spreadsheet writes one.
 *
 * Day first, always. 03/04/2026 is the third of April here and the fourth of
 * March in an American export, and guessing wrong puts a certificate a month
 * out on either side of an expiry boundary. Anything ambiguous that cannot be
 * day-first is rejected rather than assumed.
 */
export function parseImportDate(input: string): {
  iso: string | null;
  issue: string | null;
} {
  const value = input.trim();
  if (!value) return { iso: null, issue: null };

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) {
    return validateParts(Number(iso[1]), Number(iso[2]), Number(iso[3]), value);
  }

  const dayFirst = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(value);
  if (dayFirst) {
    const day = Number(dayFirst[1]);
    const month = Number(dayFirst[2]);
    let year = Number(dayFirst[3]);
    if (year < 100) year += year < 70 ? 2000 : 1900;
    if (month > 12 && day <= 12) {
      return {
        iso: null,
        issue: `"${value}" looks like a month-first date. Certly reads dates day first. Write it as ${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}/${year} or use YYYY-MM-DD.`,
      };
    }
    return validateParts(year, month, day, value);
  }

  return {
    iso: null,
    issue: `"${value}" is not a date Certly can read. Use DD/MM/YYYY or YYYY-MM-DD.`,
  };
}

function validateParts(
  year: number,
  month: number,
  day: number,
  original: string,
): { iso: string | null; issue: string | null } {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { iso: null, issue: `"${original}" is not a real date.` };
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return { iso: null, issue: `"${original}" is not a real date.` };
  }
  if (year < 1900 || year > 2100) {
    return { iso: null, issue: `"${original}" has an implausible year.` };
  }
  return { iso: date.toISOString().slice(0, 10), issue: null };
}

export interface ParseContext {
  knownTrainingTypes: string[];
  knownIdNumbers: string[];
}

export function parseImport(
  csv: string,
  context: ParseContext = { knownTrainingTypes: [], knownIdNumbers: [] },
): ImportPlan {
  const empty: ImportPlan = {
    rows: [],
    validRows: [],
    headers: [],
    missingColumns: [],
    fatal: null,
    newPeople: 0,
    newTrainingTypes: [],
  };

  const text = csv.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const lines = text.split("\n").filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return { ...empty, fatal: "That file is empty." };
  }
  if (lines.length - 1 > IMPORT_MAX_ROWS) {
    return {
      ...empty,
      fatal: `That file has ${lines.length - 1} rows. Import at most ${IMPORT_MAX_ROWS} at a time.`,
    };
  }

  const headers = splitCsvLine(lines[0]).map((h) =>
    h.toLowerCase().replace(/\s+/g, "_"),
  );

  const missingColumns = IMPORT_COLUMNS.filter(
    (c) => c.required && !headers.includes(c.key),
  ).map((c) => c.label);

  if (missingColumns.length > 0) {
    return { ...empty, headers, missingColumns };
  }

  const index = (key: string) => headers.indexOf(key);
  const at = (cells: string[], key: string): string => {
    const i = index(key);
    return i === -1 ? "" : (cells[i] ?? "").trim();
  };

  const knownTypes = new Set(
    context.knownTrainingTypes.map((t) => t.toLowerCase()),
  );
  const knownIds = new Set(
    context.knownIdNumbers.map((t) => t.toLowerCase()),
  );
  const seenInFile = new Set<string>();
  const newTypes = new Set<string>();
  const newPeople = new Set<string>();

  const rows: ImportRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i]);
    const issues: ImportIssue[] = [];

    const surname = at(cells, "surname");
    const names = at(cells, "names");
    const rawIdType = at(cells, "id_type") || "sa_id";
    const idType: IdType = isIdType(rawIdType) ? rawIdType : "sa_id";
    if (!isIdType(rawIdType) && at(cells, "id_type")) {
      issues.push({
        severity: "warning",
        message: `Unknown ID type "${rawIdType}", treated as a South African ID.`,
      });
    }

    const idNumber = normaliseIdNumber(idType, at(cells, "id_number"));

    if (!surname) {
      issues.push({ severity: "error", message: "Surname is required." });
    }
    if (!names) {
      issues.push({ severity: "error", message: "First names are required." });
    }

    const idCheck = validateIdentification(idType, idNumber);
    if (!idCheck.valid) {
      issues.push({ severity: "error", message: idCheck.reason });
    }

    const key = idNumber.toLowerCase();
    if (key && seenInFile.has(key)) {
      issues.push({
        severity: "error",
        message: "This document number appears more than once in this file.",
      });
    }
    if (key) seenInFile.add(key);

    const dates = {
      idExpiry: parseImportDate(at(cells, "id_expiry")),
      trainingDate: parseImportDate(at(cells, "training_date")),
      expiryDate: parseImportDate(at(cells, "expiry_date")),
    };
    for (const parsed of Object.values(dates)) {
      if (parsed.issue) {
        issues.push({ severity: "error", message: parsed.issue });
      }
    }

    const trainingType =
      normaliseTrainingTypeName(at(cells, "training_type")) || null;
    if (trainingType && !knownTypes.has(trainingType.toLowerCase())) {
      newTypes.add(trainingType);
      issues.push({
        severity: "warning",
        message: `"${trainingType}" is not in your training types yet. It will be created.`,
      });
    }
    if (trainingType && !dates.trainingDate.iso && !dates.expiryDate.iso) {
      issues.push({
        severity: "warning",
        message:
          "No training or expiry date, so this certificate will never show as due.",
      });
    }
    if (!trainingType && (dates.trainingDate.iso || dates.expiryDate.iso)) {
      issues.push({
        severity: "error",
        message: "A training date with no training type cannot be filed.",
      });
    }

    if (key && !knownIds.has(key)) newPeople.add(key);

    rows.push({
      line: i + 1,
      surname,
      names,
      idType,
      idNumber,
      idCountry: at(cells, "id_country") || null,
      idExpiry: dates.idExpiry.iso,
      site: at(cells, "site") || null,
      superior: at(cells, "superior") || null,
      designation: at(cells, "designation") || null,
      trainingType,
      trainingDate: dates.trainingDate.iso,
      expiryDate: dates.expiryDate.iso,
      issues,
    });
  }

  const validRows = rows.filter(
    (r) => !r.issues.some((i) => i.severity === "error"),
  );

  return {
    rows,
    validRows,
    headers,
    missingColumns: [],
    fatal: null,
    newPeople: newPeople.size,
    newTrainingTypes: [...newTypes],
  };
}

export function countIssues(plan: ImportPlan): {
  errors: number;
  warnings: number;
} {
  let errors = 0;
  let warnings = 0;
  for (const row of plan.rows) {
    for (const issue of row.issues) {
      if (issue.severity === "error") errors += 1;
      else warnings += 1;
    }
  }
  return { errors, warnings };
}
