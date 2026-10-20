import { requireTenant } from "@/lib/tenant";
import { parsePeriod, periodKey, SETAS } from "@/lib/hr/operations";
import {
  getEmployeesForReports,
  getTrainingDelivered,
  getTrainingPlans,
  getTrainingTypesForReports,
} from "@/lib/reports/data";
import { buildWorkbook, xlsxResponse, type SheetSpec } from "@/lib/reports/excel";
import { buildSkillsDevelopment, DEMO_GROUP_COLUMNS } from "@/lib/reports/skills-development";

export const dynamic = "force-dynamic";

const RANDS = '"R "#,##0.00';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ org: string }> },
) {
  const { org: slug } = await params;
  const ctx = await requireTenant(slug);
  const url = new URL(req.url);
  const period = parsePeriod(url.searchParams.get("period"));
  const site = (url.searchParams.get("site") ?? "").trim();

  const [employees, types, delivered, trainingPlans] = await Promise.all([
    getEmployeesForReports(ctx.org.id),
    getTrainingTypesForReports(ctx.org.id),
    getTrainingDelivered(ctx.org.id),
    getTrainingPlans(ctx.org.id),
  ]);

  const report = buildSkillsDevelopment(employees, types, delivered, trainingPlans, period, site);
  const { year, nextYear, rows, courses, courseTotals, demographics, bbbee, wsp, byCategory, readiness } =
    report;
  const scope = site ? `Site: ${site}` : "All sites";
  const setaLabel = ctx.org.seta
    ? (SETAS.find((s) => s.value === ctx.org.seta)?.label ?? ctx.org.seta)
    : "SETA not set";
  const popia =
    "Population group, gender and disability are the person's own EEA1 declaration as captured in Certly. Certly never infers or defaults them.";

  const byCourse: SheetSpec = {
    name: "ATR by course",
    title: `Annual Training Report ${year.year} by course`,
    subtitle: `${scope}. Training delivered ${year.label}.`,
    columns: [
      { header: "Course", key: "course", width: 32 },
      { header: "Category", key: "category", width: 18 },
      { header: "Provider", key: "provider", width: 24 },
      { header: "NQF level", key: "nqf", width: 10, numFmt: "0" },
      { header: "Accredited", key: "accredited", width: 11 },
      { header: "People trained", key: "people", width: 13, numFmt: "0" },
      { header: "Hours", key: "hours", width: 10, numFmt: "0.0" },
      { header: "Cost", key: "cost", width: 16, numFmt: RANDS },
    ],
    rows: courses.map((c) => ({
      course: c.course,
      category: c.categoryLabel,
      provider: c.provider,
      nqf: c.nqf,
      accredited: c.accredited ? "Yes" : "No",
      people: c.people,
      hours: c.hours,
      cost: c.cost,
    })),
    totals: {
      course: "Total",
      people: courseTotals.people,
      hours: courseTotals.hours,
      cost: courseTotals.cost,
    },
    notes: [
      `SETA: ${setaLabel}. SDL number: ${ctx.org.sdl_number ?? "not set"}. Due ${year.due}.`,
      "Each person is counted once per course. Hours and cost are the course figures times the people trained.",
      ...(courseTotals.hoursComplete && courseTotals.costComplete
        ? []
        : ["Some courses have no hours or no cost on record, so the totals understate the year. See the Summary sheet."]),
      ...(courses.length === 0 ? [`No training that counts for the ATR was recorded in ${year.label}.`] : []),
    ],
  };

  const byPerson: SheetSpec = {
    name: "ATR by person",
    title: `Annual Training Report ${year.year} by person`,
    subtitle: `${scope}. One row per certificate obtained ${year.label}.`,
    columns: [
      { header: "Surname", key: "surname", width: 20 },
      { header: "Names", key: "names", width: 24 },
      { header: "ID number", key: "idNumber", width: 16, numFmt: "@", align: "left" },
      { header: "Designation", key: "designation", width: 22 },
      { header: "Site", key: "site", width: 18 },
      { header: "Course", key: "course", width: 30 },
      { header: "Category", key: "category", width: 18 },
      { header: "Date", key: "date", width: 12 },
      { header: "Hours", key: "hours", width: 9, numFmt: "0.0" },
      { header: "Cost", key: "cost", width: 14, numFmt: RANDS },
      { header: "Population group", key: "group", width: 16 },
      { header: "Gender", key: "gender", width: 10 },
      { header: "Disability", key: "disability", width: 10 },
    ],
    rows: rows.map((r) => ({
      surname: r.surname,
      names: r.names,
      idNumber: r.idNumber,
      designation: r.designation,
      site: r.site,
      course: r.course,
      category: r.categoryLabel,
      date: r.date,
      hours: r.hours,
      cost: r.cost,
      group: r.foreign ? "Foreign national" : labelGroup(r.populationGroup),
      gender: r.gender === "male" ? "Male" : r.gender === "female" ? "Female" : "Not declared",
      disability: r.disability === true ? "Yes" : r.disability === false ? "No" : "Not declared",
    })),
    notes: [popia, "Foreign nationals are identified by the identity document type on the employee record."],
  };

  const demographicsSheet: SheetSpec = {
    name: "ATR demographics",
    title: `People trained ${year.year} by population group and gender`,
    subtitle: `${scope}. Distinct people trained ${year.label}.`,
    columns: [
      { header: "Gender", key: "label", width: 26 },
      ...DEMO_GROUP_COLUMNS.map((c) => ({ header: c.label, key: c.key, width: 14, numFmt: "0" })),
      { header: "Total", key: "total", width: 10, numFmt: "0" },
    ],
    rows: demographics.rows
      .filter((r) => r.key !== "total")
      .map((r) => ({ label: r.label, ...r.cells, total: r.total })),
    totals: (() => {
      const t = demographics.rows.find((r) => r.key === "total");
      return t ? { label: t.label, ...t.cells, total: t.total } : undefined;
    })(),
    notes: [
      popia,
      "Foreign nationals are shown in their own column and not under a population group, as on the EEA2.",
    ],
  };

  const bbbeeSheet: SheetSpec = {
    name: "BBBEE inputs",
    title: `B-BBEE skills development inputs ${year.year}`,
    subtitle: `${scope}. ${year.label}.`,
    columns: [
      { header: "Input", key: "label", width: 44 },
      { header: "Value", key: "value", width: 18, align: "right" },
    ],
    rows: [
      { label: "Total training spend (rands)", value: bbbee.totalSpend },
      { label: "Training spend on black people (rands)", value: bbbee.blackSpend },
      { label: "Black people trained", value: bbbee.blackPeople },
      { label: "Black women trained", value: bbbee.blackWomen },
      { label: "People with disabilities trained", value: bbbee.disabledPeople },
      { label: "Learnerships, apprenticeships and internships", value: bbbee.programmes },
      { label: "Of which black people", value: bbbee.programmesBlack },
    ],
    notes: [
      "Black people means African, Coloured and Indian, as the B-BBEE Act defines the term. Certly does not check citizenship.",
      "Scorecard points depend on the leviable amount and on verified spend, neither of which Certly holds.",
      ...(bbbee.costComplete ? [] : ["Some courses have no cost on record, so spend is understated."]),
      popia,
    ],
  };

  const wspSheet: SheetSpec = {
    name: "WSP next year",
    title: `Workplace Skills Plan ${nextYear.year}`,
    subtitle: `${scope}. Planned training ${nextYear.label}.`,
    columns: [
      { header: "Course", key: "course", width: 32 },
      { header: "Category", key: "category", width: 18 },
      { header: "Site", key: "site", width: 18 },
      { header: "Planned people", key: "people", width: 13, numFmt: "0" },
      { header: "Planned cost", key: "cost", width: 16, numFmt: RANDS },
      { header: "Cost from", key: "costSource", width: 11 },
      { header: `Delivered ${year.year} at site`, key: "delivered", width: 14, numFmt: "0" },
      { header: `Delivered ${year.year} all sites`, key: "deliveredAll", width: 14, numFmt: "0" },
      { header: "Notes", key: "notes", width: 30 },
    ],
    rows: wsp.groups.flatMap((g) =>
      g.rows.map((r) => ({
        course: g.course,
        category: g.categoryLabel,
        site: r.site,
        people: r.plannedPeople,
        cost: r.plannedCost,
        costSource: r.costSource === "plan" ? "Plan row" : r.costSource === "type" ? "Course" : "None",
        delivered: r.deliveredAtSite,
        deliveredAll: g.delivered,
        notes: r.notes,
      })),
    ),
    totals: {
      course: "Total",
      people: wsp.totals.people,
      cost: wsp.totals.cost,
      deliveredAll: courseTotals.people,
    },
    notes: [
      "Cost from Course means the plan row has no cost of its own and the course cost times the planned people is used instead.",
      ...(wsp.groups.length === 0 ? [`No plan rows for SETA year ${nextYear.year}. Capture them in Certly under Skills development, Plan editor.`] : []),
    ],
  };

  const summary: SheetSpec = {
    name: "Summary",
    title: "Skills development summary",
    subtitle: scope,
    columns: [
      { header: "Measure", key: "label", width: 44 },
      { header: "Value", key: "value", width: 22, align: "right" },
    ],
    rows: [
      { label: "SETA", value: setaLabel },
      { label: "SDL number", value: ctx.org.sdl_number ?? "" },
      { label: "SETA year", value: year.label },
      { label: "WSP and ATR due", value: year.due },
      { label: "People trained (distinct)", value: demographics.peopleTrained },
      { label: "Certificates obtained", value: rows.length },
      { label: "Courses delivered", value: courses.length },
      { label: "Training hours", value: courseTotals.hours },
      { label: "Training spend (rands)", value: courseTotals.cost },
      { label: "Foreign nationals trained", value: demographics.foreign },
      { label: "People with disabilities trained", value: demographics.disability },
      { label: `Planned people ${nextYear.year}`, value: wsp.totals.people },
      { label: `Planned cost ${nextYear.year} (rands)`, value: wsp.totals.cost },
      { label: "Courses counting for ATR without hours or cost", value: readiness.typesIncomplete.length },
      { label: "People trained without population group or gender", value: readiness.undeclared.length },
      ...byCategory.categories.map((c, i) => ({
        label: `${c}: trained ${year.year} / planned ${nextYear.year}`,
        value: `${byCategory.trained[i]} / ${byCategory.planned[i]}`,
      })),
    ],
    notes: [
      "The chart on screen plots the per category lines above.",
      ...readiness.typesIncomplete.map(
        (t) => `Course detail missing: ${t.name} (${[t.missingHours ? "hours" : null, t.missingCost ? "cost" : null].filter(Boolean).join(", ")}).`,
      ),
    ],
  };

  const workbook = await buildWorkbook({
    organisation: ctx.org.name,
    period: period.label,
    generatedBy: ctx.userEmail,
    sheets: [byCourse, byPerson, demographicsSheet, bbbeeSheet, wspSheet, summary],
  });

  return xlsxResponse(workbook, `certly-skills-development-${slug}-${periodKey(period)}.xlsx`);
}

function labelGroup(group: string | null): string {
  if (group === "african") return "African";
  if (group === "coloured") return "Coloured";
  if (group === "indian") return "Indian";
  if (group === "white") return "White";
  return "Not declared";
}
