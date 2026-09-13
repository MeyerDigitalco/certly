import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type AuditAction = "INSERT" | "UPDATE" | "DELETE";

export interface AuditEntry {
  id: string;
  actor: string | null;
  actorEmail: string;
  action: AuditAction;
  table_name: string;
  row_id: string | null;
  at: string;
  summary: string;
  changed: Array<{ field: string; from: string; to: string }>;
}

export interface AuditFilters {
  table?: string;
  action?: AuditAction;
  actor?: string;
  since?: string;
}

export interface AuditPage {
  entries: AuditEntry[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  actors: Array<{ id: string; email: string }>;
}

export const AUDIT_PAGE_SIZE = 50;

const TABLE_LABELS: Record<string, string> = {
  employees: "Employee",
  certifications: "Certification",
  extraction_drafts: "Scanned document",
};

export function auditTableLabel(table: string): string {
  return TABLE_LABELS[table] ?? table;
}

/**
 * Fields worth showing a human. The audit trigger stores whole row snapshots,
 * so a diff of everything would bury a changed expiry date under timestamps
 * and internal ids that mean nothing to the person reading.
 */
const NOISE = new Set([
  "id",
  "organisation_id",
  "created_at",
  "updated_at",
  "created_by",
]);

const FIELD_LABELS: Record<string, string> = {
  surname: "Surname",
  names: "First names",
  id_number: "Document number",
  id_type: "Document type",
  id_country: "Issuing country",
  id_expiry: "Document expiry",
  id_file_path: "Identity copy",
  id_certified_at: "Certified on",
  site: "Site",
  superior: "Superior",
  designation: "Designation",
  training_date: "Training date",
  expiry_date: "Expiry date",
  cert_file_path: "Certificate file",
  training_type_id: "Training type",
  employee_id: "Employee",
  active: "Active",
  name: "Name",
};

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "empty";
  if (typeof value === "boolean") return value ? "yes" : "no";
  const text = String(value);
  // Storage paths are long and meaningless on screen; say whether one exists.
  if (/^[0-9a-f-]{36}\//.test(text)) return "a file";
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}

function diff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): Array<{ field: string; from: string; to: string }> {
  if (!before || !after) return [];
  const changed: Array<{ field: string; from: string; to: string }> = [];
  for (const key of Object.keys(after)) {
    if (NOISE.has(key)) continue;
    const from = before[key];
    const to = after[key];
    if (JSON.stringify(from) === JSON.stringify(to)) continue;
    changed.push({
      field: fieldLabel(key),
      from: display(from),
      to: display(to),
    });
  }
  return changed;
}

function summarise(
  action: AuditAction,
  table: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): string {
  const row = after ?? before ?? {};
  const label = auditTableLabel(table);

  const who =
    typeof row.surname === "string" && typeof row.names === "string"
      ? `${row.surname}, ${row.names}`
      : typeof row.name === "string"
        ? row.name
        : "";

  const verb =
    action === "INSERT" ? "added" : action === "DELETE" ? "deleted" : "changed";

  return who ? `${label} ${who} ${verb}` : `${label} ${verb}`;
}

/**
 * Read the audit trail for one workspace.
 *
 * Scoped by organisation_id like every other read, and additionally gated by
 * RLS that grants select only to an owner. The actor column holds a profile
 * id, so emails are resolved through the service role in a single call, the
 * same way the admin roster does it.
 */
export async function getAuditLog(
  orgId: string,
  filters: AuditFilters = {},
  page = 0,
): Promise<AuditPage> {
  const supabase: any = await createClient();

  let query = supabase
    .from("audit_log")
    .select("id, actor, action, table_name, row_id, before, after, at")
    .eq("organisation_id", orgId)
    .order("at", { ascending: false });

  if (filters.table) query = query.eq("table_name", filters.table);
  if (filters.action) query = query.eq("action", filters.action);
  if (filters.actor) query = query.eq("actor", filters.actor);
  if (filters.since) query = query.gte("at", filters.since);

  // One extra row answers "is there another page" without a second count
  // query over a table that only grows.
  const from = page * AUDIT_PAGE_SIZE;
  query = query.range(from, from + AUDIT_PAGE_SIZE);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as Array<{
    id: string;
    actor: string | null;
    action: AuditAction;
    table_name: string;
    row_id: string | null;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    at: string;
  }>;

  const hasMore = rows.length > AUDIT_PAGE_SIZE;
  const visible = hasMore ? rows.slice(0, AUDIT_PAGE_SIZE) : rows;

  const actorIds = [...new Set(visible.map((r) => r.actor).filter(Boolean))];
  const emails = await resolveEmails(actorIds as string[]);

  const entries: AuditEntry[] = visible.map((r) => ({
    id: r.id,
    actor: r.actor,
    actorEmail: r.actor ? (emails.get(r.actor) ?? "unknown") : "system",
    action: r.action,
    table_name: r.table_name,
    row_id: r.row_id,
    at: r.at,
    summary: summarise(r.action, r.table_name, r.before, r.after),
    changed: r.action === "UPDATE" ? diff(r.before, r.after) : [],
  }));

  const members = await workspaceActors(orgId);

  return {
    entries,
    page,
    pageSize: AUDIT_PAGE_SIZE,
    hasMore,
    actors: members,
  };
}

async function resolveEmails(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const admin: any = createAdminClient();
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 500 });
  for (const user of (data?.users ?? []) as Array<{
    id: string;
    email: string | null;
  }>) {
    if (user.email && ids.includes(user.id)) map.set(user.id, user.email);
  }
  return map;
}

async function workspaceActors(
  orgId: string,
): Promise<Array<{ id: string; email: string }>> {
  const supabase: any = await createClient();
  const { data } = await supabase
    .from("org_members")
    .select("user_id")
    .eq("organisation_id", orgId);
  const ids = ((data ?? []) as Array<{ user_id: string }>).map(
    (m) => m.user_id,
  );
  const emails = await resolveEmails(ids);
  return ids
    .map((id) => ({ id, email: emails.get(id) ?? "unknown" }))
    .sort((a, b) => a.email.localeCompare(b.email));
}
