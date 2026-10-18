import { requireTenant } from "@/lib/tenant";
import { parsePeriod, periodKey } from "@/lib/hr/operations";
import { getEmployeesForReports, getLabourPlans } from "@/lib/reports/data";
import { buildWorkbook, xlsxResponse, type SheetSpec } from "@/lib/reports/excel";
import {
  buildStaffMovement,
  formatPct,
  UNCLASSIFIED_LABEL,
} from "@/lib/reports/staff-movement";

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

  const [employees, plans] = await Promise.all([
    getEmployeesForReports(ctx.org.id),
    getLabourPlans(ctx.org.id),
  ]);

  const report = buildStaffMovement(employees, plans, period, site);
  const { kpis, matrix, planVsActual, trend, leavers } = report;
  const scope = site ? `Site: ${site}` : "All sites";

  const summary: SheetSpec = {
    name: "Summary",
    title: "Staff movement summary",
    subtitle: scope,
    columns: [
      { header: "Measure", key: "label", width: 36 },
      { header: "Value", key: "value", width: 16, align: "right" },
    ],
    rows: [
      { label: `Headcount at start (${period.start})`, value: kpis.startHeadcount },
      { label: "Joiners in the month", value: kpis.joiners },
      { label: "Leavers in the month", value: kpis.leavers },
      { label: "No fault terminations", value: kpis.noFault },
      { label: "Fault terminations", value: kpis.fault },
      ...(kpis.unclassified > 0
        ? [{ label: `Terminations, ${UNCLASSIFIED_LABEL.toLowerCase()}`, value: kpis.unclassified }]
        : []),
      { label: `Headcount at end (${period.end})`, value: kpis.endHeadcount },
      { label: "Turnover %", value: kpis.turnoverPct },
      { label: "Planned positions in force", value: planVsActual.totals.planned },
      { label: "Variance to plan", value: planVsActual.totals.variance },
    ],
    notes: [
      `Headcount at start counts everyone engaged before ${period.start} whose last day, if any, is on or after ${period.start}. Headcount at end counts everyone engaged on or before ${period.end} whose last day, if any, is after ${period.end}.`,
      "Joiners are people whose start date falls in the month. Leavers are people whose last day falls in the month, including the last day itself.",
      "Turnover % is leavers divided by the average of the start and end headcount, times 100, rounded to one decimal. It is 0 when there is no headcount.",
      "No fault: deceased, retirement, medical incapacity, fixed term or limited duration contract ended, retrenchment. Fault: resignation, dismissal, abscondment.",
    ],
  };

  const siteCols = matrix.sites.map((s, i) => ({
    header: s,
    key: `s${i}`,
    width: Math.max(10, Math.min(24, s.length + 2)),
    numFmt: "0",
    align: "right" as const,
  }));
  const siteCells = (values: number[]) =>
    Object.fromEntries(values.map((v, i) => [`s${i}`, v]));

  const terminationRows: SheetSpec["rows"] = [];
  for (const g of matrix.groups) {
    for (const r of g.rows) {
      terminationRows.push({ reason: r.label, cls: g.label, ...siteCells(r.bySite), total: r.total });
    }
    terminationRows.push({
      reason: `${g.label} subtotal`,
      cls: g.label,
      ...siteCells(g.subtotal.bySite),
      total: g.subtotal.total,
    });
  }
  if (matrix.unclassified.total > 0) {
    terminationRows.push({
      reason: UNCLASSIFIED_LABEL,
      cls: "Unclassified",
      ...siteCells(matrix.unclassified.bySite),
      total: matrix.unclassified.total,
    });
  }

  const terminations: SheetSpec = {
    name: "Terminations",
    title: "Terminations by reason and site",
    subtitle: scope,
    columns: [
      { header: "Reason", key: "reason", width: 44 },
      { header: "Class", key: "cls", width: 12 },
      ...siteCols,
      { header: "Total", key: "total", width: 10, numFmt: "0", align: "right" },
    ],
    rows: terminationRows,
    totals: { reason: "Total terminations", cls: "", ...siteCells(matrix.grand.bySite), total: matrix.grand.total },
    notes:
      matrix.grand.total === 0
        ? [`No terminations were recorded for ${period.label}. Record a last day and reason on the employee page under Leaving.`]
        : undefined,
  };

  const planSheet: SheetSpec = {
    name: "Plan vs actual",
    title: "Approved plan against actual headcount",
    subtitle: `${scope}. Plan in force on ${period.end}. Actual is people in service on ${period.end}.`,
    columns: [
      { header: "Site", key: "site", width: 24 },
      { header: "Plan", key: "planned", width: 10, numFmt: "0" },
      { header: "Actual", key: "actual", width: 10, numFmt: "0" },
      { header: "Variance", key: "variance", width: 10, numFmt: "+0;-0;0" },
      { header: "Variance %", key: "variancePct", width: 12, align: "right" },
    ],
    rows: planVsActual.rows.map((r) => ({
      site: r.site,
      planned: r.planned,
      actual: r.actual,
      variance: r.variance,
      variancePct: formatPct(r.variancePct),
    })),
    totals: {
      site: "Total",
      planned: planVsActual.totals.planned,
      actual: planVsActual.totals.actual,
      variance: planVsActual.totals.variance,
      variancePct: formatPct(planVsActual.totals.variancePct),
    },
    notes: planVsActual.hasPlan
      ? ["Variance is actual minus plan. Variance % is variance over plan; n/a where the site has no planned positions."]
      : [`No labour plan is in force for ${period.label}. Set the approved positions per site and designation at /${slug}/hr/reports/labour-plan/plan.`],
  };

  const leaversSheet: SheetSpec = {
    name: "Leavers",
    title: "Leavers",
    subtitle: `${scope}. Last day in ${period.label}.`,
    columns: [
      { header: "Surname", key: "surname", width: 20 },
      { header: "Names", key: "names", width: 24 },
      { header: "Designation", key: "designation", width: 24 },
      { header: "Site", key: "site", width: 18 },
      { header: "Last day", key: "lastDay", width: 12 },
      { header: "Reason", key: "reason", width: 40 },
      { header: "Class", key: "cls", width: 12 },
    ],
    rows: leavers.map((l) => ({
      surname: l.surname,
      names: l.names,
      designation: l.designation,
      site: l.site,
      lastDay: l.lastDay,
      reason: l.reasonLabel,
      cls: l.clsLabel,
    })),
    notes: leavers.length === 0 ? [`Nobody left in ${period.label}${site ? ` at ${site}` : ""}.`] : undefined,
  };

  const trendSheet: SheetSpec = {
    name: "Six month trend",
    title: "Movement by month, last six months",
    subtitle: scope,
    columns: [
      { header: "Month", key: "month", width: 18 },
      { header: "No fault", key: "noFault", width: 10, numFmt: "0" },
      { header: "Fault", key: "fault", width: 10, numFmt: "0" },
      { header: "Total leavers", key: "leavers", width: 12, numFmt: "0" },
      { header: "Joiners", key: "joiners", width: 10, numFmt: "0" },
    ],
    rows: trend.map((m) => ({
      month: m.period.label,
      noFault: m.noFault,
      fault: m.fault,
      leavers: m.leavers,
      joiners: m.joiners,
    })),
    totals: {
      month: "Total",
      noFault: trend.reduce((a, m) => a + m.noFault, 0),
      fault: trend.reduce((a, m) => a + m.fault, 0),
      leavers: trend.reduce((a, m) => a + m.leavers, 0),
      joiners: trend.reduce((a, m) => a + m.joiners, 0),
    },
    notes: ["Total leavers includes terminations with no reason recorded, so it can exceed no fault plus fault."],
  };

  const workbook = await buildWorkbook({
    organisation: ctx.org.name,
    period: period.label,
    generatedBy: ctx.userEmail,
    sheets: [summary, terminations, planSheet, leaversSheet, trendSheet],
  });

  return xlsxResponse(
    workbook,
    `certly-staff-movement-${slug}-${periodKey(period)}.xlsx`,
  );
}
