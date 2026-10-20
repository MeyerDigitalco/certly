import type {
  AbsenceReason,
  Gender,
  OccupationalLevel,
  PopulationGroup,
  TerminationReason,
  TrainingCategory,
} from "@/lib/types/database";

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

/* ------------------------------------------------------------------ */
/* Employment equity                                                   */
/* ------------------------------------------------------------------ */

/** EEA2 column order: African, Coloured, Indian, White. */
export const POPULATION_GROUPS: Array<{ value: PopulationGroup; label: string; short: string }> = [
  { value: "african", label: "African", short: "A" },
  { value: "coloured", label: "Coloured", short: "C" },
  { value: "indian", label: "Indian", short: "I" },
  { value: "white", label: "White", short: "W" },
];

export const GENDERS: Array<{ value: Gender; label: string }> = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

/** EEA2 occupational levels, top row first, as the form prints them. */
export const OCCUPATIONAL_LEVELS: Array<{ value: OccupationalLevel; label: string }> = [
  { value: "top_management", label: "Top management" },
  { value: "senior_management", label: "Senior management" },
  { value: "professionally_qualified", label: "Professionally qualified and experienced specialists and mid-management" },
  { value: "skilled_technical", label: "Skilled technical and academically qualified workers, junior management, supervisors, foremen and superintendents" },
  { value: "semi_skilled", label: "Semi-skilled and discretionary decision making" },
  { value: "unskilled", label: "Unskilled and defined decision making" },
];

export const OCCUPATIONAL_LEVEL_SHORT: Record<OccupationalLevel, string> = {
  top_management: "Top management",
  senior_management: "Senior management",
  professionally_qualified: "Professionally qualified",
  skilled_technical: "Skilled technical",
  semi_skilled: "Semi-skilled",
  unskilled: "Unskilled",
};

export function isPopulationGroup(v: unknown): v is PopulationGroup {
  return POPULATION_GROUPS.some((g) => g.value === v);
}

export function isGender(v: unknown): v is Gender {
  return GENDERS.some((g) => g.value === v);
}

export function isOccupationalLevel(v: unknown): v is OccupationalLevel {
  return OCCUPATIONAL_LEVELS.some((l) => l.value === v);
}

/** Designated employer under the Employment Equity Act from 1 January 2025. */
export const EE_DESIGNATED_THRESHOLD = 50;

/**
 * A person is a foreign national on the EEA2 when they are not a South
 * African citizen. Certly does not ask for citizenship; the identity
 * document type is the declared proxy and is what a site gate uses too.
 */
export function isForeignNational(idType: string | null | undefined): boolean {
  return idType !== null && idType !== undefined && idType !== "sa_id";
}

/**
 * The Employment Equity reporting year runs 1 September to 31 August; the
 * online report is due 15 January after it closes. For a period ending
 * inside a reporting year this returns that year's start and end.
 */
export function eeReportingYear(periodEnd: string): { start: string; end: string; label: string } {
  const y = Number(periodEnd.slice(0, 4));
  const m = Number(periodEnd.slice(5, 7));
  const startYear = m >= 9 ? y : y - 1;
  return {
    start: `${startYear}-09-01`,
    end: `${startYear + 1}-08-31`,
    label: `1 Sep ${startYear} to 31 Aug ${startYear + 1}`,
  };
}

/* ------------------------------------------------------------------ */
/* Skills development                                                  */
/* ------------------------------------------------------------------ */

export const TRAINING_CATEGORIES: Array<{ value: TrainingCategory; label: string; atr: boolean }> = [
  { value: "short_course", label: "Short course", atr: true },
  { value: "skills_programme", label: "Skills programme", atr: true },
  { value: "learnership", label: "Learnership", atr: true },
  { value: "apprenticeship", label: "Apprenticeship", atr: true },
  { value: "internship", label: "Internship", atr: true },
  { value: "bursary", label: "Bursary", atr: true },
  { value: "induction", label: "Site induction", atr: false },
  { value: "other", label: "Other", atr: true },
];

export function isTrainingCategory(v: unknown): v is TrainingCategory {
  return TRAINING_CATEGORIES.some((c) => c.value === v);
}

export function trainingCategoryLabel(c: TrainingCategory): string {
  return TRAINING_CATEGORIES.find((x) => x.value === c)?.label ?? c;
}

/**
 * SETA financial year: 1 April to 31 March. The year is named for the
 * calendar year in which it ends, so seta_year 2027 is April 2026 to
 * March 2027 and its WSP and ATR are due 30 April 2027.
 */
export function setaYearFor(iso: string): number {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  return m >= 4 ? y + 1 : y;
}

export function setaYearRange(setaYear: number): { start: string; end: string; label: string; due: string } {
  return {
    start: `${setaYear - 1}-04-01`,
    end: `${setaYear}-03-31`,
    label: `1 Apr ${setaYear - 1} to 31 Mar ${setaYear}`,
    due: `${setaYear}-04-30`,
  };
}

export const SETAS: Array<{ value: string; label: string }> = [
  { value: "MQA", label: "MQA (mining and minerals)" },
  { value: "CETA", label: "CETA (construction)" },
  { value: "merSETA", label: "merSETA (manufacturing, engineering)" },
  { value: "EWSETA", label: "EWSETA (energy and water)" },
  { value: "TETA", label: "TETA (transport)" },
  { value: "CHIETA", label: "CHIETA (chemical)" },
  { value: "Services SETA", label: "Services SETA" },
  { value: "other", label: "Other" },
];

/* ------------------------------------------------------------------ */
/* Absence                                                             */
/* ------------------------------------------------------------------ */

export const ABSENCE_REASONS: Array<{ value: AbsenceReason; label: string; planned: boolean }> = [
  { value: "annual_leave", label: "Annual leave", planned: true },
  { value: "study_leave", label: "Study leave", planned: true },
  { value: "family_responsibility", label: "Family responsibility leave", planned: false },
  { value: "sick_leave", label: "Sick leave", planned: false },
  { value: "injury_on_duty", label: "Injury on duty", planned: false },
  { value: "unpaid_leave", label: "Unpaid leave", planned: false },
  { value: "absent_without_leave", label: "Absent without leave", planned: false },
  { value: "other", label: "Other", planned: false },
];

export function isAbsenceReason(v: unknown): v is AbsenceReason {
  return ABSENCE_REASONS.some((r) => r.value === v);
}

export function absenceReasonLabel(r: AbsenceReason): string {
  return ABSENCE_REASONS.find((x) => x.value === r)?.label ?? r;
}

/** Calendar days of a spell that fall inside a window, inclusive both ends. */
export function overlapDays(
  startsOn: string,
  endsOn: string,
  windowStart: string,
  windowEnd: string,
  halfDay = false,
): number {
  const s = startsOn > windowStart ? startsOn : windowStart;
  const e = endsOn < windowEnd ? endsOn : windowEnd;
  if (e < s) return 0;
  const days = Math.round((Date.parse(e) - Date.parse(s)) / 86_400_000) + 1;
  return halfDay ? 0.5 : days;
}
