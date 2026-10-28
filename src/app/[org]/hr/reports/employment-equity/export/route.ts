import { requireTenant } from "@/lib/tenant";
import { isAdmin } from "@/lib/auth/roles";
import { parsePeriod, periodKey } from "@/lib/hr/operations";
import { getEmployeesForReports } from "@/lib/reports/data";
import { buildWorkbook, xlsxResponse, type SheetColumn, type SheetSpec } from "@/lib/reports/excel";
import {
  buildEmploymentEquity,
  EE_COLUMNS,
  EE_MISSING_LABELS,
  type EEMatrix,
} from "@/lib/reports/employment-equity";
import {
  disabilityOptions,
  genderOptions,
  occupationalLevelOptions,
  populationGroupOptions,
} from "@/lib/reports/inline";

export const dynamic = "force-dynamic";

const POPIA_NOTE =
  "Population group and disability are the person's own EEA1 declaration. Certly never infers or defaults them.";

function labelOf(options: Array<{ value: string; label: string }>, value: string | null): string {
  if (!value) return "";
  return options.find((o) => o.value === value)?.label ?? value;
}

function matrixColumns(): SheetColumn[] {
  return [
    { header: "Occupational level", key: "level", width: 44 },
    ...EE_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: 11, numFmt: "0" })),
    { header: "Total", key: "total", width: 9, numFmt: "0" },
  ];
}

function matrixSheet(name: string, title: string, subtitle: string, m: EEMatrix, notes: string[]): SheetSpec {
  const body = m.rows.filter((r) => r.key !== "total");
  return {
    name,
    title,
    subtitle,
    columns: matrixColumns(),
    rows: body.map((r) => ({ level: r.label, ...r.cells, total: r.total })),
    totals: { level: "Total", ...m.totals.cells, total: m.totals.total },
    notes,
  };
}

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
  const report = buildEmploymentEquity(employees, period, site);
  const { year, headcount, designated, completeness, byGroup } = report;
  const scope = site ? `Site: ${site}` : "All sites";

  const profile = matrixSheet(
    "Workforce profile",
    "Workforce profile (EEA2 section B)",
    `${scope}. People in service on ${period.end}.`,
    report.profile,
    [
      "Foreign nationals are counted only in the foreign national columns, as on form EEA2. Values are the employees' own EEA1 declarations.",
      "Male not declared and Female not declared hold South Africans with no population group on record. Not declared holds people with no gender on record. Level not set holds people with no occupational level on record.",
      ...(site ? ["The EEA2 is per employer, not per site. Export with all sites for the submission figures."] : []),
    ],
  );

  const disabled = matrixSheet(
    "Disability profile",
    "Persons with disabilities (EEA2 section B)",
    `${scope}. People in service on ${period.end} who declared a disability.`,
    report.profileDisabled,
    [
      POPIA_NOTE,
      ...(completeness.missingDisability > 0
        ? [`${completeness.missingDisability} people in service have no disability declaration on record and are not counted here.`]
        : []),
    ],
  );

  const recruits = matrixSheet(
    "Recruits",
    "Recruits (EEA2 section C)",
    `${scope}. Start dates in the reporting year ${year.label}.`,
    report.recruits,
    ["Recruits are counted by the start date on the employee record. Promotions are not tracked in Certly and are not reported."],
  );

  const terminations = matrixSheet(
    "Terminations",
    "Terminations (EEA2 section C)",
    `${scope}. Last days of service in the reporting year ${year.label}.`,
    report.terminations,
    ["Terminations are counted by the last day of service recorded on the employee page under Leaving."],
  );

  const completenessSheet: SheetSpec = {
    name: "Completeness",
    title: "EEA1 declarations outstanding",
    subtitle: `${scope}. People in service on ${period.end} with at least one field blank.`,
    columns: [
      { header: "Surname", key: "surname", width: 20 },
      { header: "Names", key: "names", width: 24 },
      { header: "Designation", key: "designation", width: 24 },
      { header: "Site", key: "site", width: 18 },
      { header: "Missing", key: "missing", width: 40 },
      { header: "Gender", key: "gender", width: 10 },
      { header: "Population group", key: "group", width: 14 },
      { header: "Disability", key: "disability", width: 10 },
      { header: "Occupational level", key: "level", width: 24 },
      { header: "Declared on", key: "declaredAt", width: 13 },
    ],
    rows: completeness.people.map((p) => ({
      surname: p.surname,
      names: p.names,
      designation: p.designation,
      site: p.site,
      missing: p.missing.map((m) => EE_MISSING_LABELS[m]).join(", "),
      gender: labelOf(genderOptions(), p.gender),
      group: labelOf(populationGroupOptions(), p.populationGroup),
      disability: labelOf(disabilityOptions(), p.disability === true ? "yes" : p.disability === false ? "no" : null),
      level: labelOf(occupationalLevelOptions(), p.occupationalLevel),
      declaredAt: p.eeDeclaredAt ?? "",
    })),
    notes: [
      POPIA_NOTE,
      completeness.people.length === 0
        ? "Everyone in service has a full EEA1 declaration on record."
        : "Capture the declaration on the employee form under Employment equity declaration, or on the Employment equity report page.",
      "Foreign nationals are not flagged for a missing population group; the EEA2 counts them separately.",
    ],
  };

  const summary: SheetSpec = {
    name: "Summary",
    title: "Employment equity summary",
    subtitle: scope,
    columns: [
      { header: "Measure", key: "label", width: 40 },
      { header: "Value", key: "value", width: 24, align: "right" },
    ],
    rows: [
      { label: `People in service on ${period.end}`, value: headcount },
      { label: `Designated employer (${report.threshold} or more)`, value: designated ? "Yes" : "No" },
      { label: "EE reporting year", value: year.label },
      { label: "EE reference number", value: ctx.org.ee_reference ?? "" },
      { label: "African", value: byGroup.african },
      { label: "Coloured", value: byGroup.coloured },
      { label: "Indian", value: byGroup.indian },
      { label: "White", value: byGroup.white },
      { label: "Not declared", value: byGroup.notDeclared },
      { label: "Foreign nationals", value: byGroup.foreign },
      { label: "Persons with disabilities", value: report.profileDisabled.totals.total },
      { label: `Recruits in ${year.label}`, value: report.recruits.totals.total },
      { label: `Terminations in ${year.label}`, value: report.terminations.totals.total },
      { label: "People with a declaration outstanding", value: completeness.people.length },
    ],
    notes: [
      "Designation is by headcount only. A collective agreement or a turnover threshold can also make an employer designated.",
      "An EEA2 for a designated employer is due by 15 January after the reporting year closes.",
      POPIA_NOTE,
    ],
  };

  const workbook = await buildWorkbook({
    organisation: ctx.org.name,
    period: period.label,
    generatedBy: ctx.userEmail,
    sheets: [profile, disabled, recruits, terminations, completenessSheet, summary],
  });

  return xlsxResponse(workbook, `certly-employment-equity-${slug}-${periodKey(period)}.xlsx`);
}
