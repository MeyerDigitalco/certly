import type { ReportEmployee } from "@/lib/reports/data";
import {
  ageOn,
  officialRetirementDate,
  periodFor,
  siteOf,
  type Period,
} from "@/lib/hr/operations";

/**
 * Overdue retirement: everyone in service at month end who is past, at, or
 * within six months of their retirement date, with the approved extension
 * where one exists. Pure functions over the register so the page and the
 * workbook cannot disagree.
 */

export type RetirementStatus = "overdue" | "extended" | "due_this_month" | "due_soon";

export const STATUS_ORDER: RetirementStatus[] = [
  "overdue",
  "extended",
  "due_this_month",
  "due_soon",
];

export const STATUS_LABELS: Record<RetirementStatus, string> = {
  overdue: "Overdue",
  extended: "On approved extension",
  due_this_month: "Retiring this month",
  due_soon: "Due in next 6 months",
};

export interface RetirementClassification {
  status: RetirementStatus;
  officialDate: string;
  approvedDate: string | null;
  retirementAge: number;
  ageIsDefault: boolean;
  age: number;
  /** Months overdue for "overdue", months remaining for the other statuses. */
  months: number;
}

export interface RetirementRow extends RetirementClassification {
  id: string;
  surname: string;
  names: string;
  idNumber: string;
  idMasked: string;
  designation: string;
  site: string;
  dateOfBirth: string;
  statusLabel: string;
  monthsLabel: string;
}

export interface MissingDobRow {
  id: string;
  surname: string;
  names: string;
  designation: string;
  site: string;
}

export interface RetirementCounts {
  overdue: number;
  extended: number;
  dueThisMonth: number;
  dueSoon: number;
  missingDob: number;
  assessed: number;
}

export interface RetirementBySite {
  sites: string[];
  overdue: number[];
  extended: number[];
  dueWithinSix: number[];
}

export interface RetirementResult {
  period: Period;
  site: string | null;
  defaultRetirementAge: number;
  windowEnd: string;
  rows: RetirementRow[];
  missingDob: MissingDobRow[];
  counts: RetirementCounts;
  bySite: RetirementBySite;
}

/** In service on a calendar day: started on or before it and not yet left. */
export function activeOn(e: ReportEmployee, iso: string): boolean {
  return (
    (e.engaged_at === null || e.engaged_at <= iso) &&
    (e.terminated_at === null || e.terminated_at > iso)
  );
}

/**
 * Whole calendar months from one date to another, counted on the month
 * grid. August to October is 2 whichever days are involved. Negative when
 * the second date is earlier.
 */
export function monthsBetween(fromIso: string, toIso: string): number {
  const a = /^(\d{4})-(\d{2})/.exec(fromIso);
  const b = /^(\d{4})-(\d{2})/.exec(toIso);
  if (!a || !b) return 0;
  return Number(b[1]) * 12 + Number(b[2]) - (Number(a[1]) * 12 + Number(a[2]));
}

/** Hide an identity number on screen, keeping only the last four characters. */
export function maskId(id: string | null | undefined): string {
  const s = (id ?? "").replace(/\s+/g, "");
  if (s.length === 0) return "";
  return `******${s.slice(-4)}`;
}

/** The last day of the sixth calendar month after the period. */
export function sixMonthsAfter(period: Period): string {
  const total = period.year * 12 + (period.month - 1) + 6;
  return periodFor(Math.floor(total / 12), (total % 12) + 1).end;
}

export function classifyRetirement(
  e: ReportEmployee,
  period: Period,
  defaultAge: number,
): RetirementClassification | null {
  if (!e.date_of_birth) return null;
  const retirementAge = e.retirement_age ?? defaultAge;
  if (!Number.isFinite(retirementAge) || retirementAge <= 0) return null;
  const officialDate = officialRetirementDate(e.date_of_birth, retirementAge);
  const age = ageOn(e.date_of_birth, period.end);
  if (!officialDate || age === null) return null;

  const base = {
    officialDate,
    approvedDate: e.approved_retirement_date,
    retirementAge,
    ageIsDefault: e.retirement_age === null,
    age,
  };

  if (officialDate < period.start) {
    const approved = e.approved_retirement_date;
    if (approved && approved >= period.start) {
      return { ...base, status: "extended", months: monthsBetween(period.end, approved) };
    }
    const shouldHaveLeft = approved && approved > officialDate ? approved : officialDate;
    return { ...base, status: "overdue", months: monthsBetween(shouldHaveLeft, period.end) };
  }
  if (officialDate <= period.end) {
    return { ...base, status: "due_this_month", months: 0 };
  }
  if (officialDate <= sixMonthsAfter(period)) {
    return { ...base, status: "due_soon", months: monthsBetween(period.end, officialDate) };
  }
  return null;
}

export function monthsText(status: RetirementStatus, months: number): string {
  const n = Math.max(0, months);
  const word = n === 1 ? "month" : "months";
  if (status === "overdue") return `${n} ${word} overdue`;
  if (status === "due_this_month") return "This month";
  return `${n} ${word} remaining`;
}

function statusRank(s: RetirementStatus): number {
  return STATUS_ORDER.indexOf(s);
}

export function buildRetirement(
  employees: ReportEmployee[],
  period: Period,
  defaultRetirementAge: number,
  site?: string | null,
): RetirementResult {
  const chosen = site && site.trim().length > 0 ? site : null;
  const pool = employees.filter(
    (e) => activeOn(e, period.end) && (!chosen || siteOf(e.site) === chosen),
  );

  const rows: RetirementRow[] = [];
  const missingDob: MissingDobRow[] = [];

  for (const e of pool) {
    if (!e.date_of_birth) {
      missingDob.push({
        id: e.id,
        surname: e.surname,
        names: e.names,
        designation: e.designation ?? "",
        site: siteOf(e.site),
      });
      continue;
    }
    const c = classifyRetirement(e, period, defaultRetirementAge);
    if (!c) continue;
    rows.push({
      ...c,
      id: e.id,
      surname: e.surname,
      names: e.names,
      idNumber: e.id_number ?? "",
      idMasked: maskId(e.id_number),
      designation: e.designation ?? "",
      site: siteOf(e.site),
      dateOfBirth: e.date_of_birth,
      statusLabel: STATUS_LABELS[c.status],
      monthsLabel: monthsText(c.status, c.months),
    });
  }

  rows.sort(
    (a, b) =>
      statusRank(a.status) - statusRank(b.status) ||
      a.officialDate.localeCompare(b.officialDate) ||
      a.surname.localeCompare(b.surname) ||
      a.names.localeCompare(b.names),
  );
  missingDob.sort(
    (a, b) => a.surname.localeCompare(b.surname) || a.names.localeCompare(b.names),
  );

  const count = (s: RetirementStatus) => rows.filter((r) => r.status === s).length;
  const counts: RetirementCounts = {
    overdue: count("overdue"),
    extended: count("extended"),
    dueThisMonth: count("due_this_month"),
    dueSoon: count("due_soon"),
    missingDob: missingDob.length,
    assessed: pool.length - missingDob.length,
  };

  const sites = chosen
    ? [chosen]
    : [...new Set(rows.map((r) => r.site))].sort((a, b) => a.localeCompare(b));
  const perSite = (pred: (r: RetirementRow) => boolean) =>
    sites.map((s) => rows.filter((r) => r.site === s && pred(r)).length);

  return {
    period,
    site: chosen,
    defaultRetirementAge,
    windowEnd: sixMonthsAfter(period),
    rows,
    missingDob,
    counts,
    bySite: {
      sites,
      overdue: perSite((r) => r.status === "overdue"),
      extended: perSite((r) => r.status === "extended"),
      dueWithinSix: perSite((r) => r.status === "due_this_month" || r.status === "due_soon"),
    },
  };
}
