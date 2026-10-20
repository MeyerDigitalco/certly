import { createClient } from "@/lib/supabase/server";
import type {
  Absence,
  Employee,
  LabourPlan,
  OnboardingCandidate,
  TrainingPlan,
  TrainingType,
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
  | "gender"
  | "population_group"
  | "disability"
  | "occupational_level"
  | "ofo_code"
  | "ee_declared_at"
  | "created_at"
>;

export async function getEmployeesForReports(
  orgId: string,
): Promise<ReportEmployee[]> {
  const supabase: any = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select(
      "id, surname, names, id_number, id_type, id_country, site, designation, superior, date_of_birth, engaged_at, retirement_age, approved_retirement_date, terminated_at, termination_reason, termination_notes, gender, population_group, disability, occupational_level, ofo_code, ee_declared_at, created_at",
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

/** Every absence spell, oldest first. Reports slice by period in memory. */
export async function getAbsences(orgId: string): Promise<Absence[]> {
  const supabase: any = await createClient();
  const { data, error } = await supabase
    .from("absences")
    .select("*")
    .eq("organisation_id", orgId)
    .order("starts_on", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Absence[];
}

export async function getTrainingTypesForReports(orgId: string): Promise<TrainingType[]> {
  const supabase: any = await createClient();
  const { data, error } = await supabase
    .from("training_types")
    .select("*")
    .eq("organisation_id", orgId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TrainingType[];
}

/**
 * Training delivered, as the Annual Training Report sees it: one row per
 * certificate with the date it was obtained. A refresher overwrites the
 * previous certificate of the same type, so the training_date is always
 * the most recent delivery, which is the one the SETA year wants.
 */
export interface TrainingDelivered {
  id: string;
  employee_id: string;
  training_type_id: string;
  training_date: string | null;
  expiry_date: string | null;
}

export async function getTrainingDelivered(orgId: string): Promise<TrainingDelivered[]> {
  const supabase: any = await createClient();
  const { data, error } = await supabase
    .from("certifications")
    .select("id, employee_id, training_type_id, training_date, expiry_date")
    .eq("organisation_id", orgId);
  if (error) throw error;
  return (data ?? []) as TrainingDelivered[];
}

export async function getTrainingPlans(orgId: string): Promise<TrainingPlan[]> {
  const supabase: any = await createClient();
  const { data, error } = await supabase
    .from("training_plans")
    .select("*")
    .eq("organisation_id", orgId)
    .order("seta_year", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TrainingPlan[];
}
