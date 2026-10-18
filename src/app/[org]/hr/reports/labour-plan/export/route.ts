import { requireTenant } from "@/lib/tenant";
import { parsePeriod, periodKey } from "@/lib/hr/operations";
import {
  getEmployeesForReports,
  getLabourPlans,
  getOnboardingCandidates,
} from "@/lib/reports/data";
import { buildWorkbook, xlsxResponse, type SheetSpec } from "@/lib/reports/excel";
import { buildLabourPlan } from "@/lib/reports/labour-plan";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ org: string }> },
) {
  const { org: slug } = await params;
  const ctx = await requireTenant(slug);
  const url = new URL(req.url);
  const period = parsePeriod(url.searchParams.get("period"));
  const site = (url.searchParams.get("site") ?? "").trim();

  const [employees, plans, candidates] = await Promise.all([
    getEmployeesForReports(ctx.org.id),
    getLabourPlans(ctx.org.id),
    getOnboardingCandidates(ctx.org.id),
  ]);

  const report = buildLabourPlan(employees, plans, candidates, period, site);
  const { groups, totals, stats, bySite, pipelineByStatus, pipeline, engaged } = report;
  const scope = site ? `Site: ${site}` : "All sites";

  const planRows: SheetSpec["rows"] = [];
  for (const g of groups) {
    for (const r of g.rows) {
      planRows.push({
        site: g.site,
        designation: r.designation,
        planned: r.planned,
        actual: r.actual,
        variance: r.variance,
        pipeline: r.pipeline,
        gap: r.projectedGap,
      });
    }
    planRows.push({
      site: `${g.site} subtotal`,
      designation: "",
      planned: g.subtotal.planned,
      actual: g.subtotal.actual,
      variance: g.subtotal.variance,
      pipeline: g.subtotal.pipeline,
      gap: g.subtotal.projectedGap,
    });
  }

  const planSheet: SheetSpec = {
    name: "Plan vs actual",
    title: "Approved plan against actual headcount by site and designation",
    subtitle: `${scope}. Plan in force on ${period.end}. Actual is people in service on ${period.end}.`,
    columns: [
      { header: "Site", key: "site", width: 24 },
      { header: "Designation", key: "designation", width: 28 },
      { header: "Planned", key: "planned", width: 10, numFmt: "0" },
      { header: "Actual", key: "actual", width: 10, numFmt: "0" },
      { header: "Variance", key: "variance", width: 10, numFmt: "+0;-0;0" },
      { header: "In pipeline", key: "pipeline", width: 12, numFmt: "0" },
      { header: "Projected gap", key: "gap", width: 14, numFmt: "0;-0;0" },
    ],
    rows: planRows,
    totals: {
      site: "Total",
      designation: "",
      planned: totals.planned,
      actual: totals.actual,
      variance: totals.variance,
      pipeline: totals.pipeline,
      gap: totals.projectedGap,
    },
    notes: [
      "Variance is actual minus planned. Projected gap is planned minus actual minus candidates in the pipeline. A negative projected gap is a surplus.",
      "Site and designation are matched to the plan without regard to case or spacing. People with no site are shown under Unassigned.",
      ...(report.hasPlan
        ? []
        : [`No labour plan is in force for ${period.label}. Set the approved positions per site and designation at /${slug}/hr/reports/labour-plan/plan.`]),
    ],
  };

  const pipelineSheet: SheetSpec = {
    name: "Pipeline",
    title: "Onboarding pipeline",
    subtitle: `${scope}. Candidates in screening, medical, TEBA, training or ready to engage.`,
    columns: [
      { header: "Surname", key: "surname", width: 20 },
      { header: "Names", key: "names", width: 24 },
      { header: "Designation", key: "designation", width: 24 },
      { header: "Site", key: "site", width: 18 },
      { header: "Stage", key: "stage", width: 16 },
      { header: "Screening", key: "screening", width: 12 },
      { header: "Medical", key: "medical", width: 12 },
      { header: "Medical status", key: "medicalStatus", width: 14 },
      { header: "TEBA", key: "teba", width: 8 },
      { header: "Training start", key: "trainingStart", width: 14 },
      { header: "Expected passout", key: "passout", width: 16 },
      { header: "Days in pipeline", key: "days", width: 16, numFmt: "0" },
    ],
    rows: pipeline.map((c) => ({
      surname: c.surname,
      names: c.names,
      designation: c.designation,
      site: c.site,
      stage: c.statusLabel,
      screening: c.screeningDate,
      medical: c.medicalDate,
      medicalStatus: c.medicalStatusLabel,
      teba: c.tebaDone ? "Done" : "",
      trainingStart: c.trainingStart,
      passout: c.expectedPassout,
      days: c.daysInPipeline,
    })),
    notes: [
      `Days in pipeline counts from the day the candidate was added to ${period.end}. Screening and medical show the completed date, or the booked date while still pending.`,
      ...(pipeline.length === 0
        ? [`No candidates are in the pipeline${site ? ` at ${site}` : ""}. Add them at /${slug}/hr/reports/labour-plan/tracker.`]
        : []),
    ],
  };

  const engagedSheet: SheetSpec = {
    name: "Engaged this month",
    title: "Engaged this month",
    subtitle: `${scope}. Candidates moved onto the register in ${period.label}.`,
    columns: [
      { header: "Surname", key: "surname", width: 20 },
      { header: "Names", key: "names", width: 24 },
      { header: "Designation", key: "designation", width: 24 },
      { header: "Site", key: "site", width: 18 },
      { header: "Engaged on", key: "engagedOn", width: 12 },
    ],
    rows: engaged.map((c) => ({
      surname: c.surname,
      names: c.names,
      designation: c.designation,
      site: c.site,
      engagedOn: c.engagedOn,
    })),
    notes:
      engaged.length === 0
        ? [`Nobody was engaged from the tracker in ${period.label}${site ? ` at ${site}` : ""}.`]
        : undefined,
  };

  const summary: SheetSpec = {
    name: "Summary",
    title: "Labour plan summary",
    subtitle: scope,
    columns: [
      { header: "Measure", key: "label", width: 40 },
      { header: "Value", key: "value", width: 16, align: "right" },
    ],
    rows: [
      { label: `Planned positions in force on ${period.end}`, value: stats.planned },
      { label: `People in service on ${period.end}`, value: stats.actual },
      { label: "Variance (actual minus planned)", value: stats.variance },
      { label: "Candidates in pipeline", value: stats.pipeline },
      { label: "Projected gap (planned minus actual minus pipeline)", value: stats.projectedGap },
      { label: "Unfilled after pipeline (positions short)", value: stats.unfilled },
      { label: "Surplus after pipeline (positions over)", value: stats.surplus },
      { label: `Engaged from the tracker in ${period.label}`, value: engaged.length },
      ...pipelineByStatus.map((p) => ({ label: `Pipeline: ${p.label}`, value: p.count })),
      ...bySite.flatMap((s) => [
        { label: `${s.site}: planned`, value: s.planned },
        { label: `${s.site}: actual`, value: s.actual },
        { label: `${s.site}: pipeline`, value: s.pipeline },
      ]),
    ],
    notes: [
      "Unfilled adds up the projected gap of every position that is short. Surplus adds up every position that is over. The two can both be non zero because a surplus of one designation does not fill a shortage in another.",
      "The per site rows are the numbers behind the chart on screen.",
    ],
  };

  const workbook = await buildWorkbook({
    organisation: ctx.org.name,
    period: period.label,
    generatedBy: ctx.userEmail,
    sheets: [planSheet, pipelineSheet, engagedSheet, summary],
  });

  return xlsxResponse(workbook, `certly-labour-plan-${slug}-${periodKey(period)}.xlsx`);
}
