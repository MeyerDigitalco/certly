import type { LabourPlan, TerminationReason } from "@/lib/types/database";
import type { ReportEmployee } from "@/lib/reports/data";
import { planInForce, sitesFrom } from "@/lib/reports/data";
import {
  TERMINATION_REASONS,
  inPeriod,
  monthLabel,
  previousPeriod,
  siteOf,
  terminationClass,
  terminationLabel,
  type Period,
  type TerminationClass,
} from "@/lib/hr/operations";

/**
 * Staff movement: who left, why, where, against who joined and what the
 * approved plan said the site should carry. Everything here is a pure
 * function over the register so the page and the workbook cannot disagree.
 */

export interface MatrixRow {
  reason: TerminationReason;
  label: string;
  cls: TerminationClass;
  bySite: number[];
  total: number;
}

export interface MatrixGroup {
  cls: TerminationClass;
  label: string;
  rows: MatrixRow[];
  subtotal: { bySite: number[]; total: number };
}

export interface TerminationMatrix {
  sites: string[];
  groups: MatrixGroup[];
  unclassified: { bySite: number[]; total: number };
  grand: { bySite: number[]; total: number };
}

export interface MovementKpis {
  startHeadcount: number;
  joiners: number;
  leavers: number;
  endHeadcount: number;
  turnoverPct: number;
  noFault: number;
  fault: number;
  unclassified: number;
}

export interface PlanVsActualRow {
  site: string;
  planned: number;
  actual: number;
  variance: number;
  variancePct: number | null;
}

export interface PlanVsActual {
  rows: PlanVsActualRow[];
  totals: PlanVsActualRow;
  hasPlan: boolean;
}

export interface TrendMonth {
  period: Period;
  label: string;
  noFault: number;
  fault: number;
  joiners: number;
  leavers: number;
}

export interface LeaverRow {
  id: string;
  surname: string;
  names: string;
  designation: string;
  site: string;
  lastDay: string;
  reason: TerminationReason | null;
  reasonLabel: string;
  cls: TerminationClass | null;
  clsLabel: string;
}

export interface StaffMovementResult {
  period: Period;
  site: string | null;
  kpis: MovementKpis;
  matrix: TerminationMatrix;
  planVsActual: PlanVsActual;
  trend: TrendMonth[];
  leavers: LeaverRow[];
}

export const CLASS_LABELS: Record<TerminationClass, string> = {
  no_fault: "No fault",
  fault: "Fault",
};

export const UNCLASSIFIED_LABEL = "Reason not recorded";

/** In service on a calendar day: started on or before it and not yet left. */
export function activeOn(e: ReportEmployee, iso: string): boolean {
  return (
    (e.engaged_at === null || e.engaged_at <= iso) &&
    (e.terminated_at === null || e.terminated_at > iso)
  );
}

/** In service the day before the period opened. */
export function activeAtStart(e: ReportEmployee, period: Period): boolean {
  return (
    (e.engaged_at === null || e.engaged_at < period.start) &&
    (e.terminated_at === null || e.terminated_at >= period.start)
  );
}

export function activeAtEnd(e: ReportEmployee, period: Period): boolean {
  return activeOn(e, period.end);
}

export function joinedIn(e: ReportEmployee, period: Period): boolean {
  return inPeriod(e.engaged_at, period);
}

export function leftIn(e: ReportEmployee, period: Period): boolean {
  return inPeriod(e.terminated_at, period);
}

export function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** Leavers over the average of opening and closing headcount, as a percentage. */
export function turnoverPct(start: number, end: number, leavers: number): number {
  const avg = (start + end) / 2;
  if (avg <= 0) return 0;
  return round1((leavers / avg) * 100);
}

function classOf(reason: TerminationReason | null): TerminationClass | null {
  return reason ? terminationClass(reason) : null;
}

function zeros(n: number): number[] {
  return Array.from({ length: n }, () => 0);
}

function sumRows(rows: number[][], width: number): number[] {
  const out = zeros(width);
  for (const r of rows) r.forEach((v, i) => (out[i] += v));
  return out;
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export function buildTerminationMatrix(
  leavers: ReportEmployee[],
  sites: string[],
): TerminationMatrix {
  const index = new Map(sites.map((s, i) => [s, i]));
  const width = sites.length;

  const rowFor = (reason: TerminationReason): number[] => {
    const row = zeros(width);
    for (const e of leavers) {
      if (e.termination_reason !== reason) continue;
      const i = index.get(siteOf(e.site));
      if (i !== undefined) row[i] += 1;
    }
    return row;
  };

  const groups: MatrixGroup[] = (["no_fault", "fault"] as TerminationClass[]).map((cls) => {
    const rows: MatrixRow[] = TERMINATION_REASONS.filter((r) => r.cls === cls).map((r) => {
      const bySite = rowFor(r.value);
      return { reason: r.value, label: r.label, cls, bySite, total: sum(bySite) };
    });
    const bySite = sumRows(
      rows.map((r) => r.bySite),
      width,
    );
    return { cls, label: CLASS_LABELS[cls], rows, subtotal: { bySite, total: sum(bySite) } };
  });

  const unclassifiedBySite = zeros(width);
  for (const e of leavers) {
    if (e.termination_reason !== null) continue;
    const i = index.get(siteOf(e.site));
    if (i !== undefined) unclassifiedBySite[i] += 1;
  }

  const grandBySite = sumRows(
    [...groups.map((g) => g.subtotal.bySite), unclassifiedBySite],
    width,
  );

  return {
    sites,
    groups,
    unclassified: { bySite: unclassifiedBySite, total: sum(unclassifiedBySite) },
    grand: { bySite: grandBySite, total: sum(grandBySite) },
  };
}

export function buildPlanVsActual(
  employees: ReportEmployee[],
  plans: LabourPlan[],
  period: Period,
): PlanVsActual {
  const inForce = planInForce(plans, period.end);
  const plannedBySite = new Map<string, number>();
  for (const entry of inForce.values()) {
    const s = siteOf(entry.site);
    plannedBySite.set(s, (plannedBySite.get(s) ?? 0) + entry.planned);
  }

  const actualBySite = new Map<string, number>();
  for (const e of employees) {
    if (!activeAtEnd(e, period)) continue;
    const s = siteOf(e.site);
    actualBySite.set(s, (actualBySite.get(s) ?? 0) + 1);
  }

  const sites = [...new Set([...plannedBySite.keys(), ...actualBySite.keys()])].sort((a, b) =>
    a.localeCompare(b),
  );

  const rows: PlanVsActualRow[] = sites.map((site) => {
    const planned = plannedBySite.get(site) ?? 0;
    const actual = actualBySite.get(site) ?? 0;
    return { site, planned, actual, ...varianceOf(planned, actual) };
  });

  const planned = sum(rows.map((r) => r.planned));
  const actual = sum(rows.map((r) => r.actual));
  return {
    rows,
    totals: { site: "Total", planned, actual, ...varianceOf(planned, actual) },
    hasPlan: inForce.size > 0,
  };
}

function varianceOf(planned: number, actual: number): { variance: number; variancePct: number | null } {
  const variance = actual - planned;
  return {
    variance,
    variancePct: planned > 0 ? round1((variance / planned) * 100) : null,
  };
}

export function trendLabel(p: Period): string {
  return `${monthLabel(p.month, true)} ${String(p.year).slice(2)}`;
}

export function buildTrend(
  employees: ReportEmployee[],
  period: Period,
  months = 6,
): TrendMonth[] {
  const periods: Period[] = [];
  let p = period;
  for (let i = 0; i < months; i += 1) {
    periods.unshift(p);
    p = previousPeriod(p);
  }
  return periods.map((pp) => {
    const left = employees.filter((e) => leftIn(e, pp));
    const noFault = left.filter((e) => classOf(e.termination_reason) === "no_fault").length;
    const fault = left.filter((e) => classOf(e.termination_reason) === "fault").length;
    return {
      period: pp,
      label: trendLabel(pp),
      noFault,
      fault,
      joiners: employees.filter((e) => joinedIn(e, pp)).length,
      leavers: left.length,
    };
  });
}

export function leaverRows(leavers: ReportEmployee[]): LeaverRow[] {
  return [...leavers]
    .sort(
      (a, b) =>
        a.surname.localeCompare(b.surname) || a.names.localeCompare(b.names),
    )
    .map((e) => {
      const cls = classOf(e.termination_reason);
      return {
        id: e.id,
        surname: e.surname,
        names: e.names,
        designation: e.designation ?? "",
        site: siteOf(e.site),
        lastDay: e.terminated_at ?? "",
        reason: e.termination_reason,
        reasonLabel: e.termination_reason ? terminationLabel(e.termination_reason) : UNCLASSIFIED_LABEL,
        cls,
        clsLabel: cls ? CLASS_LABELS[cls] : "Unclassified",
      };
    });
}

/**
 * The whole report for one month, narrowed to one site when asked. The site
 * filter is applied once here so every section below it sees the same people
 * and the same plan rows.
 */
export function buildStaffMovement(
  employees: ReportEmployee[],
  plans: LabourPlan[],
  period: Period,
  site?: string | null,
): StaffMovementResult {
  const chosen = site && site.trim().length > 0 ? site : null;
  const pool = chosen ? employees.filter((e) => siteOf(e.site) === chosen) : employees;
  const planPool = chosen ? plans.filter((p) => siteOf(p.site) === chosen) : plans;

  const leavers = pool.filter((e) => leftIn(e, period));
  const sites = chosen ? [chosen] : sitesFrom(pool, planPool);
  const matrix = buildTerminationMatrix(leavers, sites);

  const startHeadcount = pool.filter((e) => activeAtStart(e, period)).length;
  const endHeadcount = pool.filter((e) => activeAtEnd(e, period)).length;
  const joiners = pool.filter((e) => joinedIn(e, period)).length;

  const kpis: MovementKpis = {
    startHeadcount,
    joiners,
    leavers: leavers.length,
    endHeadcount,
    turnoverPct: turnoverPct(startHeadcount, endHeadcount, leavers.length),
    noFault: matrix.groups.find((g) => g.cls === "no_fault")?.subtotal.total ?? 0,
    fault: matrix.groups.find((g) => g.cls === "fault")?.subtotal.total ?? 0,
    unclassified: matrix.unclassified.total,
  };

  return {
    period,
    site: chosen,
    kpis,
    matrix,
    planVsActual: buildPlanVsActual(pool, planPool, period),
    trend: buildTrend(pool, period),
    leavers: leaverRows(leavers),
  };
}

export function formatPct(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "n/a";
  return `${v.toFixed(1)}%`;
}

export function formatSigned(v: number): string {
  return v > 0 ? `+${v}` : String(v);
}
