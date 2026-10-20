import type { ReportEmployee } from "@/lib/reports/data";
import type { Gender, OccupationalLevel, PopulationGroup } from "@/lib/types/database";
import {
  EE_DESIGNATED_THRESHOLD,
  OCCUPATIONAL_LEVELS,
  OCCUPATIONAL_LEVEL_SHORT,
  POPULATION_GROUPS,
  eeReportingYear,
  isForeignNational,
  siteOf,
  type Period,
} from "@/lib/hr/operations";

/**
 * Employment Equity (EEA2) as far as the register allows. The workforce
 * profile is taken as at the period end; recruits and terminations are
 * counted over the EE reporting year the period end falls in. Everything
 * here is pure so the page and the workbook cannot disagree.
 */

export type EEColumnKey =
  | "male_african"
  | "male_coloured"
  | "male_indian"
  | "male_white"
  | "male_nd"
  | "female_african"
  | "female_coloured"
  | "female_indian"
  | "female_white"
  | "female_nd"
  | "foreign_male"
  | "foreign_female"
  | "nd";

export interface EEColumn {
  key: EEColumnKey;
  /** Column group on the form: Male, Female, Foreign nationals, or Not declared. */
  group: string;
  /** Short header as printed inside the group. */
  short: string;
  /** Flat header used in Excel, for example "Male A" or "Foreign M". */
  header: string;
}

export const EE_COLUMNS: EEColumn[] = [
  ...POPULATION_GROUPS.map((g) => ({
    key: `male_${g.value}` as EEColumnKey,
    group: "Male",
    short: g.short,
    header: `Male ${g.short}`,
  })),
  { key: "male_nd", group: "Male", short: "Not declared", header: "Male not declared" },
  ...POPULATION_GROUPS.map((g) => ({
    key: `female_${g.value}` as EEColumnKey,
    group: "Female",
    short: g.short,
    header: `Female ${g.short}`,
  })),
  { key: "female_nd", group: "Female", short: "Not declared", header: "Female not declared" },
  { key: "foreign_male", group: "Foreign nationals", short: "Male", header: "Foreign M" },
  { key: "foreign_female", group: "Foreign nationals", short: "Female", header: "Foreign F" },
  { key: "nd", group: "Not declared", short: "Not declared", header: "Not declared" },
];

export type EERowKey = OccupationalLevel | "unset" | "total";

export interface EERow {
  key: EERowKey;
  label: string;
  shortLabel: string;
  cells: Record<EEColumnKey, number>;
  total: number;
}

export interface EEMatrix {
  columns: EEColumn[];
  rows: EERow[];
  /** The Total row, also present as the last entry of rows. */
  totals: EERow;
}

/**
 * Which EEA2 column a person falls in. Foreign nationals go only to the
 * foreign national columns, as on the form. A South African with a gender
 * but no population group goes to that gender's Not declared column; a
 * person with no gender goes to the final Not declared column.
 */
export function eeColumnKey(e: Pick<ReportEmployee, "gender" | "population_group" | "id_type">): EEColumnKey {
  const gender: Gender | null = e.gender ?? null;
  if (isForeignNational(e.id_type)) {
    if (gender === "male") return "foreign_male";
    if (gender === "female") return "foreign_female";
    return "nd";
  }
  if (gender !== "male" && gender !== "female") return "nd";
  const group: PopulationGroup | null = e.population_group ?? null;
  if (!group) return gender === "male" ? "male_nd" : "female_nd";
  return `${gender}_${group}` as EEColumnKey;
}

function emptyCells(): Record<EEColumnKey, number> {
  const out = {} as Record<EEColumnKey, number>;
  for (const c of EE_COLUMNS) out[c.key] = 0;
  return out;
}

function emptyRow(key: EERowKey, label: string, shortLabel: string): EERow {
  return { key, label, shortLabel, cells: emptyCells(), total: 0 };
}

/** The EEA2 section B grid for a set of people: occupational level by column. */
export function eeMatrix(people: ReportEmployee[]): EEMatrix {
  const rows: EERow[] = OCCUPATIONAL_LEVELS.map((l) =>
    emptyRow(l.value, l.label, OCCUPATIONAL_LEVEL_SHORT[l.value]),
  );
  const unset = emptyRow("unset", "Level not set", "Level not set");
  const totals = emptyRow("total", "Total", "Total");
  const byKey = new Map<EERowKey, EERow>();
  for (const r of rows) byKey.set(r.key, r);

  for (const e of people) {
    const col = eeColumnKey(e);
    const row = (e.occupational_level && byKey.get(e.occupational_level)) || unset;
    row.cells[col] += 1;
    row.total += 1;
    totals.cells[col] += 1;
    totals.total += 1;
  }

  const all = unset.total > 0 ? [...rows, unset, totals] : [...rows, totals];
  return { columns: EE_COLUMNS, rows: all, totals };
}

export function activeOn(e: ReportEmployee, date: string): boolean {
  return (
    (e.engaged_at === null || e.engaged_at <= date) &&
    (e.terminated_at === null || e.terminated_at > date)
  );
}

export type EEMissingField = "gender" | "population_group" | "disability" | "occupational_level";

export const EE_MISSING_LABELS: Record<EEMissingField, string> = {
  gender: "Gender",
  population_group: "Population group",
  disability: "Disability",
  occupational_level: "Occupational level",
};

export interface EECompletenessRow {
  id: string;
  surname: string;
  names: string;
  designation: string;
  site: string;
  gender: Gender | null;
  populationGroup: PopulationGroup | null;
  disability: boolean | null;
  occupationalLevel: OccupationalLevel | null;
  eeDeclaredAt: string | null;
  missing: EEMissingField[];
}

export interface EECompleteness {
  missingGender: number;
  missingGroup: number;
  missingDisability: number;
  missingLevel: number;
  /** People with at least one missing declaration, sorted by surname. */
  people: EECompletenessRow[];
  complete: number;
}

export function missingFields(e: ReportEmployee): EEMissingField[] {
  const out: EEMissingField[] = [];
  if (!e.gender) out.push("gender");
  if (!e.population_group && !isForeignNational(e.id_type)) out.push("population_group");
  if (e.disability !== true && e.disability !== false) out.push("disability");
  if (!e.occupational_level) out.push("occupational_level");
  return out;
}

export function eeCompleteness(people: ReportEmployee[]): EECompleteness {
  const rows: EECompletenessRow[] = [];
  let missingGender = 0;
  let missingGroup = 0;
  let missingDisability = 0;
  let missingLevel = 0;
  for (const e of people) {
    const missing = missingFields(e);
    if (missing.includes("gender")) missingGender += 1;
    if (missing.includes("population_group")) missingGroup += 1;
    if (missing.includes("disability")) missingDisability += 1;
    if (missing.includes("occupational_level")) missingLevel += 1;
    if (missing.length === 0) continue;
    rows.push({
      id: e.id,
      surname: e.surname,
      names: e.names,
      designation: e.designation ?? "",
      site: siteOf(e.site),
      gender: e.gender ?? null,
      populationGroup: e.population_group ?? null,
      disability: e.disability ?? null,
      occupationalLevel: e.occupational_level ?? null,
      eeDeclaredAt: e.ee_declared_at ?? null,
      missing,
    });
  }
  rows.sort((a, b) => a.surname.localeCompare(b.surname) || a.names.localeCompare(b.names));
  return {
    missingGender,
    missingGroup,
    missingDisability,
    missingLevel,
    people: rows,
    complete: people.length - rows.length,
  };
}

export interface EEByGroup {
  african: number;
  coloured: number;
  indian: number;
  white: number;
  notDeclared: number;
  foreign: number;
}

export function eeByGroup(people: ReportEmployee[]): EEByGroup {
  const out: EEByGroup = { african: 0, coloured: 0, indian: 0, white: 0, notDeclared: 0, foreign: 0 };
  for (const e of people) {
    if (isForeignNational(e.id_type)) out.foreign += 1;
    else if (e.population_group) out[e.population_group] += 1;
    else out.notDeclared += 1;
  }
  return out;
}

export interface EmploymentEquityReport {
  year: { start: string; end: string; label: string };
  headcount: number;
  designated: boolean;
  threshold: number;
  completeness: EECompleteness;
  profile: EEMatrix;
  profileDisabled: EEMatrix;
  recruits: EEMatrix;
  terminations: EEMatrix;
  byGroup: EEByGroup;
  /** Male and female headcount per occupational level, in OCCUPATIONAL_LEVELS order. */
  byLevel: { categories: string[]; male: number[]; female: number[] };
}

export function buildEmploymentEquity(
  employees: ReportEmployee[],
  period: Period,
  site?: string | null,
): EmploymentEquityReport {
  const chosen = site && site.trim().length > 0 ? site.trim() : null;
  const scoped = chosen ? employees.filter((e) => siteOf(e.site) === chosen) : employees;
  const year = eeReportingYear(period.end);

  const inService = scoped.filter((e) => activeOn(e, period.end));
  const recruits = scoped.filter(
    (e) => e.engaged_at !== null && e.engaged_at >= year.start && e.engaged_at <= year.end,
  );
  const terminations = scoped.filter(
    (e) => e.terminated_at !== null && e.terminated_at >= year.start && e.terminated_at <= year.end,
  );

  const profile = eeMatrix(inService);
  const categories = OCCUPATIONAL_LEVELS.map((l) => OCCUPATIONAL_LEVEL_SHORT[l.value]);
  const male = OCCUPATIONAL_LEVELS.map((l) => {
    const r = profile.rows.find((x) => x.key === l.value);
    return r ? r.cells.male_african + r.cells.male_coloured + r.cells.male_indian + r.cells.male_white + r.cells.male_nd + r.cells.foreign_male : 0;
  });
  const female = OCCUPATIONAL_LEVELS.map((l) => {
    const r = profile.rows.find((x) => x.key === l.value);
    return r ? r.cells.female_african + r.cells.female_coloured + r.cells.female_indian + r.cells.female_white + r.cells.female_nd + r.cells.foreign_female : 0;
  });

  return {
    year,
    headcount: inService.length,
    designated: inService.length >= EE_DESIGNATED_THRESHOLD,
    threshold: EE_DESIGNATED_THRESHOLD,
    completeness: eeCompleteness(inService),
    profile,
    profileDisabled: eeMatrix(inService.filter((e) => e.disability === true)),
    recruits: eeMatrix(recruits),
    terminations: eeMatrix(terminations),
    byGroup: eeByGroup(inService),
    byLevel: { categories, male, female },
  };
}
