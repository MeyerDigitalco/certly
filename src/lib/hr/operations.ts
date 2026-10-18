import type { TerminationReason } from "@/lib/types/database";

/**
 * Vocabulary shared by every HR operations report.
 *
 * The fault / no fault split is the one that matters. A client reading a
 * Staff Movement table wants to know how many people the contractor lost
 * through nothing anyone did (death, retirement, a contract ending) against
 * how many walked or were pushed. Keeping that mapping in one place means
 * four reports cannot drift on which side abscondment sits.
 */

export type TerminationClass = "no_fault" | "fault";

export const TERMINATION_REASONS: Array<{
  value: TerminationReason;
  label: string;
  cls: TerminationClass;
}> = [
  { value: "deceased", label: "Deceased", cls: "no_fault" },
  { value: "retirement", label: "Retirement", cls: "no_fault" },
  {
    value: "medical_incapacity",
    label: "Medical incapacity / ill health",
    cls: "no_fault",
  },
  {
    value: "fixed_term_end",
    label: "Fixed term / limited duration contract ended",
    cls: "no_fault",
  },
  { value: "retrenchment", label: "Retrenchment", cls: "no_fault" },
  { value: "resignation", label: "Resignation", cls: "fault" },
  { value: "dismissal", label: "Dismissal", cls: "fault" },
  { value: "abscondment", label: "Abscondment", cls: "fault" },
];

export function isTerminationReason(v: unknown): v is TerminationReason {
  return TERMINATION_REASONS.some((r) => r.value === v);
}

export function terminationLabel(reason: TerminationReason | null): string {
  if (!reason) return "";
  return TERMINATION_REASONS.find((r) => r.value === reason)?.label ?? reason;
}

export function terminationClass(reason: TerminationReason): TerminationClass {
  return TERMINATION_REASONS.find((r) => r.value === reason)?.cls ?? "fault";
}

export const ONBOARDING_STATUSES = [
  { value: "screening", label: "Screening" },
  { value: "medical", label: "Medical" },
  { value: "teba", label: "TEBA" },
  { value: "training", label: "In training" },
  { value: "ready", label: "Ready to engage" },
  { value: "engaged", label: "Engaged" },
  { value: "unfit", label: "Unfit" },
  { value: "withdrawn", label: "Withdrawn" },
] as const;

/** Statuses that count toward the onboarding pipeline on a labour plan. */
export const PIPELINE_STATUSES = ["screening", "medical", "teba", "training", "ready"] as const;

/**
 * A reporting period is a calendar month. Dates are plain ISO strings and the
 * comparison is lexical, which is correct for YYYY-MM-DD and avoids the
 * timezone trap that bit certStatus once already.
 */
export interface Period {
  year: number;
  month: number;
  start: string;
  end: string;
  label: string;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function periodFor(year: number, month: number): Period {
  const y = Math.max(2000, Math.min(2100, Math.floor(year)));
  const m = Math.max(1, Math.min(12, Math.floor(month)));
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { year: y, month: m, start, end, label: `${MONTHS[m - 1]} ${y}` };
}

export function monthLabel(month: number, short = false): string {
  const name = MONTHS[Math.max(1, Math.min(12, month)) - 1];
  return short ? name.slice(0, 3) : name;
}

/** Parse "YYYY-MM" or fall back to the current month in South African time. */
export function parsePeriod(input: string | null | undefined): Period {
  const match = /^(\d{4})-(\d{1,2})$/.exec(input ?? "");
  if (match) return periodFor(Number(match[1]), Number(match[2]));
  const now = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
  const [y, m] = now.split("-").map(Number);
  return periodFor(y, m);
}

export function periodKey(p: Period): string {
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}

export function previousPeriod(p: Period): Period {
  return p.month === 1 ? periodFor(p.year - 1, 12) : periodFor(p.year, p.month - 1);
}

export function inPeriod(iso: string | null, p: Period): boolean {
  return iso !== null && iso >= p.start && iso <= p.end;
}

/**
 * Whole years between a birth date and a reference date, on the calendar.
 * Someone born 1961-03-15 is 65 on 2026-03-15 and 64 the day before.
 */
export function ageOn(dateOfBirth: string, on: string): number | null {
  const b = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateOfBirth);
  const r = /^(\d{4})-(\d{2})-(\d{2})/.exec(on);
  if (!b || !r) return null;
  let age = Number(r[1]) - Number(b[1]);
  const beforeBirthday =
    Number(r[2]) < Number(b[2]) ||
    (Number(r[2]) === Number(b[2]) && Number(r[3]) < Number(b[3]));
  if (beforeBirthday) age -= 1;
  return age;
}

/**
 * The last day of the month in which the person reaches retirement age,
 * which is how every fund and most mine contracts phrase it.
 */
export function officialRetirementDate(
  dateOfBirth: string,
  retirementAge: number,
): string | null {
  const b = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateOfBirth);
  if (!b) return null;
  const year = Number(b[1]) + retirementAge;
  const month = Number(b[2]);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

/** Employees with no site are grouped here rather than dropped. */
export const UNASSIGNED_SITE = "Unassigned";

export function siteOf(site: string | null | undefined): string {
  const s = (site ?? "").trim();
  return s.length > 0 ? s : UNASSIGNED_SITE;
}
