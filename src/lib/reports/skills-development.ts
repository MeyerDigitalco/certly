import type { ReportEmployee, TrainingDelivered } from "@/lib/reports/data";
import type {
  Gender,
  PopulationGroup,
  TrainingCategory,
  TrainingPlan,
  TrainingType,
} from "@/lib/types/database";
import {
  GENDERS,
  POPULATION_GROUPS,
  TRAINING_CATEGORIES,
  isForeignNational,
  setaYearFor,
  setaYearRange,
  siteOf,
  trainingCategoryLabel,
  type Period,
} from "@/lib/hr/operations";

/**
 * Skills development: the Annual Training Report for the SETA year the
 * period falls in, the B-BBEE skills element inputs that come out of the
 * same rows, and the Workplace Skills Plan for the year after. Pure
 * functions over the register, the course list, the certificates and the
 * plan rows so the page and the workbook cannot disagree.
 */

export interface SetaYear {
  year: number;
  start: string;
  end: string;
  label: string;
  due: string;
}

export function setaYear(year: number): SetaYear {
  return { year, ...setaYearRange(year) };
}

/** True when the date falls inside the SETA year named for the year it ends in. */
export function inSetaYear(iso: string | null | undefined, year: number): boolean {
  if (!iso) return false;
  return setaYearFor(iso) === year;
}

/** Black people as the B-BBEE Act defines them: African, Coloured and Indian. */
export function isBlack(group: PopulationGroup | null | undefined): boolean {
  return group === "african" || group === "coloured" || group === "indian";
}

/** In service at any point between two dates, inclusive. */
export function inServiceDuring(e: ReportEmployee, start: string, end: string): boolean {
  return (
    (e.engaged_at === null || e.engaged_at <= end) &&
    (e.terminated_at === null || e.terminated_at >= start)
  );
}

export const PROGRAMME_CATEGORIES: TrainingCategory[] = [
  "learnership",
  "apprenticeship",
  "internship",
];

export interface AtrRow {
  certificationId: string;
  employeeId: string;
  surname: string;
  names: string;
  idNumber: string;
  designation: string;
  site: string;
  typeId: string;
  course: string;
  category: TrainingCategory;
  categoryLabel: string;
  date: string;
  hours: number | null;
  cost: number | null;
  populationGroup: PopulationGroup | null;
  gender: Gender | null;
  disability: boolean | null;
  foreign: boolean;
}

export interface AtrCourseRow {
  typeId: string;
  course: string;
  category: TrainingCategory;
  categoryLabel: string;
  provider: string;
  nqf: number | null;
  accredited: boolean;
  people: number;
  hours: number | null;
  cost: number | null;
}

export interface AtrCourseTotals {
  people: number;
  hours: number;
  cost: number;
  hoursComplete: boolean;
  costComplete: boolean;
}

export type DemoGroupKey = PopulationGroup | "undeclared" | "foreign";
export type DemoGenderKey = Gender | "undeclared";

export const DEMO_GROUP_COLUMNS: Array<{ key: DemoGroupKey; label: string }> = [
  ...POPULATION_GROUPS.map((g) => ({ key: g.value as DemoGroupKey, label: g.label })),
  { key: "undeclared", label: "Not declared" },
  { key: "foreign", label: "Foreign national" },
];

export const DEMO_GENDER_ROWS: Array<{ key: DemoGenderKey; label: string }> = [
  ...GENDERS.map((g) => ({ key: g.value as DemoGenderKey, label: g.label })),
  { key: "undeclared", label: "Gender not declared" },
];

export interface DemographicRow {
  key: DemoGenderKey | "total" | "disability";
  label: string;
  cells: Record<DemoGroupKey, number>;
  total: number;
}

export interface AtrDemographics {
  rows: DemographicRow[];
  peopleTrained: number;
  disability: number;
  foreign: number;
  byGroup: Array<{ key: DemoGroupKey; label: string; value: number }>;
}

export interface BbbeeInputs {
  totalSpend: number;
  blackSpend: number;
  blackPeople: number;
  blackWomen: number;
  disabledPeople: number;
  programmes: number;
  programmesBlack: number;
  costComplete: boolean;
}

export type WspCostSource = "plan" | "type" | "none";

export interface WspRow {
  planId: string;
  typeId: string;
  course: string;
  categoryLabel: string;
  site: string;
  plannedPeople: number;
  plannedCost: number | null;
  costSource: WspCostSource;
  deliveredAtSite: number;
  notes: string;
}

export interface WspGroup {
  typeId: string;
  course: string;
  category: TrainingCategory;
  categoryLabel: string;
  delivered: number;
  plannedPeople: number;
  plannedCost: number;
  rows: WspRow[];
}

export interface WspTotals {
  people: number;
  cost: number;
  fallbackRows: number;
  uncostedRows: number;
}

export interface IncompleteType {
  id: string;
  name: string;
  categoryLabel: string;
  missingHours: boolean;
  missingCost: boolean;
}

export interface UndeclaredEmployee {
  id: string;
  surname: string;
  names: string;
  site: string;
  missingGroup: boolean;
  missingGender: boolean;
}

export interface SkillsDevelopmentResult {
  period: Period;
  site: string | null;
  year: SetaYear;
  nextYear: SetaYear;
  rows: AtrRow[];
  courses: AtrCourseRow[];
  courseTotals: AtrCourseTotals;
  demographics: AtrDemographics;
  bbbee: BbbeeInputs;
  wsp: { groups: WspGroup[]; totals: WspTotals };
  byCategory: { categories: string[]; trained: number[]; planned: number[] };
  readiness: { typesIncomplete: IncompleteType[]; undeclared: UndeclaredEmployee[] };
}

function rands(cents: number | null | undefined): number | null {
  if (cents === null || cents === undefined) return null;
  return Math.round(cents) / 100;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function emptyCells(): Record<DemoGroupKey, number> {
  const out = {} as Record<DemoGroupKey, number>;
  for (const c of DEMO_GROUP_COLUMNS) out[c.key] = 0;
  return out;
}

function groupKeyOf(e: Pick<AtrRow, "foreign" | "populationGroup">): DemoGroupKey {
  if (e.foreign) return "foreign";
  return e.populationGroup ?? "undeclared";
}

function genderKeyOf(e: Pick<AtrRow, "gender">): DemoGenderKey {
  return e.gender ?? "undeclared";
}

/**
 * One row per certificate obtained in the SETA year, for a course that
 * counts toward the ATR, for a person who was in service at some point in
 * that year. The site filter applies to the person's site.
 */
export function atrRows(
  employees: ReportEmployee[],
  types: TrainingType[],
  delivered: TrainingDelivered[],
  year: SetaYear,
  site?: string | null,
): AtrRow[] {
  const chosen = site && site.trim().length > 0 ? site : null;
  const typeById = new Map(types.map((t) => [t.id, t]));
  const empById = new Map(
    employees
      .filter((e) => inServiceDuring(e, year.start, year.end))
      .filter((e) => !chosen || siteOf(e.site) === chosen)
      .map((e) => [e.id, e]),
  );

  const rows: AtrRow[] = [];
  for (const d of delivered) {
    if (!inSetaYear(d.training_date, year.year) || !d.training_date) continue;
    const t = typeById.get(d.training_type_id);
    if (!t || !t.counts_for_atr) continue;
    const e = empById.get(d.employee_id);
    if (!e) continue;
    rows.push({
      certificationId: d.id,
      employeeId: e.id,
      surname: e.surname,
      names: e.names,
      idNumber: e.id_number ?? "",
      designation: e.designation ?? "",
      site: siteOf(e.site),
      typeId: t.id,
      course: t.name,
      category: t.category,
      categoryLabel: trainingCategoryLabel(t.category),
      date: d.training_date,
      hours: t.hours,
      cost: rands(t.cost_cents),
      populationGroup: e.population_group,
      gender: e.gender,
      disability: e.disability,
      foreign: isForeignNational(e.id_type),
    });
  }

  rows.sort(
    (a, b) =>
      a.surname.localeCompare(b.surname) ||
      a.names.localeCompare(b.names) ||
      a.date.localeCompare(b.date) ||
      a.course.localeCompare(b.course),
  );
  return rows;
}

function distinctPeople(rows: AtrRow[]): AtrRow[] {
  const seen = new Set<string>();
  const out: AtrRow[] = [];
  for (const r of rows) {
    if (seen.has(r.employeeId)) continue;
    seen.add(r.employeeId);
    out.push(r);
  }
  return out;
}

export function atrCourses(
  rows: AtrRow[],
  types: TrainingType[],
): { courses: AtrCourseRow[]; totals: AtrCourseTotals } {
  const byType = new Map<string, AtrRow[]>();
  for (const r of rows) {
    const list = byType.get(r.typeId) ?? [];
    list.push(r);
    byType.set(r.typeId, list);
  }
  const courses: AtrCourseRow[] = [];
  for (const t of types) {
    const list = byType.get(t.id);
    if (!list || list.length === 0) continue;
    const people = distinctPeople(list).length;
    courses.push({
      typeId: t.id,
      course: t.name,
      category: t.category,
      categoryLabel: trainingCategoryLabel(t.category),
      provider: t.provider ?? "",
      nqf: t.nqf_level,
      accredited: t.accredited,
      people,
      hours: t.hours === null ? null : round2(people * t.hours),
      cost: t.cost_cents === null ? null : round2((people * t.cost_cents) / 100),
    });
  }
  courses.sort((a, b) => a.course.localeCompare(b.course));
  const totals: AtrCourseTotals = {
    people: courses.reduce((a, c) => a + c.people, 0),
    hours: round2(courses.reduce((a, c) => a + (c.hours ?? 0), 0)),
    cost: round2(courses.reduce((a, c) => a + (c.cost ?? 0), 0)),
    hoursComplete: courses.every((c) => c.hours !== null),
    costComplete: courses.every((c) => c.cost !== null),
  };
  return { courses, totals };
}

export function atrDemographics(rows: AtrRow[]): AtrDemographics {
  const people = distinctPeople(rows);
  const byGender = new Map<DemoGenderKey, Record<DemoGroupKey, number>>();
  for (const g of DEMO_GENDER_ROWS) byGender.set(g.key, emptyCells());
  const totalCells = emptyCells();
  const disabilityCells = emptyCells();

  for (const p of people) {
    const gk = groupKeyOf(p);
    byGender.get(genderKeyOf(p))![gk] += 1;
    totalCells[gk] += 1;
    if (p.disability === true) disabilityCells[gk] += 1;
  }

  const sum = (c: Record<DemoGroupKey, number>) =>
    DEMO_GROUP_COLUMNS.reduce((a, col) => a + c[col.key], 0);

  const out: DemographicRow[] = DEMO_GENDER_ROWS.map((g) => {
    const cells = byGender.get(g.key)!;
    return { key: g.key, label: g.label, cells, total: sum(cells) };
  }).filter((r) => r.key !== "undeclared" || r.total > 0);
  out.push({ key: "total", label: "All people trained", cells: totalCells, total: sum(totalCells) });
  out.push({
    key: "disability",
    label: "Of whom with a disability",
    cells: disabilityCells,
    total: sum(disabilityCells),
  });

  return {
    rows: out,
    peopleTrained: people.length,
    disability: sum(disabilityCells),
    foreign: totalCells.foreign,
    byGroup: DEMO_GROUP_COLUMNS.map((c) => ({ key: c.key, label: c.label, value: totalCells[c.key] })),
  };
}

export function bbbeeInputs(rows: AtrRow[]): BbbeeInputs {
  const people = distinctPeople(rows);
  const black = people.filter((p) => isBlack(p.populationGroup));
  const programmeRows = rows.filter((r) => PROGRAMME_CATEGORIES.includes(r.category));
  return {
    totalSpend: round2(rows.reduce((a, r) => a + (r.cost ?? 0), 0)),
    blackSpend: round2(
      rows.filter((r) => isBlack(r.populationGroup)).reduce((a, r) => a + (r.cost ?? 0), 0),
    ),
    blackPeople: black.length,
    blackWomen: black.filter((p) => p.gender === "female").length,
    disabledPeople: people.filter((p) => p.disability === true).length,
    programmes: programmeRows.length,
    programmesBlack: programmeRows.filter((r) => isBlack(r.populationGroup)).length,
    costComplete: rows.every((r) => r.cost !== null),
  };
}

/**
 * The Workplace Skills Plan for a SETA year, grouped by course. Planned
 * cost comes from the plan row when it has one, otherwise from the course
 * cost times the planned people, and the row says which.
 */
export function wspForYear(
  plans: TrainingPlan[],
  types: TrainingType[],
  deliveredRows: AtrRow[],
  year: number,
  site?: string | null,
): { groups: WspGroup[]; totals: WspTotals } {
  const chosen = site && site.trim().length > 0 ? site : null;
  const typeById = new Map(types.map((t) => [t.id, t]));
  const rowsForYear = plans.filter(
    (p) => p.seta_year === year && (!chosen || siteOf(p.site) === chosen),
  );

  const deliveredByType = new Map<string, AtrRow[]>();
  for (const r of deliveredRows) {
    const list = deliveredByType.get(r.typeId) ?? [];
    list.push(r);
    deliveredByType.set(r.typeId, list);
  }

  const byType = new Map<string, WspRow[]>();
  for (const p of rowsForYear) {
    const t = typeById.get(p.training_type_id);
    if (!t) continue;
    const planSite = siteOf(p.site);
    const delivered = deliveredByType.get(t.id) ?? [];
    let plannedCost: number | null = null;
    let costSource: WspCostSource = "none";
    if (p.planned_cost_cents !== null) {
      plannedCost = rands(p.planned_cost_cents);
      costSource = "plan";
    } else if (t.cost_cents !== null) {
      plannedCost = round2((p.planned_count * t.cost_cents) / 100);
      costSource = "type";
    }
    const row: WspRow = {
      planId: p.id,
      typeId: t.id,
      course: t.name,
      categoryLabel: trainingCategoryLabel(t.category),
      site: planSite,
      plannedPeople: p.planned_count,
      plannedCost,
      costSource,
      deliveredAtSite: distinctPeople(delivered.filter((r) => r.site === planSite)).length,
      notes: p.notes ?? "",
    };
    const list = byType.get(t.id) ?? [];
    list.push(row);
    byType.set(t.id, list);
  }

  const groups: WspGroup[] = [];
  for (const [typeId, rows] of byType) {
    const t = typeById.get(typeId)!;
    rows.sort((a, b) => a.site.localeCompare(b.site));
    groups.push({
      typeId,
      course: t.name,
      category: t.category,
      categoryLabel: trainingCategoryLabel(t.category),
      delivered: distinctPeople(deliveredByType.get(typeId) ?? []).length,
      plannedPeople: rows.reduce((a, r) => a + r.plannedPeople, 0),
      plannedCost: round2(rows.reduce((a, r) => a + (r.plannedCost ?? 0), 0)),
      rows,
    });
  }
  groups.sort((a, b) => a.course.localeCompare(b.course));

  const allRows = groups.flatMap((g) => g.rows);
  return {
    groups,
    totals: {
      people: allRows.reduce((a, r) => a + r.plannedPeople, 0),
      cost: round2(allRows.reduce((a, r) => a + (r.plannedCost ?? 0), 0)),
      fallbackRows: allRows.filter((r) => r.costSource === "type").length,
      uncostedRows: allRows.filter((r) => r.costSource === "none").length,
    },
  };
}

export function buildSkillsDevelopment(
  employees: ReportEmployee[],
  types: TrainingType[],
  delivered: TrainingDelivered[],
  plans: TrainingPlan[],
  period: Period,
  site?: string | null,
): SkillsDevelopmentResult {
  const chosen = site && site.trim().length > 0 ? site : null;
  const year = setaYear(setaYearFor(period.end));
  const nextYear = setaYear(year.year + 1);

  const rows = atrRows(employees, types, delivered, year, chosen);
  const { courses, totals: courseTotals } = atrCourses(rows, types);
  const demographics = atrDemographics(rows);
  const bbbee = bbbeeInputs(rows);
  const wsp = wspForYear(plans, types, rows, nextYear.year, chosen);

  const trainedByCategory = new Map<TrainingCategory, number>();
  const plannedByCategory = new Map<TrainingCategory, number>();
  for (const c of courses) {
    trainedByCategory.set(c.category, (trainedByCategory.get(c.category) ?? 0) + c.people);
  }
  for (const g of wsp.groups) {
    plannedByCategory.set(g.category, (plannedByCategory.get(g.category) ?? 0) + g.plannedPeople);
  }
  const used = TRAINING_CATEGORIES.filter(
    (c) => (trainedByCategory.get(c.value) ?? 0) > 0 || (plannedByCategory.get(c.value) ?? 0) > 0,
  );
  const byCategory = {
    categories: used.map((c) => c.label),
    trained: used.map((c) => trainedByCategory.get(c.value) ?? 0),
    planned: used.map((c) => plannedByCategory.get(c.value) ?? 0),
  };

  const typesIncomplete: IncompleteType[] = types
    .filter((t) => t.active && t.counts_for_atr && (t.hours === null || t.cost_cents === null))
    .map((t) => ({
      id: t.id,
      name: t.name,
      categoryLabel: trainingCategoryLabel(t.category),
      missingHours: t.hours === null,
      missingCost: t.cost_cents === null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const undeclared: UndeclaredEmployee[] = distinctPeople(rows)
    .filter((p) => p.populationGroup === null || p.gender === null)
    .map((p) => ({
      id: p.employeeId,
      surname: p.surname,
      names: p.names,
      site: p.site,
      missingGroup: p.populationGroup === null,
      missingGender: p.gender === null,
    }));

  return {
    period,
    site: chosen,
    year,
    nextYear,
    rows,
    courses,
    courseTotals,
    demographics,
    bbbee,
    wsp,
    byCategory,
    readiness: { typesIncomplete, undeclared },
  };
}

/** Rands with a space thousands separator and two decimals, as South African statements print them. */
export function formatRands(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  const fixed = Math.abs(value).toFixed(2);
  const [whole, frac] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${value < 0 ? "-" : ""}R ${grouped}.${frac}`;
}
