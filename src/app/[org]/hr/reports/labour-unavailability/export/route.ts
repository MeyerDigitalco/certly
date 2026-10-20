import { requireTenant } from "@/lib/tenant";
import { parsePeriod, periodKey } from "@/lib/hr/operations";
import { getAbsences, getEmployeesForReports } from "@/lib/reports/data";
import { buildWorkbook, xlsxResponse, type SheetColumn, type SheetSpec } from "@/lib/reports/excel";
import {
  AVAILABILITY_NOTE,
  PLANNED_NOTE,
  REPEAT_MIN_SPELLS,
  REPEAT_WINDOW_DAYS,
  buildLabourUnavailability,
} from "@/lib/reports/labour-unavailability";

export const dynamic = "force-dynamic";

const DAYS = "0.#";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ org: string }> },
) {
  const { org: slug } = await params;
  const ctx = await requireTenant(slug);
  const url = new URL(req.url);
  const period = parsePeriod(url.searchParams.get("period"));
  const site = (url.searchParams.get("site") ?? "").trim();

  const [employees, absences] = await Promise.all([
    getEmployeesForReports(ctx.org.id),
    getAbsences(ctx.org.id),
  ]);
  const report = buildLabourUnavailability(employees, absences, period, site);
  const {
    stats,
    sites,
    byReason,
    plannedSubtotal,
    unplannedSubtotal,
    grandTotal,
    bySite,
    bySiteTotal,
    trend,
    repeat,
    spells,
  } = report;
  const scope = site ? `Site: ${site}` : "All sites";
  const logPath = `/${slug}/hr/reports/labour-unavailability/log`;

  const summary: SheetSpec = {
    name: "Summary",
    title: `Labour unavailability, ${period.label}`,
    subtitle: scope,
    columns: [
      { header: "Measure", key: "label", width: 44 },
      { header: "Value", key: "value", width: 16, align: "right" },
    ],
    rows: [
      { label: `People in service on ${period.end}`, value: stats.inService },
      { label: "Calendar days in the month", value: stats.calendarDays },
      { label: "Available man-days", value: stats.availableManDays },
      { label: "Days lost", value: stats.daysLost },
      { label: "Availability %", value: stats.availabilityPct },
      { label: "Planned days lost", value: stats.plannedDaysLost },
      { label: "Unplanned days lost", value: stats.unplannedDaysLost },
      { label: "Absent without leave days", value: stats.awolDays },
      { label: "Spells touching the month", value: stats.spellCount },
    ],
    notes: [
      AVAILABILITY_NOTE,
      PLANNED_NOTE,
      "People who left on or before month end are not in service and their absences are not counted.",
      `Absences are captured on the absence log at ${logPath}.`,
    ],
  };

  const siteColumns: SheetColumn[] = sites.map((s, i) => ({
    header: s,
    key: `site_${i}`,
    width: 14,
    numFmt: DAYS,
  }));
  const siteCells = (values: number[]): Record<string, number> =>
    Object.fromEntries(values.map((v, i) => [`site_${i}`, v]));

  const reasonSheet: SheetSpec = {
    name: "By reason",
    title: `Days lost by reason, ${period.label}`,
    subtitle: scope,
    columns: [
      { header: "Reason", key: "reason", width: 30 },
      { header: "Class", key: "cls", width: 12 },
      ...siteColumns,
      { header: "Total", key: "total", width: 12, numFmt: DAYS },
    ],
    rows: [
      ...byReason
        .filter((r) => r.planned)
        .map((r) => ({ reason: r.label, cls: "Planned", ...siteCells(r.bySite), total: r.total })),
      { reason: "Planned subtotal", cls: "", ...siteCells(plannedSubtotal.bySite), total: plannedSubtotal.total },
      ...byReason
        .filter((r) => !r.planned)
        .map((r) => ({ reason: r.label, cls: "Unplanned", ...siteCells(r.bySite), total: r.total })),
      {
        reason: "Unplanned subtotal",
        cls: "",
        ...siteCells(unplannedSubtotal.bySite),
        total: unplannedSubtotal.total,
      },
    ],
    totals: { reason: "Total days lost", cls: "", ...siteCells(grandTotal.bySite), total: grandTotal.total },
    notes: [
      "Calendar days of absence inside the month. A half day counts 0.5. Every reason is listed, including those with no days, so the sheet keeps the same shape month to month.",
      sites.length === 0 ? `Nobody was in service on ${period.end}, so there are no site columns.` : "",
    ].filter(Boolean),
  };

  const siteSheet: SheetSpec = {
    name: "By site",
    title: `Days lost by site, ${period.label}`,
    subtitle: scope,
    columns: [
      { header: "Site", key: "site", width: 24 },
      { header: "In service", key: "inService", width: 12, numFmt: "0" },
      { header: "Available man-days", key: "availableManDays", width: 16, numFmt: "0" },
      { header: "Planned", key: "planned", width: 12, numFmt: DAYS },
      { header: "Unplanned", key: "unplanned", width: 12, numFmt: DAYS },
      { header: "Days lost", key: "total", width: 12, numFmt: DAYS },
      { header: "Availability %", key: "availabilityPct", width: 14, numFmt: "0.0" },
    ],
    rows: bySite.map((s) => ({
      site: s.site,
      inService: s.inService,
      availableManDays: s.availableManDays,
      planned: s.planned,
      unplanned: s.unplanned,
      total: s.total,
      availabilityPct: s.availabilityPct,
    })),
    totals: {
      site: "Total",
      inService: bySiteTotal.inService,
      availableManDays: bySiteTotal.availableManDays,
      planned: bySiteTotal.planned,
      unplanned: bySiteTotal.unplanned,
      total: bySiteTotal.total,
      availabilityPct: bySiteTotal.availabilityPct,
    },
    notes: ["These are the numbers behind the Days lost by site chart on screen."],
  };

  const spellsSheet: SheetSpec = {
    name: "Spells",
    title: `Spells touching ${period.label}`,
    subtitle: scope,
    columns: [
      { header: "Surname", key: "surname", width: 20 },
      { header: "Names", key: "names", width: 24 },
      { header: "Designation", key: "designation", width: 24 },
      { header: "Site", key: "site", width: 18 },
      { header: "First day", key: "firstDay", width: 12 },
      { header: "Last day", key: "lastDay", width: 12 },
      { header: "Half day", key: "halfDay", width: 10 },
      { header: "Days in period", key: "daysInPeriod", width: 14, numFmt: DAYS },
      { header: "Reason", key: "reason", width: 26 },
      { header: "Class", key: "cls", width: 12 },
      { header: "Notes", key: "notes", width: 40 },
    ],
    rows: spells.map((s) => ({
      surname: s.surname,
      names: s.names,
      designation: s.designation,
      site: s.site,
      firstDay: s.firstDay,
      lastDay: s.lastDay,
      halfDay: s.halfDay ? "Yes" : "",
      daysInPeriod: s.daysInPeriod,
      reason: s.reasonLabel,
      cls: s.planned ? "Planned" : "Unplanned",
      notes: s.notes,
    })),
    totals: { surname: "Total", daysInPeriod: stats.daysLost },
    notes:
      spells.length === 0
        ? [`No absence touched ${period.label}${site ? ` at ${site}` : ""}. Spells are captured on the absence log at ${logPath}.`]
        : ["Days in period counts only the days of each spell that fall inside the month."],
  };

  const repeatSheet: SheetSpec = {
    name: "Repeat unplanned absence",
    title: "Repeat unplanned absence",
    subtitle: `${scope}. ${REPEAT_MIN_SPELLS} or more unplanned spells in the ${REPEAT_WINDOW_DAYS} days ending ${period.end}.`,
    columns: [
      { header: "Surname", key: "surname", width: 20 },
      { header: "Names", key: "names", width: 24 },
      { header: "Designation", key: "designation", width: 24 },
      { header: "Site", key: "site", width: 18 },
      { header: "Unplanned spells", key: "spells", width: 16, numFmt: "0" },
      { header: "Days in window", key: "days", width: 14, numFmt: DAYS },
    ],
    rows: repeat.map((r) => ({
      surname: r.surname,
      names: r.names,
      designation: r.designation,
      site: r.site,
      spells: r.spells,
      days: r.days,
    })),
    notes: [
      repeat.length === 0
        ? `Nobody had ${REPEAT_MIN_SPELLS} or more unplanned spells in the ${REPEAT_WINDOW_DAYS} days ending ${period.end}.`
        : "A pattern to discuss with the person, not a verdict. Only people in service at month end are listed.",
    ],
  };

  const trendSheet: SheetSpec = {
    name: "Six month trend",
    title: `Six months ending ${period.label}`,
    subtitle: scope,
    columns: [
      { header: "Month", key: "month", width: 18 },
      { header: "In service", key: "inService", width: 12, numFmt: "0" },
      { header: "Available man-days", key: "availableManDays", width: 16, numFmt: "0" },
      { header: "Days lost", key: "daysLost", width: 12, numFmt: DAYS },
      { header: "Unplanned days lost", key: "unplannedDaysLost", width: 16, numFmt: DAYS },
      { header: "AWOL days", key: "awolDays", width: 12, numFmt: DAYS },
      { header: "Availability %", key: "availabilityPct", width: 14, numFmt: "0.0" },
    ],
    rows: trend.map((m) => ({
      month: m.label,
      inService: m.inService,
      availableManDays: m.availableManDays,
      daysLost: m.daysLost,
      unplannedDaysLost: m.unplannedDaysLost,
      awolDays: m.awolDays,
      availabilityPct: m.availabilityPct,
    })),
    notes: [
      "These are the numbers behind the six month chart on screen. Each month counts the people in service at its own month end.",
    ],
  };

  const workbook = await buildWorkbook({
    organisation: ctx.org.name,
    period: period.label,
    generatedBy: ctx.userEmail,
    sheets: [summary, reasonSheet, siteSheet, spellsSheet, repeatSheet, trendSheet],
  });

  return xlsxResponse(
    workbook,
    `certly-labour-unavailability-${slug}-${periodKey(period)}.xlsx`,
  );
}
