import type { ReportEmployee, TrainingDelivered } from "@/lib/reports/data";
import type { SheetSpec } from "@/lib/reports/excel";
import type { RenewalBuckets, RenewalRow } from "@/lib/hr/queries";
import { COMPANY_DOCUMENT_LABELS } from "@/lib/hr/queries";
import type { AuditEntry } from "@/lib/hr/audit";
import type {
  Absence,
  CompanyDocument,
  RegisterRow,
  Sector,
  TrainingType,
} from "@/lib/types/database";
import { certStatus, statusLabel } from "@/lib/certifications/status";
import { sectorProfile } from "@/lib/sector";
import { idTypeLabel } from "@/lib/validation/identification";
import { activeOn, eeMatrix } from "@/lib/reports/employment-equity";
import {
  ABSENCE_REASONS,
  EE_DESIGNATED_THRESHOLD,
  GENDERS,
  OCCUPATIONAL_LEVEL_SHORT,
  POPULATION_GROUPS,
  TERMINATION_REASONS,
  absenceReasonLabel,
  isForeignNational,
  overlapDays,
  setaYearFor,
  setaYearRange,
  siteOf,
  terminationLabel,
  trainingCategoryLabel,
} from "@/lib/hr/operations";

/**
 * The inspection evidence pack: one workbook an employer hands over when a
 * Department of Employment and Labour inspector, a client SHEQ manager or a
 * SETA auditor says "show me". Everything here is pure over rows already
 * fetched, so the route is a thin fetch and the tests need no database.
 */

export interface EvidenceOrg {
  name: string;
  slug: string;
  sector: Sector | null;
  seta: string | null;
  sdl_number: string | null;
  ee_reference: string | null;
  due_soon_days: number;
}

export interface EvidenceInput {
  asOf: string;
  generatedBy: string;
  generatedOn: string;
  org: EvidenceOrg;
  employees: ReportEmployee[];
  register: RegisterRow[];
  companyDocuments: CompanyDocument[];
  renewals: RenewalBuckets;
  absences: Absence[];
  trainingTypes: TrainingType[];
  trainingDelivered: TrainingDelivered[];
  audit: AuditEntry[];
  /** False when the signed-in user cannot read the audit trail at all. */
  auditReadable: boolean;
}

export const COMPANY_DOCUMENT_WINDOW_DAYS = 30;
export const ACTIVITY_LIMIT = 500;
export const ACTIVITY_WINDOW_DAYS = 90;

export type CompanyDocumentStatus = "Current" | "Due soon" | "Expired" | "No expiry";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** The same calendar day one year earlier, clamped for 29 February. */
export function oneYearBefore(iso: string): string {
  const m = ISO_DATE.exec(iso);
  if (!m) return iso;
  const year = Number(m[1]) - 1;
  const month = Number(m[2]);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(Number(m[3]), lastDay);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** A plain ISO date shifted by whole days, on the calendar. */
export function shiftDays(iso: string, days: number): string {
  const m = ISO_DATE.exec(iso);
  if (!m) return iso;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Inclusive window: from the same day one year before asOf, up to asOf. */
export function twelveMonthWindow(asOf: string): { start: string; end: string } {
  return { start: oneYearBefore(asOf), end: asOf };
}

export function leaversInWindow(employees: ReportEmployee[], asOf: string): ReportEmployee[] {
  const { start, end } = twelveMonthWindow(asOf);
  return employees
    .filter((e) => e.terminated_at !== null && e.terminated_at >= start && e.terminated_at <= end)
    .sort(
      (a, b) =>
        (b.terminated_at ?? "").localeCompare(a.terminated_at ?? "") ||
        a.surname.localeCompare(b.surname) ||
        a.names.localeCompare(b.names),
    );
}

export function inServiceOn(employees: ReportEmployee[], asOf: string): ReportEmployee[] {
  return employees
    .filter((e) => activeOn(e, asOf))
    .sort((a, b) => a.surname.localeCompare(b.surname) || a.names.localeCompare(b.names));
}

export function companyDocumentStatus(
  expiresAt: string | null,
  asOf: string,
): { status: CompanyDocumentStatus; daysLeft: number | null } {
  const { status, daysLeft } = certStatus(expiresAt, COMPANY_DOCUMENT_WINDOW_DAYS, asOf);
  if (status === "expired") return { status: "Expired", daysLeft };
  if (status === "due_soon") return { status: "Due soon", daysLeft };
  if (status === "valid") return { status: "Current", daysLeft };
  return { status: "No expiry", daysLeft: null };
}

export interface TrainingDeliveredRow {
  surname: string;
  names: string;
  idNumber: string;
  course: string;
  category: string;
  provider: string;
  hours: number | null;
  cost: number | null;
  date: string;
}

/**
 * Certificates obtained inside the SETA year that asOf falls in, for the
 * training types that count toward the Annual Training Report. Leavers are
 * kept: training delivered to someone who has since left was still
 * delivered in the year.
 */
export function trainingDeliveredRows(
  delivered: TrainingDelivered[],
  types: TrainingType[],
  employees: ReportEmployee[],
  asOf: string,
): TrainingDeliveredRow[] {
  const year = setaYearRange(setaYearFor(asOf));
  const typeById = new Map(types.map((t) => [t.id, t]));
  const empById = new Map(employees.map((e) => [e.id, e]));
  const out: TrainingDeliveredRow[] = [];
  for (const d of delivered) {
    if (!d.training_date || d.training_date < year.start || d.training_date > year.end) continue;
    const t = typeById.get(d.training_type_id);
    if (!t || !t.counts_for_atr) continue;
    const e = empById.get(d.employee_id);
    if (!e) continue;
    out.push({
      surname: e.surname,
      names: e.names,
      idNumber: String(e.id_number ?? ""),
      course: t.name,
      category: trainingCategoryLabel(t.category),
      provider: t.provider ?? "",
      hours: t.hours,
      cost: t.cost_cents === null ? null : Math.round(t.cost_cents) / 100,
      date: d.training_date,
    });
  }
  out.sort(
    (a, b) =>
      a.surname.localeCompare(b.surname) ||
      a.names.localeCompare(b.names) ||
      a.date.localeCompare(b.date) ||
      a.course.localeCompare(b.course),
  );
  return out;
}

function yesNo(v: boolean | null | undefined): string {
  if (v === true) return "Yes";
  if (v === false) return "No";
  return "";
}

function genderLabel(g: ReportEmployee["gender"]): string {
  return GENDERS.find((x) => x.value === g)?.label ?? "";
}

function populationGroupLabel(g: ReportEmployee["population_group"]): string {
  return POPULATION_GROUPS.find((x) => x.value === g)?.label ?? "";
}

function terminationClassLabel(reason: ReportEmployee["termination_reason"]): string {
  if (!reason) return "";
  const cls = TERMINATION_REASONS.find((r) => r.value === reason)?.cls;
  return cls === "no_fault" ? "No fault" : cls === "fault" ? "Fault" : "";
}

function absencePlannedLabel(reason: Absence["reason"]): string {
  const planned = ABSENCE_REASONS.find((r) => r.value === reason)?.planned;
  return planned ? "Planned" : "Unplanned";
}

const RENEWAL_KIND_LABELS: Record<RenewalRow["kind"], string> = {
  certification: "Certification",
  document: "Identity document",
  certified_copy: "Certified copy",
  company_document: "Company document",
};

export function buildEvidenceSheets(input: EvidenceInput): SheetSpec[] {
  const { asOf, org } = input;
  const asAt = `As at ${asOf}`;
  const inService = inServiceOn(input.employees, asOf);
  const leavers = leaversInWindow(input.employees, asOf);
  const window = twelveMonthWindow(asOf);
  const profile = sectorProfile(org.sector);
  const designated = inService.length >= EE_DESIGNATED_THRESHOLD;
  const setaYear = setaYearFor(asOf);
  const setaRange = setaYearRange(setaYear);
  const dueSoonDays = Number.isFinite(org.due_soon_days) ? org.due_soon_days : 30;

  const cover: SheetSpec = {
    name: "Cover",
    title: "Inspection evidence pack",
    subtitle: `${asAt}. Source: the Certly register for ${org.name}.`,
    columns: [
      { header: "Item", key: "label", width: 34 },
      { header: "Value", key: "value", width: 56 },
    ],
    rows: [
      { label: "Organisation", value: org.name },
      { label: "Workspace", value: `certly.co.za/${org.slug}` },
      { label: "Sector", value: profile.label },
      { label: "Primary Act", value: profile.primaryAct },
      { label: "SETA", value: org.seta ?? "Not set" },
      { label: "SDL number", value: org.sdl_number ?? "Not set" },
      { label: "EE reference number", value: org.ee_reference ?? "Not set" },
      { label: "People in service", value: inService.length },
      { label: `People who left (${window.start} to ${window.end})`, value: leavers.length },
      {
        label: `Designated employer (${EE_DESIGNATED_THRESHOLD} or more in service)`,
        value: designated ? "Yes" : "No",
      },
      { label: "As at", value: asOf },
      { label: "Generated by", value: input.generatedBy },
      { label: "Generated on", value: input.generatedOn },
    ],
    notes: [
      "Figures reflect the register as it stood on the date this pack was generated. Later edits are not shown here.",
      "Register: every certification on file, one row per certificate, with its expiry and status.",
      "People: every person in service on the as-at date, with the fields the EEA1 form asks for.",
      `Leavers: every person whose last day falls between ${window.start} and ${window.end}, with the recorded reason.`,
      "Company documents: letters of good standing, registrations, policies and appointments, with expiry status.",
      "Expiring: everything expired or due within the renewal window, for people and for the company.",
      "EEA2 profile: the workforce profile by occupational level as the EEA2 form prints it.",
      `Absences: every absence spell between ${window.start} and ${window.end}.`,
      `Training delivered: certificates obtained in the SETA year ${setaRange.label}, for types that count toward the Annual Training Report.`,
      "Activity: the most recent entries in the tamper-proof change log.",
    ],
  };

  const registerRows = [...input.register]
    .map((r) => {
      const { status, daysLeft } = certStatus(r.expiry_date, dueSoonDays, asOf);
      return {
        surname: r.surname,
        names: r.names,
        idNumber: String(r.id_number ?? ""),
        site: siteOf(r.site),
        superior: r.superior ?? "",
        trainingType: r.training_type,
        trainingDate: r.training_date ?? "",
        expiryDate: r.expiry_date ?? "",
        daysLeft,
        status: statusLabel(status),
      };
    })
    .sort(
      (a, b) =>
        a.surname.localeCompare(b.surname) ||
        a.names.localeCompare(b.names) ||
        a.trainingType.localeCompare(b.trainingType),
    );

  const register: SheetSpec = {
    name: "Register",
    title: "Certification register",
    subtitle: `${asAt}. Source: certifications held by people in service.`,
    columns: [
      { header: "Surname", key: "surname", width: 20 },
      { header: "Names", key: "names", width: 24 },
      { header: "ID number", key: "idNumber", width: 18, numFmt: "@", align: "left" },
      { header: "Site", key: "site", width: 18 },
      { header: "Superior", key: "superior", width: 20 },
      { header: "Training type", key: "trainingType", width: 28 },
      { header: "Training date", key: "trainingDate", width: 13 },
      { header: "Expiry date", key: "expiryDate", width: 13 },
      { header: "Days left", key: "daysLeft", width: 10, numFmt: "0" },
      { header: "Status", key: "status", width: 12 },
    ],
    rows: registerRows,
    notes: [
      `Days left and status are counted from ${asOf}. A certificate is Due soon within ${dueSoonDays} days of expiry and Expired the day after it expires.`,
      registerRows.length === 0 ? "No certifications are on file." : "",
    ].filter(Boolean),
  };

  const people: SheetSpec = {
    name: "People",
    title: "People in service",
    subtitle: `${asAt}. Source: the employee register.`,
    columns: [
      { header: "Surname", key: "surname", width: 20 },
      { header: "Names", key: "names", width: 24 },
      { header: "ID number", key: "idNumber", width: 18, numFmt: "@", align: "left" },
      { header: "ID type", key: "idType", width: 22 },
      { header: "Site", key: "site", width: 18 },
      { header: "Designation", key: "designation", width: 22 },
      { header: "Start date", key: "startDate", width: 12 },
      { header: "Date of birth", key: "dateOfBirth", width: 13 },
      { header: "Occupational level", key: "level", width: 24 },
      { header: "Gender", key: "gender", width: 10 },
      { header: "Population group", key: "group", width: 16 },
      { header: "Disability", key: "disability", width: 11 },
      { header: "Foreign national", key: "foreign", width: 15 },
      { header: "EEA1 declared", key: "declared", width: 13 },
    ],
    rows: inService.map((e) => ({
      surname: e.surname,
      names: e.names,
      idNumber: String(e.id_number ?? ""),
      idType: idTypeLabel(e.id_type),
      site: siteOf(e.site),
      designation: e.designation ?? "",
      startDate: e.engaged_at ?? "",
      dateOfBirth: e.date_of_birth ?? "",
      level: e.occupational_level ? OCCUPATIONAL_LEVEL_SHORT[e.occupational_level] : "",
      gender: genderLabel(e.gender),
      group: populationGroupLabel(e.population_group),
      disability: yesNo(e.disability),
      foreign: isForeignNational(e.id_type) ? "Yes" : "No",
      declared: e.ee_declared_at ?? "",
    })),
    notes: [
      "Population group, gender and disability are the employee's own EEA1 declarations.",
      "Foreign national is taken from the identity document type: anyone without a South African ID is counted as a foreign national.",
      inService.length === 0 ? "Nobody is recorded as in service on the as-at date." : "",
    ].filter(Boolean),
  };

  const leaversSheet: SheetSpec = {
    name: "Leavers",
    title: "People who left in the last 12 months",
    subtitle: `${asAt}. Last day between ${window.start} and ${window.end}. Source: the employee register.`,
    columns: [
      { header: "Surname", key: "surname", width: 20 },
      { header: "Names", key: "names", width: 24 },
      { header: "Site", key: "site", width: 18 },
      { header: "Designation", key: "designation", width: 22 },
      { header: "Start date", key: "startDate", width: 12 },
      { header: "Last day", key: "lastDay", width: 12 },
      { header: "Reason", key: "reason", width: 40 },
      { header: "Class", key: "cls", width: 12 },
    ],
    rows: leavers.map((e) => ({
      surname: e.surname,
      names: e.names,
      site: siteOf(e.site),
      designation: e.designation ?? "",
      startDate: e.engaged_at ?? "",
      lastDay: e.terminated_at ?? "",
      reason: terminationLabel(e.termination_reason),
      cls: terminationClassLabel(e.termination_reason),
    })),
    notes: [
      "No fault: deceased, retirement, medical incapacity, fixed term or limited duration contract ended, retrenchment. Fault: resignation, dismissal, abscondment.",
      leavers.length === 0 ? "Nobody left in this window." : "",
    ].filter(Boolean),
  };

  const companyRows = input.companyDocuments.map((d) => {
    const { status, daysLeft } = companyDocumentStatus(d.expires_at, asOf);
    return {
      category: COMPANY_DOCUMENT_LABELS[d.category] ?? "Company document",
      title: d.title,
      issued: d.issued_at ?? "",
      expires: d.expires_at ?? "",
      status,
      daysLeft,
      file: d.file_path ? "Yes" : "No",
    };
  });

  const companyDocs: SheetSpec = {
    name: "Company documents",
    title: "Company documents",
    subtitle: `${asAt}. Source: the company documents folder.`,
    columns: [
      { header: "Category", key: "category", width: 20 },
      { header: "Title", key: "title", width: 44 },
      { header: "Issued", key: "issued", width: 12 },
      { header: "Expires", key: "expires", width: 12 },
      { header: "Status", key: "status", width: 12 },
      { header: "Days left", key: "daysLeft", width: 10, numFmt: "0" },
      { header: "File on record", key: "file", width: 14 },
    ],
    rows: companyRows,
    notes: [
      `Status is counted from ${asOf}. Due soon means the document expires within ${COMPANY_DOCUMENT_WINDOW_DAYS} days. No expiry means no expiry date was recorded.`,
      companyRows.length === 0 ? "No company documents are on file." : "",
    ].filter(Boolean),
  };

  const bucketRows = (bucket: string, rows: RenewalRow[]) =>
    rows.map((r) => ({
      bucket,
      kind: RENEWAL_KIND_LABELS[r.kind],
      person: r.kind === "company_document" ? "Company" : `${r.surname}, ${r.names}`,
      what: r.kind === "company_document" ? `${r.names}: ${r.label}` : r.label,
      site: r.kind === "company_document" ? "" : siteOf(r.site),
      expiry: r.expiry_date,
      days: r.days_left,
    }));

  const expiringRows = [
    ...bucketRows("Expired", input.renewals.expired),
    ...bucketRows("Due within 7 days", input.renewals.dueSeven),
    ...bucketRows(`Due within ${input.renewals.horizonDays} days`, input.renewals.dueThirty),
  ];

  const expiring: SheetSpec = {
    name: "Expiring",
    title: "Expired and expiring items",
    subtitle: `${asAt}. Source: the renewals list for people and company documents.`,
    columns: [
      { header: "Bucket", key: "bucket", width: 20 },
      { header: "Kind", key: "kind", width: 18 },
      { header: "Person", key: "person", width: 30 },
      { header: "What", key: "what", width: 40 },
      { header: "Site", key: "site", width: 18 },
      { header: "Expiry", key: "expiry", width: 12 },
      { header: "Days", key: "days", width: 8, numFmt: "0" },
    ],
    rows: expiringRows,
    notes: [
      "Days are counted from the day the pack was generated. A negative number is days since expiry.",
      "Covers certifications, identity documents, certified copies of identity documents and company documents for people in service.",
      expiringRows.length === 0 ? "Nothing is expired or due for renewal." : "",
    ].filter(Boolean),
  };

  const matrix = eeMatrix(inService);
  const eeColumns = matrix.columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: 11,
    numFmt: "0",
    align: "right" as const,
  }));
  const eeRows = matrix.rows
    .filter((r) => r.key !== "total")
    .map((r) => ({ level: r.shortLabel, ...r.cells, total: r.total }));

  const eea2: SheetSpec = {
    name: "EEA2 profile",
    title: "Workforce profile (EEA2 section B)",
    subtitle: `${asAt}. People in service on the as-at date. Source: the employee register.`,
    columns: [
      { header: "Occupational level", key: "level", width: 26 },
      ...eeColumns,
      { header: "Total", key: "total", width: 10, numFmt: "0", align: "right" },
    ],
    rows: eeRows,
    totals: { level: "Total", ...matrix.totals.cells, total: matrix.totals.total },
    notes: [
      "A is African, C is Coloured, I is Indian, W is White, as the EEA2 form abbreviates them.",
      "Foreign nationals are counted only in the Foreign M and Foreign F columns, never under a population group, as the form requires.",
      "Not declared columns hold people who have not completed an EEA1 declaration. Level not set holds people with no occupational level recorded.",
      "Population group and gender are the employee's own EEA1 declarations.",
    ],
  };

  const empById = new Map(input.employees.map((e) => [e.id, e]));
  const absenceRows = input.absences
    .filter((a) => a.ends_on >= window.start && a.starts_on <= window.end)
    .map((a) => {
      const e = empById.get(a.employee_id);
      return {
        surname: e?.surname ?? "",
        names: e?.names ?? "",
        site: siteOf(e?.site),
        firstDay: a.starts_on,
        lastDay: a.ends_on,
        days: overlapDays(a.starts_on, a.ends_on, window.start, window.end, a.half_day),
        reason: absenceReasonLabel(a.reason),
        planned: absencePlannedLabel(a.reason),
        notes: a.notes ?? "",
      };
    })
    .sort(
      (a, b) =>
        a.surname.localeCompare(b.surname) ||
        a.names.localeCompare(b.names) ||
        a.firstDay.localeCompare(b.firstDay),
    );

  const absences: SheetSpec = {
    name: "Absences",
    title: "Absence spells in the last 12 months",
    subtitle: `${asAt}. Spells between ${window.start} and ${window.end}. Source: the absence register.`,
    columns: [
      { header: "Surname", key: "surname", width: 20 },
      { header: "Names", key: "names", width: 24 },
      { header: "Site", key: "site", width: 18 },
      { header: "First day", key: "firstDay", width: 12 },
      { header: "Last day", key: "lastDay", width: 12 },
      { header: "Days", key: "days", width: 8, align: "right" },
      { header: "Reason", key: "reason", width: 28 },
      { header: "Planned", key: "planned", width: 11 },
      { header: "Notes", key: "notes", width: 40 },
    ],
    rows: absenceRows,
    totals: {
      surname: "Total",
      days: absenceRows.reduce((sum, r) => sum + r.days, 0),
    },
    notes: [
      "Days are calendar days of the spell that fall inside the window. A half day counts as 0.5.",
      "Planned: annual leave and study leave. Unplanned: everything else.",
      absenceRows.length === 0 ? "No absences were recorded in this window." : "",
    ].filter(Boolean),
  };

  const deliveredRows = trainingDeliveredRows(
    input.trainingDelivered,
    input.trainingTypes,
    input.employees,
    asOf,
  );

  const delivered: SheetSpec = {
    name: "Training delivered",
    title: `Training delivered in SETA year ${setaYear}`,
    subtitle: `${asAt}. ${setaRange.label}. Source: certificates on file joined to the training catalogue.`,
    columns: [
      { header: "Surname", key: "surname", width: 20 },
      { header: "Names", key: "names", width: 24 },
      { header: "ID number", key: "idNumber", width: 18, numFmt: "@", align: "left" },
      { header: "Course", key: "course", width: 28 },
      { header: "Category", key: "category", width: 18 },
      { header: "Provider", key: "provider", width: 24 },
      { header: "Hours", key: "hours", width: 8, align: "right" },
      { header: "Cost (R)", key: "cost", width: 12, numFmt: "#,##0.00" },
      { header: "Date", key: "date", width: 12 },
    ],
    rows: deliveredRows.map((r) => ({ ...r })),
    totals: {
      surname: "Total",
      hours: deliveredRows.reduce((sum, r) => sum + (r.hours ?? 0), 0),
      cost: deliveredRows.reduce((sum, r) => sum + (r.cost ?? 0), 0),
    },
    notes: [
      "Only training types marked as counting toward the Annual Training Report are included. Site inductions are excluded by default.",
      "Hours and cost are the figures recorded against the training type, not per certificate. A blank means the figure has not been captured.",
      `The SETA year runs ${setaRange.label}. The WSP and ATR for this year are due ${setaRange.due}.`,
      deliveredRows.length === 0 ? "No training that counts for the ATR was delivered in this SETA year." : "",
    ].filter(Boolean),
  };

  const activityRows = input.audit.slice(0, ACTIVITY_LIMIT).map((a) => ({
    at: a.at,
    actor: a.actorEmail,
    actorId: a.actor ?? "",
    action: a.action,
    table: a.table_name,
    rowId: a.row_id ?? "",
    summary: a.summary,
  }));

  const activity: SheetSpec = {
    name: "Activity",
    title: "Change log",
    subtitle: `${asAt}. Source: the audit trail. Most recent ${ACTIVITY_LIMIT} entries from the last ${ACTIVITY_WINDOW_DAYS} days.`,
    columns: [
      { header: "At", key: "at", width: 24 },
      { header: "Actor", key: "actor", width: 28 },
      { header: "Actor id", key: "actorId", width: 38 },
      { header: "Action", key: "action", width: 10 },
      { header: "Table", key: "table", width: 20 },
      { header: "Row id", key: "rowId", width: 38 },
      { header: "Summary", key: "summary", width: 44 },
    ],
    rows: activityRows,
    notes: [
      "Written by database triggers. Cannot be edited or deleted by any user.",
      "Actor is the signed-in user who made the change. System means the change came from an automated process.",
      !input.auditReadable
        ? "The change log is readable by the workspace owner only. Ask the owner to generate this pack to include it."
        : activityRows.length === 0
          ? "No changes were recorded in this window."
          : "",
    ].filter(Boolean),
  };

  return [
    cover,
    register,
    people,
    leaversSheet,
    companyDocs,
    expiring,
    eea2,
    absences,
    delivered,
    activity,
  ];
}
