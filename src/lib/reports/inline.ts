import type { ReportEmployee } from "@/lib/reports/data";
import {
  GENDERS,
  OCCUPATIONAL_LEVEL_SHORT,
  OCCUPATIONAL_LEVELS,
  POPULATION_GROUPS,
  TERMINATION_REASONS,
  siteOf,
} from "@/lib/hr/operations";
import { todayIso } from "@/lib/certifications/status";
import type { InlineOption } from "@/components/reports/InlineField";
import type { LeaverCandidate } from "@/components/reports/RecordLeaver";

/** Dropdown options for the termination reason, grouped by class. */
export function terminationReasonOptions(faultOnly = false): InlineOption[] {
  return TERMINATION_REASONS.filter((r) => !faultOnly || r.cls === "fault").map((r) => ({
    value: r.value,
    label: r.label,
    group: r.cls === "fault" ? "Fault" : "No fault",
  }));
}

/** Retirement ages 50 to 75, with the workspace default as the blank choice. */
export function retirementAgeOptions(defaultAge: number): InlineOption[] {
  const out: InlineOption[] = [];
  for (let a = 50; a <= 75; a += 1) out.push({ value: String(a), label: String(a) });
  return out.map((o) => (Number(o.value) === defaultAge ? { ...o, label: `${o.label} (default)` } : o));
}

/**
 * People who can still be recorded as leavers: in service on the last day
 * of the period, within the chosen site. Sorted by surname for the list.
 */
export function leaverCandidates(
  employees: ReportEmployee[],
  periodEnd: string,
  site?: string | null,
): LeaverCandidate[] {
  const chosen = site && site.trim().length > 0 ? site : null;
  return employees
    .filter(
      (e) =>
        e.terminated_at === null &&
        (e.engaged_at === null || e.engaged_at <= periodEnd) &&
        (!chosen || siteOf(e.site) === chosen),
    )
    .map((e) => ({
      id: e.id,
      name: `${e.surname}, ${e.names}`,
      site: siteOf(e.site),
      designation: e.designation ?? "",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The later of the period end and today is never allowed; the earlier is the default last day. */
export function defaultLastDay(periodEnd: string): { defaultDate: string; maxDate: string } {
  const today = todayIso();
  return {
    defaultDate: periodEnd < today ? periodEnd : today,
    maxDate: today,
  };
}

/** Dropdown options for the EEA1 fields, blank meaning not declared. */
export function genderOptions(): InlineOption[] {
  return GENDERS.map((g) => ({ value: g.value, label: g.label }));
}

export function populationGroupOptions(): InlineOption[] {
  return POPULATION_GROUPS.map((g) => ({ value: g.value, label: g.label }));
}

export function disabilityOptions(): InlineOption[] {
  return [
    { value: "no", label: "No" },
    { value: "yes", label: "Yes" },
  ];
}

export function occupationalLevelOptions(): InlineOption[] {
  return OCCUPATIONAL_LEVELS.map((l) => ({ value: l.value, label: OCCUPATIONAL_LEVEL_SHORT[l.value] }));
}

/** The value an InlineField shows for a nullable boolean declaration. */
export function disabilityValue(v: boolean | null | undefined): string {
  return v === true ? "yes" : v === false ? "no" : "";
}
