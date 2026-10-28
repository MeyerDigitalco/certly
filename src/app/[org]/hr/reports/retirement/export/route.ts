import { requireTenant } from "@/lib/tenant";
import { isAdmin } from "@/lib/auth/roles";
import { parsePeriod, periodKey } from "@/lib/hr/operations";
import { getEmployeesForReports } from "@/lib/reports/data";
import { buildWorkbook, xlsxResponse, type SheetSpec } from "@/lib/reports/excel";
import { buildRetirement } from "@/lib/reports/retirement";

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
  const report = buildRetirement(employees, period, ctx.org.default_retirement_age, site);
  const { counts, rows, missingDob, bySite } = report;
  const scope = site ? `Site: ${site}` : "All sites";

  const schedule: SheetSpec = {
    name: "Overdue retirement",
    title: "Overdue retirement",
    subtitle: `${scope}. People in service on ${period.end}.`,
    columns: [
      { header: "Surname", key: "surname", width: 20 },
      { header: "Names", key: "names", width: 24 },
      { header: "ID number", key: "idNumber", width: 16, numFmt: "@", align: "left" },
      { header: "Designation", key: "designation", width: 24 },
      { header: "Site", key: "site", width: 18 },
      { header: "Date of birth", key: "dateOfBirth", width: 13 },
      { header: "Age", key: "age", width: 7, numFmt: "0" },
      { header: "Retirement age", key: "retirementAge", width: 11, numFmt: "0" },
      { header: "Age source", key: "ageSource", width: 12 },
      { header: "Official retirement date", key: "officialDate", width: 14 },
      { header: "Approved retirement date", key: "approvedDate", width: 14 },
      { header: "Status", key: "status", width: 22 },
      { header: "Months", key: "months", width: 20 },
      { header: "Comments", key: "comments", width: 30 },
    ],
    rows: rows.map((r) => ({
      surname: r.surname,
      names: r.names,
      idNumber: r.idNumber,
      designation: r.designation,
      site: r.site,
      dateOfBirth: r.dateOfBirth,
      age: r.age,
      retirementAge: r.retirementAge,
      ageSource: r.ageIsDefault ? "Org default" : "Employee record",
      officialDate: r.officialDate,
      approvedDate: r.approvedDate ?? "",
      status: r.statusLabel,
      months: r.monthsLabel,
      comments: "",
    })),
    notes: [
      "The official retirement date is the last day of the month in which the person reaches retirement age.",
      `Retirement age is ${report.defaultRetirementAge} (the workspace default) unless the employee record sets a different age. Age is as at ${period.end}.`,
      "Overdue: official retirement date has passed and there is no approved extension still in force. On approved extension: official date has passed and an approved retirement date on or after the start of the month is recorded. Retiring this month: official date falls in the month. Due in next 6 months: official date falls in the six months after the month.",
      "Months shows months overdue for overdue people and months remaining for everyone else, counted in whole calendar months.",
      ...(rows.length === 0
        ? [`Nobody in service on ${period.end}${site ? ` at ${site}` : ""} is at or within six months of retirement.`]
        : []),
    ],
  };

  const summary: SheetSpec = {
    name: "Summary",
    title: "Overdue retirement summary",
    subtitle: scope,
    columns: [
      { header: "Measure", key: "label", width: 36 },
      { header: "Value", key: "value", width: 16, align: "right" },
    ],
    rows: [
      { label: "Overdue", value: counts.overdue },
      { label: "On approved extension", value: counts.extended },
      { label: "Retiring this month", value: counts.dueThisMonth },
      { label: `Due in next 6 months (to ${report.windowEnd})`, value: counts.dueSoon },
      { label: "Missing date of birth", value: counts.missingDob },
      { label: `People in service on ${period.end}`, value: counts.assessed + counts.missingDob },
      { label: "Assessed (date of birth recorded)", value: counts.assessed },
    ],
    notes: ["Counts cover people in service on the last day of the month only."],
  };

  const bySiteSheet: SheetSpec = {
    name: "By site",
    title: "Retirement position by site",
    subtitle: scope,
    columns: [
      { header: "Site", key: "site", width: 24 },
      { header: "Overdue", key: "overdue", width: 10, numFmt: "0" },
      { header: "Extended", key: "extended", width: 10, numFmt: "0" },
      { header: "Due in 6 months", key: "dueWithinSix", width: 14, numFmt: "0" },
    ],
    rows: bySite.sites.map((s, i) => ({
      site: s,
      overdue: bySite.overdue[i] ?? 0,
      extended: bySite.extended[i] ?? 0,
      dueWithinSix: bySite.dueWithinSix[i] ?? 0,
    })),
    totals: {
      site: "Total",
      overdue: counts.overdue,
      extended: counts.extended,
      dueWithinSix: counts.dueThisMonth + counts.dueSoon,
    },
    notes: ["Due in 6 months includes people retiring this month."],
  };

  const missing: SheetSpec = {
    name: "Missing date of birth",
    title: "Missing date of birth",
    subtitle: `${scope}. People in service on ${period.end} with no date of birth recorded.`,
    columns: [
      { header: "Surname", key: "surname", width: 20 },
      { header: "Names", key: "names", width: 24 },
      { header: "Designation", key: "designation", width: 24 },
      { header: "Site", key: "site", width: 18 },
    ],
    rows: missingDob.map((m) => ({
      surname: m.surname,
      names: m.names,
      designation: m.designation,
      site: m.site,
    })),
    notes:
      missingDob.length === 0
        ? ["Everyone in service has a date of birth recorded."]
        : ["These people cannot be assessed for retirement. Add the date of birth on the employee form under Service and retirement."],
  };

  const workbook = await buildWorkbook({
    organisation: ctx.org.name,
    period: period.label,
    generatedBy: ctx.userEmail,
    sheets: [schedule, summary, bySiteSheet, missing],
  });

  return xlsxResponse(workbook, `certly-retirement-${slug}-${periodKey(period)}.xlsx`);
}
