import type {
  LabourPlan,
  MedicalStatus,
  OnboardingCandidate,
  OnboardingStatus,
} from "@/lib/types/database";
import type { ReportEmployee } from "@/lib/reports/data";
import { planInForce, planKey } from "@/lib/reports/data";
import {
  ONBOARDING_STATUSES,
  PIPELINE_STATUSES,
  inPeriod,
  siteOf,
  type Period,
} from "@/lib/hr/operations";

/**
 * Labour plan and onboarding: approved positions per site and designation
 * against people in service, with the onboarding pipeline that will close
 * the gap. Pure functions over the register, the plan and the candidate
 * list so the page and the workbook always agree.
 */

export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

export interface PlanRow {
  key: string;
  site: string;
  designation: string;
  planned: number;
  actual: number;
  variance: number;
  pipeline: number;
  projectedGap: number;
}

export interface PlanTotals {
  planned: number;
  actual: number;
  variance: number;
  pipeline: number;
  projectedGap: number;
}

export interface SiteGroup {
  site: string;
  rows: PlanRow[];
  subtotal: PlanTotals;
}

export interface LabourPlanStats extends PlanTotals {
  unfilled: number;
  surplus: number;
}

export interface SiteSummary {
  site: string;
  planned: number;
  actual: number;
  pipeline: number;
}

export interface PipelineCount {
  status: PipelineStatus;
  label: string;
  count: number;
}

export interface PipelineRow {
  id: string;
  surname: string;
  names: string;
  designation: string;
  site: string;
  status: OnboardingStatus;
  statusLabel: string;
  screeningDate: string;
  medicalDate: string;
  medicalStatus: MedicalStatus | null;
  medicalStatusLabel: string;
  tebaDone: boolean;
  trainingStart: string;
  expectedPassout: string;
  daysInPipeline: number;
}

export interface EngagedRow {
  id: string;
  employeeId: string | null;
  surname: string;
  names: string;
  designation: string;
  site: string;
  engagedOn: string;
}

export interface LabourPlanResult {
  period: Period;
  site: string | null;
  hasPlan: boolean;
  groups: SiteGroup[];
  totals: PlanTotals;
  stats: LabourPlanStats;
  bySite: SiteSummary[];
  pipelineByStatus: PipelineCount[];
  pipeline: PipelineRow[];
  engaged: EngagedRow[];
}

export const NO_DESIGNATION_LABEL = "Designation not set";

const PIPELINE_SET = new Set<string>(PIPELINE_STATUSES);

export function isPipelineStatus(status: string): status is PipelineStatus {
  return PIPELINE_SET.has(status);
}

export function statusLabel(status: OnboardingStatus): string {
  return ONBOARDING_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function medicalLabel(status: MedicalStatus | null): string {
  if (status === "fit") return "Fit";
  if (status === "unfit") return "Unfit";
  if (status === "pending") return "Pending";
  return "";
}

/** In service on a calendar day: started on or before it and not yet left. */
export function activeOn(e: ReportEmployee, iso: string): boolean {
  return (
    (e.engaged_at === null || e.engaged_at <= iso) &&
    (e.terminated_at === null || e.terminated_at > iso)
  );
}

/**
 * Whole calendar days from one ISO date to another. Accepts a full timestamp
 * and reads only the date part. Returns 0 when either side cannot be read.
 */
export function daysBetween(fromIso: string, toIso: string): number {
  const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(fromIso ?? "");
  const b = /^(\d{4})-(\d{2})-(\d{2})/.exec(toIso ?? "");
  if (!a || !b) return 0;
  const start = Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3]));
  const end = Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3]));
  const days = Math.floor((end - start) / 86400000);
  return Number.isFinite(days) ? days : 0;
}

function displayDesignation(designation: string | null | undefined): string {
  const d = (designation ?? "").trim();
  return d.length > 0 ? d : NO_DESIGNATION_LABEL;
}

function emptyTotals(): PlanTotals {
  return { planned: 0, actual: 0, variance: 0, pipeline: 0, projectedGap: 0 };
}

function addTo(t: PlanTotals, r: PlanTotals): void {
  t.planned += r.planned;
  t.actual += r.actual;
  t.variance += r.variance;
  t.pipeline += r.pipeline;
  t.projectedGap += r.projectedGap;
}

function filterBySite<T extends { site: string | null }>(items: T[], site: string | null): T[] {
  return site ? items.filter((i) => siteOf(i.site) === site) : items;
}

/** Candidates still moving through onboarding, counted per stage. */
export function pipelineCounts(
  candidates: OnboardingCandidate[],
  site?: string | null,
): PipelineCount[] {
  const chosen = site && site.trim().length > 0 ? site : null;
  const pool = filterBySite(candidates, chosen);
  return PIPELINE_STATUSES.map((status) => ({
    status,
    label: statusLabel(status),
    count: pool.filter((c) => c.status === status).length,
  }));
}

function pipelineRows(candidates: OnboardingCandidate[], period: Period): PipelineRow[] {
  const order = new Map<string, number>(PIPELINE_STATUSES.map((s, i) => [s, i]));
  return candidates
    .filter((c) => isPipelineStatus(c.status))
    .map((c) => ({
      id: c.id,
      surname: c.surname,
      names: c.names,
      designation: displayDesignation(c.designation),
      site: siteOf(c.site),
      status: c.status,
      statusLabel: statusLabel(c.status),
      screeningDate: c.screened_at ?? c.screening_booked_at ?? "",
      medicalDate: c.medical_at ?? c.medical_booked_at ?? "",
      medicalStatus: c.medical_status,
      medicalStatusLabel: medicalLabel(c.medical_status),
      tebaDone: c.teba_done,
      trainingStart: c.training_start_at ?? "",
      expectedPassout: c.expected_passout_at ?? "",
      daysInPipeline: Math.max(0, daysBetween(c.created_at, period.end)),
    }))
    .sort(
      (a, b) =>
        (order.get(a.status) ?? 99) - (order.get(b.status) ?? 99) ||
        a.surname.localeCompare(b.surname) ||
        a.names.localeCompare(b.names),
    );
}

function engagedRows(
  candidates: OnboardingCandidate[],
  employees: ReportEmployee[],
  period: Period,
): EngagedRow[] {
  const byId = new Map(employees.map((e) => [e.id, e]));
  const out: EngagedRow[] = [];
  for (const c of candidates) {
    if (c.status !== "engaged") continue;
    const linked = c.employee_id ? byId.get(c.employee_id) : undefined;
    const engagedOn = linked ? linked.engaged_at : (c.updated_at ?? "").slice(0, 10);
    if (!inPeriod(engagedOn, period)) continue;
    out.push({
      id: c.id,
      employeeId: linked ? linked.id : null,
      surname: c.surname,
      names: c.names,
      designation: displayDesignation(c.designation),
      site: siteOf(c.site),
      engagedOn: engagedOn ?? "",
    });
  }
  return out.sort(
    (a, b) =>
      a.engagedOn.localeCompare(b.engagedOn) ||
      a.surname.localeCompare(b.surname) ||
      a.names.localeCompare(b.names),
  );
}

/**
 * The whole report for one month, narrowed to one site when asked. Rows are
 * every (site, designation) in the plan in force on the last day of the
 * month, plus every one that has people in service or candidates in the
 * pipeline, so the table always reconciles to the totals above it.
 */
export function buildLabourPlan(
  employees: ReportEmployee[],
  plans: LabourPlan[],
  candidates: OnboardingCandidate[],
  period: Period,
  site?: string | null,
): LabourPlanResult {
  const chosen = site && site.trim().length > 0 ? site : null;
  const pool = filterBySite(employees, chosen);
  const planPool = filterBySite(plans, chosen);
  const candidatePool = filterBySite(candidates, chosen);

  const inForce = planInForce(planPool, period.end);
  const rowMap = new Map<string, PlanRow>();

  const ensure = (key: string, siteName: string, designation: string): PlanRow => {
    let row = rowMap.get(key);
    if (!row) {
      row = {
        key,
        site: siteOf(siteName),
        designation: displayDesignation(designation),
        planned: 0,
        actual: 0,
        variance: 0,
        pipeline: 0,
        projectedGap: 0,
      };
      rowMap.set(key, row);
    }
    return row;
  };

  for (const [key, entry] of inForce) {
    ensure(key, entry.site, entry.designation).planned = entry.planned;
  }

  for (const e of pool) {
    if (!activeOn(e, period.end)) continue;
    const designation = e.designation ?? "";
    ensure(planKey(e.site ?? "", designation), e.site ?? "", designation).actual += 1;
  }

  for (const c of candidatePool) {
    if (!isPipelineStatus(c.status)) continue;
    ensure(planKey(c.site, c.designation), c.site, c.designation).pipeline += 1;
  }

  for (const row of rowMap.values()) {
    row.variance = row.actual - row.planned;
    row.projectedGap = row.planned - row.actual - row.pipeline;
  }

  const sites = [...new Set([...rowMap.values()].map((r) => r.site))].sort((a, b) =>
    a.localeCompare(b),
  );

  const groups: SiteGroup[] = sites.map((s) => {
    const rows = [...rowMap.values()]
      .filter((r) => r.site === s)
      .sort((a, b) => a.designation.localeCompare(b.designation));
    const subtotal = emptyTotals();
    for (const r of rows) addTo(subtotal, r);
    return { site: s, rows, subtotal };
  });

  const totals = emptyTotals();
  let unfilled = 0;
  let surplus = 0;
  for (const g of groups) {
    addTo(totals, g.subtotal);
    for (const r of g.rows) {
      if (r.projectedGap > 0) unfilled += r.projectedGap;
      if (r.projectedGap < 0) surplus += -r.projectedGap;
    }
  }

  return {
    period,
    site: chosen,
    hasPlan: inForce.size > 0,
    groups,
    totals,
    stats: { ...totals, unfilled, surplus },
    bySite: groups.map((g) => ({
      site: g.site,
      planned: g.subtotal.planned,
      actual: g.subtotal.actual,
      pipeline: g.subtotal.pipeline,
    })),
    pipelineByStatus: pipelineCounts(candidatePool),
    pipeline: pipelineRows(candidatePool, period),
    engaged: engagedRows(candidatePool, pool, period),
  };
}

export function formatSigned(v: number): string {
  return v > 0 ? `+${v}` : String(v);
}

/** A projected gap reads as "short" when positive and "surplus" when negative. */
export function describeGap(v: number): string {
  if (v > 0) return `${v} short`;
  if (v < 0) return `${-v} surplus`;
  return "On plan";
}
