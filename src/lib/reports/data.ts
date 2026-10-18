import { createClient } from "@/lib/supabase/server";
import type {
  Employee,
  LabourPlan,
  OnboardingCandidate,
} from "@/lib/types/database";
import { siteOf } from "@/lib/hr/operations";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * The reads every monthly report is built from.
 *
 * Deliberately few and deliberately whole: a report pulls the full employee
 * list including people who have left, then slices it in memory by period.
 * At the sizes a contractor runs (hundreds, not hundreds of thousands) that
 * is faster than a query per cell and far easier to prove correct, and it
 * keeps every tenant filter in one file the isolation audit can see.
 */

export type ReportEmployee = Pick<
  Employee,
  | "id"
  | "surname"
  | "names"
  | "id_number"
  | "id_type"
  | "id_country"
  | "site"
  | "designation"
  | "superior"
  | "date_of_birth"
  | "engaged_at"
  | "retirement_age"
  | "approved_retirement_date"
  | "terminated_at"
  | "termination_reason"
  | "termination_notes"
  | "created_at"
>;

export async function getEmployeesForReports(
  orgId: string,
): Promise<ReportEmployee[]> {
  const supabase: any = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select(
      "id, surname, names, id_number, id_type, id_country, site, designation, superior, date_of_birth, engaged_at, retirement_age, approved_retirement_date, terminated_at, termination_reason, termination_notes, created_at",
    )
    .eq("organisation_id", orgId)
    .order("surname", { ascending: true })
    .order("names", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ReportEmployee[];
}

/**
 * Every plan row, newest first. The caller picks the row in force for a date
 * with planInForce below rather than this function guessing a date.
 */
export async function getLabourPlans(orgId: string): Promise<LabourPlan[]> {
  const supabase: any = await createClient();
  const { data, error } = await supabase
    .from("labour_plans")
    .select("*")
    .eq("organisation_id", orgId)
    .order("effective_from", { ascending: false });
  if (error) throw error;
  return (data ?? []) as LabourPlan[];
}

/**
 * The planned count per (site, designation) that applied on a date: the
 * latest row whose effective_from is on or before it. Rows effective later
 * are ignored, so looking at June does not see a plan approved in August.
 */
export function planInForce(
  plans: LabourPlan[],
  asOf: string,
): Map<string, { site: string; designation: string; planned: number }> {
  const out = new Map<string, { site: string; designation: string; planned: number }>();
  const sorted = [...plans].sort((a, b) =>
    a.effective_from < b.effective_from ? 1 : a.effective_from > b.effective_from ? -1 : 0,
  );
  for (const p of sorted) {
    if (p.effective_from > asOf) continue;
    const key = planKey(p.site, p.designation);
    if (!out.has(key)) {
      out.set(key, { site: p.site, designation: p.designation, planned: p.planned });
    }
  }
  return out;
}

export function planKey(site: string, designation: string): string {
  return `${siteOf(site).toLowerCase()}::${designation.trim().toLowerCase()}`;
}

export async function getOnboardingCandidates(
  orgId: string,
): Promise<OnboardingCandidate[]> {
  const supabase: any = await createClient();
  const { data, error } = await supabase
    .from("onboarding_candidates")
    .select("*")
    .eq("organisation_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as OnboardingCandidate[];
}

/** Distinct sites across the register and the plan, for the filter dropdown. */
export function sitesFrom(
  employees: ReportEmployee[],
  plans: LabourPlan[] = [],
  candidates: OnboardingCandidate[] = [],
): string[] {
  const set = new Set<string>();
  for (const e of employees) set.add(siteOf(e.site));
  for (const p of plans) set.add(siteOf(p.site));
  for (const c of candidates) set.add(siteOf(c.site));
  return [...set].sort((a, b) => a.localeCompare(b));
}
