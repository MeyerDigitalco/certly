import { requireTenant } from "@/lib/tenant";
import { isAdmin } from "@/lib/auth/roles";
import { parsePeriod, periodKey } from "@/lib/hr/operations";
import { getEmployeesForReports } from "@/lib/reports/data";
import { buildWorkbook, xlsxResponse, type SheetSpec } from "@/lib/reports/excel";
import {
  buildFaultTerminations,
  FAULT_REASON_NOTE,
  formatPct,
} from "@/lib/reports/fault-terminations";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ org: string }> },
) {
  const { org: slug } = await params;
  const ctx = await requireTenant(slug);

  // Admin only, same as the register export and the evidence pack. The
  // workbook names individuals alongside their EEA1 declaration.
  if (!isAdmin(ctx.role)) {
    return new Response("Not found", { status: 404 });
  }
  const url = new URL(req.url);
  const period = parsePeriod(url.searchParams.get("period"));
  const site = (url.searchParams.get("site") ?? "").trim();

  const employees = await getEmployeesForReports(ctx.org.id);
  const report = buildFaultTerminations(employees, period, site);
  const { stats, months, totals, bySite, bySiteTotals, leavers, currentYear, previousYear } = report;
  const scope = site ? `Site: ${site}` : "All sites";
  const ytdLabel = `YTD to ${period.label}`;

  const summary: SheetSpec = {
    name: "Summary",
    title: "Fault terminations year on year",
    subtitle: scope,
    columns: [
      { header: "Measure", key: "label", width: 44 },
      { header: "Value", key: "value", width: 16, align: "right" },
    ],
    rows: [
      { label: `${currentYear} fault terminations, ${ytdLabel}`, value: stats.currentYtd.total },
      { label: `${previousYear} fault terminations, same months`, value: stats.previousSameMonths.total },
      { label: `${previousYear} fault terminations, full year`, value: stats.previousFullYear.total },
      { label: "Change on same months, count", value: stats.change },
      { label: "Change on same months, %", value: formatPct(stats.changePct) },
      { label: `${currentYear} resignations, ${ytdLabel}`, value: stats.currentYtd.resignation },
      { label: `${currentYear} dismissals, ${ytdLabel}`, value: stats.currentYtd.dismissal },
      { label: `${currentYear} abscondments, ${ytdLabel}`, value: stats.currentYtd.abscondment },
    ],
    notes: [
      FAULT_REASON_NOTE,
      `${currentYear} figures count January to ${period.label}. ${previousYear} same months counts January to the same month of ${previousYear}. Change % is n/a when ${previousYear} had no fault terminations in those months.`,
      "A termination is counted in the month of the last day recorded on the employee page under Leaving.",
    ],
  };

  const byMonth: SheetSpec = {
    name: "By month",
    title: `Fault terminations by month, ${previousYear} against ${currentYear}`,
    subtitle: scope,
    columns: [
      { header: "Month", key: "month", width: 14 },
      { header: `${previousYear} total`, key: "previousTotal", width: 12, numFmt: "0" },
      { header: `${currentYear} resignations`, key: "resignation", width: 14, numFmt: "0" },
      { header: `${currentYear} dismissals`, key: "dismissal", width: 14, numFmt: "0" },
      { header: `${currentYear} abscondments`, key: "abscondment", width: 14, numFmt: "0" },
      { header: `${currentYear} total`, key: "currentTotal", width: 12, numFmt: "0" },
      { header: "Change", key: "change", width: 10, numFmt: "+0;-0;0" },
      { header: "Note", key: "note", width: 10 },
    ],
    rows: months.map((m) => ({
      month: m.label,
      previousTotal: m.previousTotal,
      resignation: m.resignation,
      dismissal: m.dismissal,
      abscondment: m.abscondment,
      currentTotal: m.currentTotal,
      change: m.change,
      note: m.toDate ? "to date" : "",
    })),
    totals: {
      month: "Total",
      previousTotal: totals.previousTotal,
      resignation: totals.resignation,
      dismissal: totals.dismissal,
      abscondment: totals.abscondment,
      currentTotal: totals.currentTotal,
      change: totals.change,
      note: ytdLabel,
    },
    notes: [
      `The totals row counts ${previousYear} in full and ${currentYear} ${ytdLabel}. Its change column compares ${currentYear} ${ytdLabel} with the same months of ${previousYear}.`,
      `Months marked "to date" fall after ${period.label} and show whatever is recorded so far.`,
    ],
  };

  const bySiteSheet: SheetSpec = {
    name: "By site",
    title: `Fault terminations by site, ${currentYear} ${ytdLabel}`,
    subtitle: scope,
    columns: [
      { header: "Site", key: "site", width: 24 },
      { header: "Resignations", key: "resignation", width: 14, numFmt: "0" },
      { header: "Dismissals", key: "dismissal", width: 14, numFmt: "0" },
      { header: "Abscondments", key: "abscondment", width: 14, numFmt: "0" },
      { header: "Total", key: "total", width: 10, numFmt: "0" },
    ],
    rows: bySite.map((r) => ({
      site: r.site,
      resignation: r.resignation,
      dismissal: r.dismissal,
      abscondment: r.abscondment,
      total: r.total,
    })),
    totals: {
      site: "Total",
      resignation: bySiteTotals.resignation,
      dismissal: bySiteTotals.dismissal,
      abscondment: bySiteTotals.abscondment,
      total: bySiteTotals.total,
    },
    notes:
      bySite.length === 0
        ? [`No fault terminations recorded for ${currentYear} ${ytdLabel}${site ? ` at ${site}` : ""}.`]
        : ["Sites with no fault terminations in the period are not listed."],
  };

  const leaversSheet: SheetSpec = {
    name: "Fault leavers this month",
    title: "Fault leavers this month",
    subtitle: `${scope}. Last day in ${period.label}.`,
    columns: [
      { header: "Surname", key: "surname", width: 20 },
      { header: "Names", key: "names", width: 24 },
      { header: "Designation", key: "designation", width: 24 },
      { header: "Site", key: "site", width: 18 },
      { header: "Last day", key: "lastDay", width: 12 },
      { header: "Reason", key: "reason", width: 20 },
    ],
    rows: leavers.map((l) => ({
      surname: l.surname,
      names: l.names,
      designation: l.designation,
      site: l.site,
      lastDay: l.lastDay,
      reason: l.reasonLabel,
    })),
    notes:
      leavers.length === 0
        ? [`No fault terminations in ${period.label}${site ? ` at ${site}` : ""}. Record the last day and reason on the employee page under Leaving.`]
        : undefined,
  };

  const workbook = await buildWorkbook({
    organisation: ctx.org.name,
    period: period.label,
    generatedBy: ctx.userEmail,
    sheets: [summary, byMonth, bySiteSheet, leaversSheet],
  });

  return xlsxResponse(
    workbook,
    `certly-fault-terminations-${slug}-${periodKey(period)}.xlsx`,
  );
}
