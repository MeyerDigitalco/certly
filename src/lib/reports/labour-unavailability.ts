import type { Absence, AbsenceReason } from "@/lib/types/database";
import type { ReportEmployee } from "@/lib/reports/data";
import {
  ABSENCE_REASONS,
  absenceReasonLabel,
  monthLabel,
  overlapDays,
  previousPeriod,
  siteOf,
  type Period,
} from "@/lib/hr/operations";

/**
 * Labour unavailability for one month: how many people the contractor had in
 * service, how many man-days that gave the client, and how many of those
 * days were lost to absence, split by reason, by site and by whether the
 * absence was planned. Every function here is pure over the register and the
 * absence log so the page and the workbook cannot disagree.
 */

export const TREND_MONTHS = 6;
export const REPEAT_WINDOW_DAYS = 90;
export const REPEAT_MIN_SPELLS = 3;

export const AVAILABILITY_NOTE =
  "Available man-days are people in service at month end multiplied by calendar days in the month. Days lost are calendar days of absence inside the month for those people. Availability is available man-days less days lost, as a share of available man-days.";

export const PLANNED_NOTE =
  "Planned reasons are annual leave and study leave. They count against availability but are not held against the contractor. Unplanned reasons are what the client reads. Sick leave is a day count only; no medical detail is stored.";

export interface UnavailabilityStats {
  inService: number;
  calendarDays: number;
  availableManDays: number;
  daysLost: number;
  availabilityPct: number;
  plannedDaysLost: number;
  unplannedDaysLost: number;
  awolDays: number;
  spellCount: number;
}

export interface ReasonRow {
  reason: AbsenceReason;
  label: string;
  planned: boolean;
  bySite: number[];
  total: number;
}

export interface ReasonSubtotal {
  label: string;
  bySite: number[];
  total: number;
}

export interface SiteRow {
  site: string;
  inService: number;
  availableManDays: number;
  planned: number;
  unplanned: number;
  total: number;
  availabilityPct: number;
}

export interface TrendMonth {
  key: string;
  label: string;
  shortLabel: string;
  inService: number;
  availableManDays: number;
  daysLost: number;
  unplannedDaysLost: number;
  awolDays: number;
  availabilityPct: number;
}

export interface RepeatRow {
  id: string;
  surname: string;
  names: string;
  designation: string;
  site: string;
  spells: number;
  days: number;
}

export interface SpellRow {
  id: string;
  employeeId: string;
  surname: string;
  names: string;
  designation: string;
  site: string;
  firstDay: string;
  lastDay: string;
  halfDay: boolean;
  daysInPeriod: number;
  reason: AbsenceReason;
  reasonLabel: string;
  planned: boolean;
  notes: string;
}

export interface LabourUnavailabilityResult {
  period: Period;
  site: string | null;
  sites: string[];
  stats: UnavailabilityStats;
  byReason: ReasonRow[];
  plannedSubtotal: ReasonSubtotal;
  unplannedSubtotal: ReasonSubtotal;
  grandTotal: ReasonSubtotal;
  bySite: SiteRow[];
  bySiteTotal: SiteRow;
  trend: TrendMonth[];
  repeat: RepeatRow[];
  spells: SpellRow[];
  hasAnyAbsence: boolean;
}

const PLANNED = new Set<AbsenceReason>(
  ABSENCE_REASONS.filter((r) => r.planned).map((r) => r.value),
);

export function isPlannedReason(reason: AbsenceReason): boolean {
  return PLANNED.has(reason);
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function zeros(n: number): number[] {
  return new Array<number>(n).fill(0);
}

/** Active on a date: engaged on or before it and not yet gone by it. */
export function activeOn(e: ReportEmployee, iso: string): boolean {
  return (
    (e.engaged_at === null || e.engaged_at <= iso) &&
    (e.terminated_at === null || e.terminated_at > iso)
  );
}

function narrowToSite(employees: ReportEmployee[], site?: string | null): ReportEmployee[] {
  const chosen = site && site.trim().length > 0 ? site : null;
  return chosen === null ? employees : employees.filter((e) => siteOf(e.site) === chosen);
}

/** Calendar days in the period, inclusive of both ends. */
export function daysInPeriod(period: Period): number {
  return overlapDays(period.start, period.end, period.start, period.end);
}

/** Calendar days of one spell that fall inside the period; a half day is 0.5. */
export function spellDaysInPeriod(absence: Absence, period: Period): number {
  return overlapDays(absence.starts_on, absence.ends_on, period.start, period.end, absence.half_day);
}

function shiftIso(iso: string, days: number): string {
  const d = new Date(Date.parse(iso) + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** Availability as a percentage of available man-days, 0 when there are none. */
export function availabilityPct(availableManDays: number, daysLost: number): number {
  if (availableManDays <= 0) return 0;
  const pct = ((availableManDays - daysLost) / availableManDays) * 100;
  if (!Number.isFinite(pct)) return 0;
  return round1(Math.max(0, Math.min(100, pct)));
}

/**
 * People with three or more unplanned spells in the trailing window ending
 * on asOf. Only people in service on asOf are considered. A spell counts if
 * any of its days fall inside the window; the days column is the days of
 * those spells inside the window.
 */
export function repeatUnplanned(
  employees: ReportEmployee[],
  absences: Absence[],
  asOf: string,
  windowDays = REPEAT_WINDOW_DAYS,
  minSpells = REPEAT_MIN_SPELLS,
): RepeatRow[] {
  const windowStart = shiftIso(asOf, -(Math.max(1, windowDays) - 1));
  const byId = new Map<string, ReportEmployee>();
  for (const e of employees) {
    if (activeOn(e, asOf)) byId.set(e.id, e);
  }
  const tally = new Map<string, { spells: number; days: number }>();
  for (const a of absences) {
    if (!byId.has(a.employee_id)) continue;
    if (isPlannedReason(a.reason)) continue;
    const days = overlapDays(a.starts_on, a.ends_on, windowStart, asOf, a.half_day);
    if (days <= 0) continue;
    const t = tally.get(a.employee_id) ?? { spells: 0, days: 0 };
    t.spells += 1;
    t.days += days;
    tally.set(a.employee_id, t);
  }
  const out: RepeatRow[] = [];
  for (const [id, t] of tally) {
    if (t.spells < minSpells) continue;
    const e = byId.get(id) as ReportEmployee;
    out.push({
      id,
      surname: e.surname,
      names: e.names,
      designation: e.designation ?? "",
      site: siteOf(e.site),
      spells: t.spells,
      days: t.days,
    });
  }
  return out.sort(
    (a, b) =>
      b.spells - a.spells ||
      b.days - a.days ||
      a.surname.localeCompare(b.surname) ||
      a.names.localeCompare(b.names),
  );
}

interface MonthCore {
  inService: ReportEmployee[];
  sites: string[];
  stats: UnavailabilityStats;
  spells: SpellRow[];
}

/**
 * The part of the report that the six month trend also needs: who was in
 * service at the end of the month and which spells touched it.
 */
function monthCore(employees: ReportEmployee[], absences: Absence[], period: Period): MonthCore {
  const inService = employees.filter((e) => activeOn(e, period.end));
  const byId = new Map(inService.map((e) => [e.id, e]));
  const sites = [...new Set(inService.map((e) => siteOf(e.site)))].sort((a, b) =>
    a.localeCompare(b),
  );

  const spells: SpellRow[] = [];
  for (const a of absences) {
    const e = byId.get(a.employee_id);
    if (!e) continue;
    const days = spellDaysInPeriod(a, period);
    if (days <= 0) continue;
    spells.push({
      id: a.id,
      employeeId: e.id,
      surname: e.surname,
      names: e.names,
      designation: e.designation ?? "",
      site: siteOf(e.site),
      firstDay: a.starts_on,
      lastDay: a.ends_on,
      halfDay: a.half_day,
      daysInPeriod: days,
      reason: a.reason,
      reasonLabel: absenceReasonLabel(a.reason),
      planned: isPlannedReason(a.reason),
      notes: a.notes ?? "",
    });
  }
  spells.sort(
    (a, b) =>
      a.firstDay.localeCompare(b.firstDay) ||
      a.surname.localeCompare(b.surname) ||
      a.names.localeCompare(b.names),
  );

  const calendarDays = daysInPeriod(period);
  const availableManDays = inService.length * calendarDays;
  const daysLost = sum(spells.map((s) => s.daysInPeriod));
  const plannedDaysLost = sum(spells.filter((s) => s.planned).map((s) => s.daysInPeriod));
  const awolDays = sum(
    spells.filter((s) => s.reason === "absent_without_leave").map((s) => s.daysInPeriod),
  );

  return {
    inService,
    sites,
    spells,
    stats: {
      inService: inService.length,
      calendarDays,
      availableManDays,
      daysLost,
      availabilityPct: availabilityPct(availableManDays, daysLost),
      plannedDaysLost,
      unplannedDaysLost: daysLost - plannedDaysLost,
      awolDays,
      spellCount: spells.length,
    },
  };
}

/**
 * The whole report for one month, narrowed to one site when asked. The site
 * filter is applied once to the register so every section sees the same
 * people, and absences follow their person.
 */
export function buildLabourUnavailability(
  employees: ReportEmployee[],
  absences: Absence[],
  period: Period,
  site?: string | null,
): LabourUnavailabilityResult {
  const chosen = site && site.trim().length > 0 ? site : null;
  const pool = narrowToSite(employees, chosen);
  const core = monthCore(pool, absences, period);
  const { sites, spells, stats } = core;
  const siteIndex = new Map(sites.map((s, i) => [s, i]));

  const byReason: ReasonRow[] = ABSENCE_REASONS.map((r) => ({
    reason: r.value,
    label: r.label,
    planned: r.planned,
    bySite: zeros(sites.length),
    total: 0,
  }));
  const reasonIndex = new Map(byReason.map((r, i) => [r.reason, i]));
  for (const s of spells) {
    const row = byReason[reasonIndex.get(s.reason) as number];
    const si = siteIndex.get(s.site);
    if (si !== undefined) row.bySite[si] += s.daysInPeriod;
    row.total += s.daysInPeriod;
  }

  const subtotal = (label: string, rows: ReasonRow[]): ReasonSubtotal => ({
    label,
    bySite: sites.map((_, i) => sum(rows.map((r) => r.bySite[i]))),
    total: sum(rows.map((r) => r.total)),
  });
  const plannedSubtotal = subtotal("Planned", byReason.filter((r) => r.planned));
  const unplannedSubtotal = subtotal("Unplanned", byReason.filter((r) => !r.planned));
  const grandTotal = subtotal("Total days lost", byReason);

  const bySite: SiteRow[] = sites.map((s, i) => {
    const inService = core.inService.filter((e) => siteOf(e.site) === s).length;
    const availableManDays = inService * stats.calendarDays;
    const planned = plannedSubtotal.bySite[i];
    const unplanned = unplannedSubtotal.bySite[i];
    return {
      site: s,
      inService,
      availableManDays,
      planned,
      unplanned,
      total: planned + unplanned,
      availabilityPct: availabilityPct(availableManDays, planned + unplanned),
    };
  });
  const bySiteTotal: SiteRow = {
    site: "Total",
    inService: stats.inService,
    availableManDays: stats.availableManDays,
    planned: stats.plannedDaysLost,
    unplanned: stats.unplannedDaysLost,
    total: stats.daysLost,
    availabilityPct: stats.availabilityPct,
  };

  const trend: TrendMonth[] = [];
  let p = period;
  for (let i = 0; i < TREND_MONTHS; i += 1) {
    const m = monthCore(pool, absences, p);
    trend.unshift({
      key: `${p.year}-${String(p.month).padStart(2, "0")}`,
      label: p.label,
      shortLabel: monthLabel(p.month, true),
      inService: m.stats.inService,
      availableManDays: m.stats.availableManDays,
      daysLost: m.stats.daysLost,
      unplannedDaysLost: m.stats.unplannedDaysLost,
      awolDays: m.stats.awolDays,
      availabilityPct: m.stats.availabilityPct,
    });
    p = previousPeriod(p);
  }

  const poolIds = new Set(pool.map((e) => e.id));

  return {
    period,
    site: chosen,
    sites,
    stats,
    byReason,
    plannedSubtotal,
    unplannedSubtotal,
    grandTotal,
    bySite,
    bySiteTotal,
    trend,
    repeat: repeatUnplanned(pool, absences, period.end),
    spells,
    hasAnyAbsence: absences.some((a) => poolIds.has(a.employee_id)),
  };
}

export function formatDays(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export function formatPct(v: number): string {
  if (!Number.isFinite(v)) return "0%";
  return `${Number.isInteger(v) ? v : v.toFixed(1)}%`;
}
