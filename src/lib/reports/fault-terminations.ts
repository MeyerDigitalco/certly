import type { TerminationReason } from "@/lib/types/database";
import type { ReportEmployee } from "@/lib/reports/data";
import {
  TERMINATION_REASONS,
  inPeriod,
  monthLabel,
  siteOf,
  terminationClass,
  terminationLabel,
  type Period,
} from "@/lib/hr/operations";

/**
 * Fault terminations year on year: resignations, dismissals and abscondments
 * counted per calendar month for the year of the selected period and the
 * year before it. Everything is a pure function over the register so the
 * page and the workbook cannot disagree.
 */

export type FaultReason = "resignation" | "dismissal" | "abscondment";

export const FAULT_REASONS: FaultReason[] = TERMINATION_REASONS.filter(
  (r) => r.cls === "fault",
).map((r) => r.value as FaultReason);

export const FAULT_REASON_NOTE =
  "Fault terminations are resignation, dismissal and abscondment. Deceased, retirement, medical incapacity, fixed term contract end and retrenchment are no fault and are not counted here.";

export const MONTH_SHORT = Array.from({ length: 12 }, (_, i) => monthLabel(i + 1, true));

export interface MonthlyCounts {
  year: number;
  resignation: number[];
  dismissal: number[];
  abscondment: number[];
  total: number[];
}

export interface ReasonTotals {
  resignation: number;
  dismissal: number;
  abscondment: number;
  total: number;
}

export interface MonthRow {
  month: number;
  label: string;
  previousTotal: number;
  resignation: number;
  dismissal: number;
  abscondment: number;
  currentTotal: number;
  change: number;
  toDate: boolean;
}

export interface SiteRow extends ReasonTotals {
  site: string;
}

export interface FaultLeaverRow {
  id: string;
  surname: string;
  names: string;
  designation: string;
  site: string;
  lastDay: string;
  reason: FaultReason;
  reasonLabel: string;
}

export interface FaultTerminationStats {
  currentYtd: ReasonTotals;
  previousSameMonths: ReasonTotals;
  previousFullYear: ReasonTotals;
  change: number;
  changePct: number | null;
}

export interface FaultTerminationsResult {
  period: Period;
  site: string | null;
  currentYear: number;
  previousYear: number;
  current: MonthlyCounts;
  previous: MonthlyCounts;
  stats: FaultTerminationStats;
  months: MonthRow[];
  totals: MonthRow;
  bySite: SiteRow[];
  bySiteTotals: ReasonTotals;
  leavers: FaultLeaverRow[];
  hasAnyTermination: boolean;
}

function zeros12(): number[] {
  return Array.from({ length: 12 }, () => 0);
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export function isFaultReason(reason: TerminationReason | null): reason is FaultReason {
  return reason !== null && terminationClass(reason) === "fault";
}

/** The fault leavers in the pool, optionally narrowed to one site. */
function faultLeavers(employees: ReportEmployee[], site?: string | null): ReportEmployee[] {
  const chosen = site && site.trim().length > 0 ? site : null;
  return employees.filter(
    (e) =>
      e.terminated_at !== null &&
      isFaultReason(e.termination_reason) &&
      (chosen === null || siteOf(e.site) === chosen),
  );
}

function yearOf(iso: string): number {
  return Number(iso.slice(0, 4));
}

function monthOf(iso: string): number {
  return Number(iso.slice(5, 7));
}

/**
 * Fault terminations per calendar month for one year, one 12-length array per
 * reason plus their sum. Index 0 is January.
 */
export function monthlyCounts(
  employees: ReportEmployee[],
  year: number,
  site?: string | null,
): MonthlyCounts {
  const out: MonthlyCounts = {
    year,
    resignation: zeros12(),
    dismissal: zeros12(),
    abscondment: zeros12(),
    total: zeros12(),
  };
  for (const e of faultLeavers(employees, site)) {
    const iso = e.terminated_at as string;
    if (yearOf(iso) !== year) continue;
    const m = monthOf(iso);
    if (m < 1 || m > 12) continue;
    const reason = e.termination_reason as FaultReason;
    out[reason][m - 1] += 1;
    out.total[m - 1] += 1;
  }
  return out;
}

/** Totals for January up to and including the given month (1 to 12). */
export function yearTotalsToMonth(counts: MonthlyCounts, month: number): ReasonTotals {
  const upTo = Math.max(0, Math.min(12, Math.floor(month)));
  const slice = (arr: number[]) => sum(arr.slice(0, upTo));
  return {
    resignation: slice(counts.resignation),
    dismissal: slice(counts.dismissal),
    abscondment: slice(counts.abscondment),
    total: slice(counts.total),
  };
}

/** Percentage change from previous to current, null when previous is zero. */
export function changePct(previous: number, current: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function faultLeaverRows(leavers: ReportEmployee[]): FaultLeaverRow[] {
  return [...leavers]
    .sort(
      (a, b) =>
        (a.terminated_at ?? "").localeCompare(b.terminated_at ?? "") ||
        a.surname.localeCompare(b.surname) ||
        a.names.localeCompare(b.names),
    )
    .map((e) => ({
      id: e.id,
      surname: e.surname,
      names: e.names,
      designation: e.designation ?? "",
      site: siteOf(e.site),
      lastDay: e.terminated_at ?? "",
      reason: e.termination_reason as FaultReason,
      reasonLabel: terminationLabel(e.termination_reason),
    }));
}

/**
 * Fault terminations per site for January up to and including the selected
 * month of the current year. Sites with no fault leavers are left out.
 */
export function bySiteToMonth(
  employees: ReportEmployee[],
  year: number,
  month: number,
  site?: string | null,
): SiteRow[] {
  const map = new Map<string, SiteRow>();
  const cutoff = `${year}-${String(month).padStart(2, "0")}-31`;
  const floor = `${year}-01-01`;
  for (const e of faultLeavers(employees, site)) {
    const iso = e.terminated_at as string;
    if (iso < floor || iso > cutoff) continue;
    const s = siteOf(e.site);
    const row = map.get(s) ?? { site: s, resignation: 0, dismissal: 0, abscondment: 0, total: 0 };
    row[e.termination_reason as FaultReason] += 1;
    row.total += 1;
    map.set(s, row);
  }
  return [...map.values()].sort((a, b) => b.total - a.total || a.site.localeCompare(b.site));
}

/**
 * The whole report for one month, narrowed to one site when asked. The site
 * filter is applied once in faultLeavers so every section sees the same
 * people.
 */
export function buildFaultTerminations(
  employees: ReportEmployee[],
  period: Period,
  site?: string | null,
): FaultTerminationsResult {
  const chosen = site && site.trim().length > 0 ? site : null;
  const currentYear = period.year;
  const previousYear = period.year - 1;

  const current = monthlyCounts(employees, currentYear, chosen);
  const previous = monthlyCounts(employees, previousYear, chosen);

  const currentYtd = yearTotalsToMonth(current, period.month);
  const previousSameMonths = yearTotalsToMonth(previous, period.month);
  const previousFullYear = yearTotalsToMonth(previous, 12);

  const stats: FaultTerminationStats = {
    currentYtd,
    previousSameMonths,
    previousFullYear,
    change: currentYtd.total - previousSameMonths.total,
    changePct: changePct(previousSameMonths.total, currentYtd.total),
  };

  const months: MonthRow[] = MONTH_SHORT.map((label, i) => ({
    month: i + 1,
    label,
    previousTotal: previous.total[i],
    resignation: current.resignation[i],
    dismissal: current.dismissal[i],
    abscondment: current.abscondment[i],
    currentTotal: current.total[i],
    change: current.total[i] - previous.total[i],
    toDate: i + 1 > period.month,
  }));

  const totals: MonthRow = {
    month: 0,
    label: "Total",
    previousTotal: previousFullYear.total,
    resignation: currentYtd.resignation,
    dismissal: currentYtd.dismissal,
    abscondment: currentYtd.abscondment,
    currentTotal: currentYtd.total,
    change: currentYtd.total - previousSameMonths.total,
    toDate: true,
  };

  const bySite = bySiteToMonth(employees, currentYear, period.month, chosen);
  const bySiteTotals: ReasonTotals = {
    resignation: sum(bySite.map((r) => r.resignation)),
    dismissal: sum(bySite.map((r) => r.dismissal)),
    abscondment: sum(bySite.map((r) => r.abscondment)),
    total: sum(bySite.map((r) => r.total)),
  };

  const pool = chosen ? employees.filter((e) => siteOf(e.site) === chosen) : employees;
  const leavers = faultLeaverRows(
    faultLeavers(employees, chosen).filter((e) => inPeriod(e.terminated_at, period)),
  );

  return {
    period,
    site: chosen,
    currentYear,
    previousYear,
    current,
    previous,
    stats,
    months,
    totals,
    bySite,
    bySiteTotals,
    leavers,
    hasAnyTermination: pool.some((e) => e.terminated_at !== null),
  };
}

export function reasonLabelOf(reason: FaultReason): string {
  return terminationLabel(reason);
}

export function formatPct(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "n/a";
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}

export function formatSigned(v: number): string {
  return v > 0 ? `+${v}` : String(v);
}
