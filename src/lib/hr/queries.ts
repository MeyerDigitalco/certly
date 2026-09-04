import { createClient } from "@/lib/supabase/server";
import type {
  Employee,
  TrainingType,
  RegisterRow,
  CertStatus,
  Certification,
  EmployeeCertificationRow,
} from "@/lib/types/database";
import { certStatus } from "@/lib/certifications/status";

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
): Promise<Employee[]> {
  const supabase: any = await createClient();
  let query = supabase
    .from("employees")
    .select("*")
    .eq("organisation_id", orgId)
    .order("surname", { ascending: true });
  if (search) {
    const term = search.replace(/[%,]/g, "").trim();
    if (term) {
      query = query.or(
        `surname.ilike.%${term}%,names.ilike.%${term}%,sa_id.ilike.%${term}%`,
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
  | "sa_id"
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

const STATUS_URGENCY: Record<CertStatus, number> = {
  expired: 0,
  due_soon: 1,
  valid: 2,
  no_expiry: 3,
};

// Shape returned by the joined certifications query below.
type JoinedRegisterRow = {
  id: string;
  employee_id: string;
  training_date: string | null;
  expiry_date: string | null;
  employees: {
    surname: string | null;
    names: string | null;
    sa_id: string | null;
    site: string | null;
    superior: string | null;
  } | null;
  training_types: { name: string | null; sort_order: number | null } | null;
};

/**
 * Fetch every register row for one workspace: one row per certification,
 * joined to its employee and training type. Filtering by search / site /
 * training type / status and sorting are applied in JS. At SMB scale a
 * workspace holds at most a few thousand certifications, so this stays fast
 * and avoids a Postgres view that would need security_invoker to keep RLS.
 * Status and days-left use the workspace's own due-soon window.
 */
export async function getRegisterRows(
  orgId: string,
  filters: RegisterFilters = {},
  dueSoonDays?: number,
): Promise<RegisterRow[]> {
  const supabase: any = await createClient();
  const { data, error } = await supabase
    .from("certifications")
    .select(
      "id, employee_id, training_date, expiry_date, " +
        "employees!inner(surname, names, sa_id, site, superior), " +
        "training_types!inner(name, sort_order)",
    )
    .eq("organisation_id", orgId);
  if (error) throw error;

  const raw = (data ?? []) as JoinedRegisterRow[];
  const rows: RegisterRow[] = raw.map((r) => {
    const { status, daysLeft } = certStatus(r.expiry_date, dueSoonDays);
    return {
      certification_id: r.id,
      employee_id: r.employee_id,
      surname: r.employees?.surname ?? "",
      names: r.employees?.names ?? "",
      sa_id: r.employees?.sa_id ?? "",
      site: r.employees?.site ?? null,
      superior: r.employees?.superior ?? null,
      training_type: r.training_types?.name ?? "",
      training_date: r.training_date,
      expiry_date: r.expiry_date,
      status,
      days_left: daysLeft,
    };
  });

  const filtered = applyRegisterFilters(rows, filters);
  return sortRegisterRows(filtered, filters.sort, filters.dir);
}

/** Apply the search / site / training-type / status filters in memory. */
export function applyRegisterFilters(
  rows: RegisterRow[],
  filters: RegisterFilters,
): RegisterRow[] {
  let out = rows;
  const term = filters.search?.trim().toLowerCase();
  if (term) {
    out = out.filter(
      (r) =>
        r.surname.toLowerCase().includes(term) ||
        r.names.toLowerCase().includes(term) ||
        r.sa_id.toLowerCase().includes(term),
    );
  }
  if (filters.site) out = out.filter((r) => r.site === filters.site);
  if (filters.trainingType)
    out = out.filter((r) => r.training_type === filters.trainingType);
  if (filters.status && filters.status !== "all")
    out = out.filter((r) => r.status === filters.status);
  return out;
}

/** Sort register rows by the given key and direction. */
export function sortRegisterRows(
  rows: RegisterRow[],
  sort?: RegisterSortKey,
  dir: SortDirection = "asc",
): RegisterRow[] {
  if (!sort) return rows;
  const mul = dir === "desc" ? -1 : 1;
  const copy = [...rows];
  copy.sort((a, b) => {
    let av: string | number | null = null;
    let bv: string | number | null = null;
    if (sort === "days_left") {
      av = a.days_left;
      bv = b.days_left;
    } else if (sort === "status") {
      av = STATUS_URGENCY[a.status];
      bv = STATUS_URGENCY[b.status];
    } else {
      av = (a[sort] as string | null) ?? null;
      bv = (b[sort] as string | null) ?? null;
    }
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") {
      return (av - bv) * mul;
    }
    return String(av).localeCompare(String(bv)) * mul;
  });
  return copy;
}

/**
 * KPI counts across the whole register (ignoring search and filters, which
 * only narrow the table below). Used for the coloured cards at the top.
 */
export async function getRegisterKpis(
  orgId: string,
  dueSoonDays?: number,
): Promise<Record<CertStatus, number>> {
  const rows = await getRegisterRows(orgId, {}, dueSoonDays);
  const kpi: Record<CertStatus, number> = {
    expired: 0,
    due_soon: 0,
    valid: 0,
    no_expiry: 0,
  };
  for (const r of rows) kpi[r.status]++;
  return kpi;
}
