import { createClient } from "@/lib/supabase/server";
import type {
  ComplianceSnapshot,
  Employee,
  TrainingType,
  RegisterRow,
  CertStatus,
  IdType,
  Certification,
  EmployeeCertificationRow,
  TrainingTypeWithUsage,
  CompanyDocument,
} from "@/lib/types/database";
import { certStatus } from "@/lib/certifications/status";
import { certifiedCopyStatus, recertifyBy } from "@/lib/hr/certified-copy";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Tenant-scoped query helpers, server-side only.
//
// Every function takes the organisation id and filters on it explicitly.
// Row Level Security already limits rows to organisations the signed-in
// user belongs to, but a user can belong to more than one workspace, so
// the explicit organisation_id filter is what keeps one workspace's data
// out of another's views. Never drop it.
//
// NOTE on typing: the hand-written Database type does not fully cooperate
// with @supabase/postgrest-js overloads, so functions cast the client to
// `any` and rely on the return-type annotation plus a local row cast.

/** List employees for one workspace, alphabetical by surname. */
export async function listEmployees(
  orgId: string,
  search?: string,
  options: { includeTerminated?: boolean } = {},
): Promise<Employee[]> {
  const supabase: any = await createClient();
  let query = supabase
    .from("employees")
    .select("*")
    .eq("organisation_id", orgId)
    .order("surname", { ascending: true });
  if (!options.includeTerminated) query = query.is("terminated_at", null);
  if (search) {
    const term = search.replace(/[%,]/g, "").trim();
    if (term) {
      query = query.or(
        `surname.ilike.%${term}%,names.ilike.%${term}%,id_number.ilike.%${term}%`,
      );
    }
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Employee[];
}

/** Fetch one employee, scoped to the workspace. Null if not found. */
export async function getEmployee(
  orgId: string,
  id: string,
): Promise<Employee | null> {
  const supabase: any = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("organisation_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) return null;
  return (data ?? null) as Employee | null;
}

/** Distinct site values in this workspace, sorted, for autocomplete and filters. */
export async function getSiteOptions(orgId: string): Promise<string[]> {
  const supabase: any = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select("site")
    .eq("organisation_id", orgId)
    .is("terminated_at", null)
    .not("site", "is", null);
  if (error) throw error;
  const rows = (data ?? []) as Array<{ site: string | null }>;
  const set = new Set<string>();
  for (const row of rows) if (row.site) set.add(row.site);
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Active training types for this workspace, ordered for display. */
export async function getTrainingTypes(orgId: string): Promise<TrainingType[]> {
  const supabase: any = await createClient();
  const { data, error } = await supabase
    .from("training_types")
    .select("*")
    .eq("organisation_id", orgId)
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TrainingType[];
}

/**
 * Every training type in the workspace, active and hidden, with the number of
 * certifications pointing at each. The count drives the settings screen: a type
 * that is in use cannot be deleted, only hidden, because certifications
 * reference it with on delete restrict.
 */
export async function getTrainingTypesWithUsage(
  orgId: string,
): Promise<TrainingTypeWithUsage[]> {
  const supabase: any = await createClient();
  const [typeResult, certResult] = await Promise.all([
    supabase
      .from("training_types")
      .select("*")
      .eq("organisation_id", orgId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("certifications")
      .select("training_type_id")
      .eq("organisation_id", orgId),
  ]);
  if (typeResult.error) throw typeResult.error;
  if (certResult.error) throw certResult.error;

  const counts = new Map<string, number>();
  for (const row of (certResult.data ?? []) as Array<{ training_type_id: string }>) {
    counts.set(row.training_type_id, (counts.get(row.training_type_id) ?? 0) + 1);
  }
  return ((typeResult.data ?? []) as TrainingType[]).map((t) => ({
    ...t,
    certification_count: counts.get(t.id) ?? 0,
  }));
}

/** Company level documents for this workspace, in display order. */
export async function getCompanyDocuments(
  orgId: string,
): Promise<CompanyDocument[]> {
  const supabase: any = await createClient();
  const { data, error } = await supabase
    .from("company_documents")
    .select("*")
    .eq("organisation_id", orgId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CompanyDocument[];
}

/** One company document, scoped to the workspace. Null if not found. */
export async function getCompanyDocument(
  orgId: string,
  id: string,
): Promise<CompanyDocument | null> {
  const supabase: any = await createClient();
  const { data, error } = await supabase
    .from("company_documents")
    .select("*")
    .eq("organisation_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) return null;
  return (data ?? null) as CompanyDocument | null;
}

// ---------------------------------------------------------------------------
// Renewals
// ---------------------------------------------------------------------------

export type RenewalKind = "certification" | "document" | "certified_copy" | "company_document";

export interface RenewalRow {
  key: string;
  kind: RenewalKind;
  employee_id: string;
  surname: string;
  names: string;
  id_number: string;
  site: string | null;
  superior: string | null;
  label: string;
  expiry_date: string;
  days_left: number;
  certification_id: string | null;
  document_id: string | null;
}

export interface RenewalBuckets {
  expired: RenewalRow[];
  dueSeven: RenewalRow[];
  dueThirty: RenewalRow[];
  horizonDays: number;
}

/**
 * Everything that has lapsed or is about to, in one list, grouped by urgency.
 *
 * Certifications and identity documents share the buckets on purpose. A work
 * permit running out stops a person at the gate exactly like a lapsed
 * induction does, and a supervisor chasing renewals should not have to check
 * two screens to find that out.
 */
export async function getRenewals(
  orgId: string,
  dueSoonDays = 30,
): Promise<RenewalBuckets> {
  const supabase: any = await createClient();
  const [certResult, employeeResult, companyResult] = await Promise.all([
    supabase
      .from("certifications")
      .select(
        "id, employee_id, expiry_date, " +
          "employees!inner(surname, names, id_number, site, superior), " +
          "training_types!inner(name)",
      )
      .eq("organisation_id", orgId)
      .not("expiry_date", "is", null),
    supabase
      .from("employees")
      .select(
        "id, surname, names, id_number, id_type, id_expiry, site, superior, id_file_path, id_certified_at",
      )
      .eq("organisation_id", orgId)
      .is("terminated_at", null),
    supabase
      .from("company_documents")
      .select("id, title, category, expires_at")
      .eq("organisation_id", orgId)
      .not("expires_at", "is", null),
  ]);
  if (certResult.error) throw certResult.error;
  if (employeeResult.error) throw employeeResult.error;
  if (companyResult.error) throw companyResult.error;

  const horizon = Math.max(dueSoonDays, 30);
  const rows: RenewalRow[] = [];

  const certs = (certResult.data ?? []) as Array<{
    id: string;
    employee_id: string;
    expiry_date: string;
    employees: {
      surname: string | null;
      names: string | null;
      id_number: string | null;
      site: string | null;
      superior: string | null;
    } | null;
    training_types: { name: string | null } | null;
  }>;

  for (const c of certs) {
    const { daysLeft } = certStatus(c.expiry_date, dueSoonDays);
    if (daysLeft === null || daysLeft > horizon) continue;
    rows.push({
      key: `cert:${c.id}`,
      kind: "certification",
      employee_id: c.employee_id,
      surname: c.employees?.surname ?? "",
      names: c.employees?.names ?? "",
      id_number: c.employees?.id_number ?? "",
      site: c.employees?.site ?? null,
      superior: c.employees?.superior ?? null,
      label: c.training_types?.name ?? "",
      expiry_date: c.expiry_date,
      days_left: daysLeft,
      certification_id: c.id,
      document_id: null,
    });
  }

  const people = (employeeResult.data ?? []) as Array<{
    id: string;
    surname: string;
    names: string;
    id_number: string;
    id_type: IdType;
    id_expiry: string | null;
    site: string | null;
    superior: string | null;
    id_file_path: string | null;
    id_certified_at: string | null;
  }>;

  for (const p of people) {
    if (!p.id_expiry) continue;
    const { daysLeft } = certStatus(p.id_expiry, dueSoonDays);
    if (daysLeft === null || daysLeft > horizon) continue;
    rows.push({
      key: `doc:${p.id}`,
      kind: "document",
      employee_id: p.id,
      surname: p.surname,
      names: p.names,
      id_number: p.id_number,
      site: p.site,
      superior: p.superior,
      label: DOCUMENT_LABELS[p.id_type] ?? "Identity document",
      expiry_date: p.id_expiry,
      days_left: daysLeft,
      certification_id: null,
      document_id: null,
    });
  }

  // A certified copy that has gone stale stops a pack at the client's desk
  // exactly like a lapsed certificate stops a person at the gate, so it
  // belongs in the same list rather than on a screen nobody opens. Only
  // employees who actually have a copy on file are counted; one with no copy
  // at all is an outstanding item on the safety file, not a renewal.
  for (const p of people) {
    if (!p.id_file_path) continue;
    const copy = certifiedCopyStatus(p.id_certified_at, true);
    if (copy.state !== "stale" && copy.state !== "expiring") continue;
    if (copy.daysLeft === null) continue;
    rows.push({
      key: `copy:${p.id}`,
      kind: "certified_copy",
      employee_id: p.id,
      surname: p.surname,
      names: p.names,
      id_number: p.id_number,
      site: p.site,
      superior: p.superior,
      label: `Certified copy of ${DOCUMENT_LABELS[p.id_type] ?? "identity document"}`,
      expiry_date: recertifyBy(p.id_certified_at) ?? "",
      days_left: copy.daysLeft,
      certification_id: null,
      document_id: null,
    });
  }

  for (const row of companyDocumentRenewals(
    (companyResult.data ?? []) as Array<{ id: string; title: string; category: string; expires_at: string }>,
    dueSoonDays,
    horizon,
  )) {
    rows.push(row);
  }

  rows.sort(
    (a, b) => a.days_left - b.days_left || a.surname.localeCompare(b.surname),
  );

  return {
    expired: rows.filter((r) => r.days_left < 0),
    dueSeven: rows.filter((r) => r.days_left >= 0 && r.days_left <= 7),
    dueThirty: rows.filter((r) => r.days_left > 7 && r.days_left <= horizon),
    horizonDays: horizon,
  };
}

const DOCUMENT_LABELS: Record<string, string> = {
  sa_id: "South African ID",
  passport: "Passport",
  work_permit: "Work permit",
  asylum: "Asylum document",
  other: "Identity document",
};

export const COMPANY_DOCUMENT_LABELS: Record<string, string> = {
  policy: "Policy",
  registration: "Registration",
  tax: "Tax",
  coida: "Compensation Fund",
  insurance: "Insurance",
  bbbee: "B-BBEE",
  organogram: "Organogram",
  appointment: "Appointment",
  procedure: "Procedure",
  other: "Company document",
};

/**
 * An expired letter of good standing or B-BBEE certificate turns the whole
 * crew away at the gate at once, which is worse than any single lapsed
 * ticket. The company documents sit in the same renewal buckets as the
 * people so nobody has to remember to check a second screen. Shared by the
 * signed-in query and the digest cron so the two cannot drift.
 */
export function companyDocumentRenewals(
  docs: Array<{ id: string; title: string; category: string; expires_at: string | null }>,
  dueSoonDays: number,
  horizon: number,
): RenewalRow[] {
  const out: RenewalRow[] = [];
  for (const d of docs) {
    if (!d.expires_at) continue;
    const { daysLeft } = certStatus(d.expires_at, dueSoonDays);
    if (daysLeft === null || daysLeft > horizon) continue;
    out.push({
      key: `company:${d.id}`,
      kind: "company_document",
      employee_id: "",
      surname: "Company",
      names: COMPANY_DOCUMENT_LABELS[d.category] ?? "Document",
      id_number: "",
      site: null,
      superior: null,
      label: d.title,
      expiry_date: d.expires_at,
      days_left: daysLeft,
      certification_id: null,
      document_id: d.id,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Sites
// ---------------------------------------------------------------------------

export interface SiteSummary {
  site: string;
  people: number;
  records: number;
  expired: number;
  dueSoon: number;
  valid: number;
  noExpiry: number;
  readiness: number;
}

/**
 * One row per site, with the readiness figure a supervisor actually asks for:
 * the share of certifications on that site that are neither expired nor about
 * to expire. Employees with no site fall under "Unassigned" rather than being
 * dropped, because an unassigned person is still someone's problem.
 */
export async function getSiteSummaries(
  orgId: string,
  dueSoonDays = 30,
): Promise<SiteSummary[]> {
  const supabase: any = await createClient();
  const [employeeResult, certResult] = await Promise.all([
    supabase
      .from("employees")
      .select("id, site")
      .eq("organisation_id", orgId)
      .is("terminated_at", null),
    supabase
      .from("certifications")
      .select("id, employee_id, expiry_date")
      .eq("organisation_id", orgId),
  ]);
  if (employeeResult.error) throw employeeResult.error;
  if (certResult.error) throw certResult.error;

  const employees = (employeeResult.data ?? []) as Array<{
    id: string;
    site: string | null;
  }>;
  const siteOf = new Map<string, string>();
  const summaries = new Map<string, SiteSummary>();

  function bucket(site: string): SiteSummary {
    let entry = summaries.get(site);
    if (!entry) {
      entry = {
        site,
        people: 0,
        records: 0,
        expired: 0,
        dueSoon: 0,
        valid: 0,
        noExpiry: 0,
        readiness: 0,
      };
      summaries.set(site, entry);
    }
    return entry;
  }

  for (const e of employees) {
    const site = e.site?.trim() || "Unassigned";
    siteOf.set(e.id, site);
    bucket(site).people += 1;
  }

  const certs = (certResult.data ?? []) as Array<{
    id: string;
    employee_id: string;
    expiry_date: string | null;
  }>;

  for (const c of certs) {
    const site = siteOf.get(c.employee_id);
    if (!site) continue;
    const entry = bucket(site);
    entry.records += 1;
    const { status } = certStatus(c.expiry_date, dueSoonDays);
    if (status === "expired") entry.expired += 1;
    else if (status === "due_soon") entry.dueSoon += 1;
    else if (status === "valid") entry.valid += 1;
    else entry.noExpiry += 1;
  }

  const out = [...summaries.values()];
  for (const entry of out) {
    const dated = entry.expired + entry.dueSoon + entry.valid;
    entry.readiness = dated === 0 ? 100 : Math.round((entry.valid / dated) * 100);
  }

  out.sort((a, b) => {
    if (a.site === "Unassigned") return 1;
    if (b.site === "Unassigned") return -1;
    return b.expired - a.expired || a.site.localeCompare(b.site);
  });
  return out;
}

// ---------------------------------------------------------------------------
// Safety file
// ---------------------------------------------------------------------------

export interface SafetyFilePerson {
  id: string;
  surname: string;
  names: string;
  id_number: string;
  id_type: IdType;
  id_country: string | null;
  id_expiry: string | null;
  id_file_path: string | null;
  id_certified_at: string | null;
  site: string | null;
  designation: string | null;
  superior: string | null;
  certs: Record<
    string,
    {
      training_date: string | null;
      expiry_date: string | null;
      status: CertStatus;
      days_left: number | null;
      has_file: boolean;
      cert_file_path: string | null;
      certification_id: string;
    }
  >;
}

export interface SafetyFileData {
  people: SafetyFilePerson[];
  columns: TrainingType[];
  sites: string[];
  totals: {
    people: number;
    records: number;
    expired: number;
    dueSoon: number;
    missingFiles: number;
  };
}

/**
 * Assemble the employee half of a safety file for one workspace, optionally
 * narrowed to a single site. Columns are the active training types that at
 * least one included person actually holds a record for, so a pack does not
 * print twenty empty columns.
 */
export async function getSafetyFileData(
  orgId: string,
  options: { site?: string; dueSoonDays?: number } = {},
): Promise<SafetyFileData> {
  const supabase: any = await createClient();

  let employeeQuery = supabase
    .from("employees")
    .select(
      "id, surname, names, id_number, id_type, id_country, id_expiry, id_file_path, id_certified_at, site, designation, superior",
    )
    .eq("organisation_id", orgId)
    .is("terminated_at", null)
    .order("surname", { ascending: true });
  if (options.site) employeeQuery = employeeQuery.eq("site", options.site);

  const [employeeResult, certResult, typeResult] = await Promise.all([
    employeeQuery,
    supabase
      .from("certifications")
      .select(
        "id, employee_id, training_type_id, training_date, expiry_date, cert_file_path",
      )
      .eq("organisation_id", orgId),
    supabase
      .from("training_types")
      .select("*")
      .eq("organisation_id", orgId)
      .eq("active", true)
      .order("sort_order", { ascending: true }),
  ]);
  if (employeeResult.error) throw employeeResult.error;
  if (certResult.error) throw certResult.error;
  if (typeResult.error) throw typeResult.error;

  const employees = (employeeResult.data ?? []) as Array<{
    id: string;
    surname: string;
    names: string;
    id_number: string;
    id_type: IdType;
    id_country: string | null;
    id_expiry: string | null;
    id_file_path: string | null;
    id_certified_at: string | null;
    site: string | null;
    designation: string | null;
    superior: string | null;
  }>;
  const included = new Set(employees.map((e) => e.id));
  const allTypes = (typeResult.data ?? []) as TrainingType[];

  const certs = ((certResult.data ?? []) as Array<{
    id: string;
    employee_id: string;
    training_type_id: string;
    training_date: string | null;
    expiry_date: string | null;
    cert_file_path: string | null;
  }>).filter((c) => included.has(c.employee_id));

  const usedTypes = new Set(certs.map((c) => c.training_type_id));
  const columns = allTypes.filter((t) => usedTypes.has(t.id));

  const byEmployee = new Map<string, SafetyFilePerson["certs"]>();
  let expired = 0;
  let dueSoon = 0;
  let missingFiles = 0;

  for (const c of certs) {
    const { status, daysLeft } = certStatus(c.expiry_date, options.dueSoonDays);
    if (status === "expired") expired++;
    if (status === "due_soon") dueSoon++;
    if (!c.cert_file_path) missingFiles++;
    const bucket = byEmployee.get(c.employee_id) ?? {};
    bucket[c.training_type_id] = {
      training_date: c.training_date,
      expiry_date: c.expiry_date,
      status,
      days_left: daysLeft,
      has_file: Boolean(c.cert_file_path),
      cert_file_path: c.cert_file_path,
      certification_id: c.id,
    };
    byEmployee.set(c.employee_id, bucket);
  }

  const people: SafetyFilePerson[] = employees.map((e) => ({
    ...e,
    certs: byEmployee.get(e.id) ?? {},
  }));

  const sites = [
    ...new Set(employees.map((e) => e.site).filter((s): s is string => Boolean(s))),
  ].sort((a, b) => a.localeCompare(b));

  return {
    people,
    columns,
    sites,
    totals: {
      people: people.length,
      records: certs.length,
      expired,
      dueSoon,
      missingFiles,
    },
  };
}

// ---------------------------------------------------------------------------
// Certifications
// ---------------------------------------------------------------------------

// Shape returned by the joined certifications query below.
type JoinedEmployeeCert = {
  id: string;
  organisation_id: string;
  employee_id: string;
  training_type_id: string;
  training_date: string | null;
  expiry_date: string | null;
  cert_file_path: string | null;
  source: "manual" | "extracted";
  training_types: { name: string | null; sort_order: number | null } | null;
};

/**
 * Every certification held by one employee, joined to its training type and
 * ordered the way the workspace orders its catalogue. Scoped by workspace as
 * well as by employee: the employee id alone is not a tenant boundary, so a
 * forged id from another workspace returns nothing rather than someone
 * else's records. Ordering happens in memory because PostgREST cannot sort
 * a parent row by an embedded column reliably.
 */
export async function getEmployeeCertifications(
  orgId: string,
  employeeId: string,
): Promise<EmployeeCertificationRow[]> {
  const supabase: any = await createClient();
  const { data, error } = await supabase
    .from("certifications")
    .select(
      "id, organisation_id, employee_id, training_type_id, training_date, " +
        "expiry_date, cert_file_path, source, " +
        "training_types!inner(name, sort_order)",
    )
    .eq("organisation_id", orgId)
    .eq("employee_id", employeeId);
  if (error) throw error;

  const raw = (data ?? []) as JoinedEmployeeCert[];
  const rows: EmployeeCertificationRow[] = raw.map((r) => ({
    id: r.id,
    organisation_id: r.organisation_id,
    employee_id: r.employee_id,
    training_type_id: r.training_type_id,
    training_type_name: r.training_types?.name ?? "",
    sort_order: r.training_types?.sort_order ?? 0,
    training_date: r.training_date,
    expiry_date: r.expiry_date,
    cert_file_path: r.cert_file_path,
    source: r.source,
  }));

  rows.sort(
    (a, b) =>
      a.sort_order - b.sort_order ||
      a.training_type_name.localeCompare(b.training_type_name),
  );
  return rows;
}

/** Fetch one certification, scoped to the workspace. Null if not found. */
export async function getCertification(
  orgId: string,
  id: string,
): Promise<Certification | null> {
  const supabase: any = await createClient();
  const { data, error } = await supabase
    .from("certifications")
    .select("*")
    .eq("organisation_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) return null;
  return (data ?? null) as Certification | null;
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

export type RegisterSortKey =
  | "surname"
  | "names"
  | "id_number"
  | "site"
  | "training_type"
  | "training_date"
  | "expiry_date"
  | "days_left"
  | "status";

export type SortDirection = "asc" | "desc";

export interface RegisterFilters {
  search?: string;
  site?: string;
  trainingType?: string;
  status?: CertStatus | "all";
  sort?: RegisterSortKey;
  dir?: SortDirection;
}

// Shape returned by the joined certifications query below.
type JoinedRegisterRow = {
  id: string;
  employee_id: string;
  training_date: string | null;
  expiry_date: string | null;
  employees: {
    surname: string | null;
    names: string | null;
    id_number: string | null;
    id_type: IdType | null;
    site: string | null;
    superior: string | null;
  } | null;
  training_types: { name: string | null; sort_order: number | null } | null;
};

export interface RegisterPage {
  rows: RegisterRow[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export const REGISTER_PAGE_SIZE = 100;

/**
 * One page of the register, filtered, sorted and counted by Postgres.
 *
 * Reads public.register_rows, a security_invoker view that computes status
 * and days_left in SQL from expiry_date and the workspace's own
 * due_soon_days. Because the view is security_invoker, RLS applies as the
 * calling user exactly as it does on a direct select, and the explicit
 * organisation_id filter below is still what keeps a user who belongs to two
 * workspaces from seeing both at once.
 *
 * The dueSoonDays argument is accepted for call compatibility but ignored:
 * the view reads the value from the organisations row, so the window cannot
 * drift between the page and the database.
 */
export async function getRegisterPage(
  orgId: string,
  filters: RegisterFilters = {},
  page = 0,
  pageSize = REGISTER_PAGE_SIZE,
): Promise<RegisterPage> {
  const supabase: any = await createClient();

  let query = supabase
    .from("register_rows")
    .select("*", { count: "exact" })
    .eq("organisation_id", orgId)
    .is("terminated_at", null);

  const term = filters.search?.trim();
  if (term) {
    const safeTerm = term.replace(/[%,()]/g, "").trim();
    if (safeTerm) {
      query = query.or(
        `surname.ilike.%${safeTerm}%,names.ilike.%${safeTerm}%,id_number.ilike.%${safeTerm}%`,
      );
    }
  }
  if (filters.site) query = query.eq("site", filters.site);
  if (filters.trainingType) query = query.eq("training_type", filters.trainingType);
  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  const ascending = filters.dir !== "desc";
  const sort = filters.sort;
  if (sort === "status") {
    query = query
      .order("urgency", { ascending })
      .order("expiry_date", { ascending, nullsFirst: false });
  } else if (sort === "days_left") {
    query = query.order("days_left", { ascending, nullsFirst: false });
  } else if (sort) {
    query = query.order(sort, { ascending, nullsFirst: false });
  } else {
    query = query
      .order("urgency", { ascending: true })
      .order("expiry_date", { ascending: true, nullsFirst: false });
  }
  query = query.order("certification_id", { ascending: true });

  const from = page * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  const rows = ((data ?? []) as ViewRow[]).map(fromView);
  const total = count ?? rows.length;

  return {
    rows,
    total,
    page,
    pageSize,
    hasMore: from + rows.length < total,
  };
}

type ViewRow = {
  certification_id: string;
  employee_id: string;
  surname: string | null;
  names: string | null;
  id_number: string | null;
  id_type: IdType | null;
  site: string | null;
  superior: string | null;
  training_type: string | null;
  training_date: string | null;
  expiry_date: string | null;
  days_left: number | null;
  status: CertStatus;
};

function fromView(r: ViewRow): RegisterRow {
  return {
    certification_id: r.certification_id,
    employee_id: r.employee_id,
    surname: r.surname ?? "",
    names: r.names ?? "",
    id_number: r.id_number ?? "",
    id_type: r.id_type ?? "sa_id",
    site: r.site,
    superior: r.superior,
    training_type: r.training_type ?? "",
    training_date: r.training_date,
    expiry_date: r.expiry_date,
    status: r.status,
    days_left: r.days_left,
  };
}

/**
 * Status counts across the whole register, ignoring filters, for the coloured
 * cards. Four head-only counts rather than pulling every row down to tally
 * them in memory.
 */
export async function getRegisterKpis(
  orgId: string,
): Promise<Record<CertStatus, number>> {
  const supabase: any = await createClient();
  const statuses: CertStatus[] = ["expired", "due_soon", "valid", "no_expiry"];

  const results = await Promise.all(
    statuses.map((status) =>
      supabase
        .from("register_rows")
        .select("certification_id", { count: "exact", head: true })
        .eq("organisation_id", orgId)
        .is("terminated_at", null)
        .eq("status", status),
    ),
  );

  const kpi: Record<CertStatus, number> = {
    expired: 0,
    due_soon: 0,
    valid: 0,
    no_expiry: 0,
  };
  statuses.forEach((status, i) => {
    kpi[status] = results[i].count ?? 0;
  });
  return kpi;
}

/**
 * Every matching row, unpaged. Only for the CSV export, which by definition
 * has to hand over the whole register. Everything on screen uses
 * getRegisterPage.
 */
export async function getRegisterRows(
  orgId: string,
  filters: RegisterFilters = {},
): Promise<RegisterRow[]> {
  const out: RegisterRow[] = [];
  const pageSize = 1000;
  for (let page = 0; page < 200; page += 1) {
    const result = await getRegisterPage(orgId, filters, page, pageSize);
    out.push(...result.rows);
    if (!result.hasMore) break;
  }
  return out;
}



/**
 * Every (employee, site) pair with at least one expired certificate, for
 * the gate readiness count on the overview. People who have left are not
 * in the view, so they cannot appear here.
 */
export async function getExpiredBySite(
  orgId: string,
): Promise<Array<{ employee_id: string; site: string | null }>> {
  const supabase: any = await createClient();
  const { data, error } = await supabase
    .from("register_rows")
    .select("employee_id, site")
    .eq("organisation_id", orgId)
    .eq("status", "expired");
  if (error) throw error;
  return (data ?? []) as Array<{ employee_id: string; site: string | null }>;
}

/** Snapshots for the trend, oldest first, at most the last 120 days. */
export async function getComplianceSnapshots(
  orgId: string,
  sinceIso: string,
): Promise<ComplianceSnapshot[]> {
  const supabase: any = await createClient();
  const { data, error } = await supabase
    .from("compliance_snapshots")
    .select("*")
    .eq("organisation_id", orgId)
    .gte("taken_on", sinceIso)
    .order("taken_on", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ComplianceSnapshot[];
}

/**
 * Record today's score. Called from the overview when an admin views it,
 * so the history fills in through ordinary use rather than a scheduled
 * job that needs its own secret. RLS limits this to admins of the org;
 * a failure here is swallowed because a dashboard that cannot save its
 * own history is still a dashboard.
 */
export async function recordComplianceSnapshot(
  orgId: string,
  snapshot: Omit<ComplianceSnapshot, "id" | "organisation_id" | "created_at">,
): Promise<void> {
  const supabase: any = await createClient();
  await supabase
    .from("compliance_snapshots")
    .upsert({ organisation_id: orgId, ...snapshot }, { onConflict: "organisation_id,taken_on" });
}
