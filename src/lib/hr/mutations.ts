"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { validateSaId } from "@/lib/validation/sa-id";

// Tenant-scoped server actions for employees.
//
// Every action takes the organisation id and slug up front. The orgId is
// verified against the signed-in user's membership before any write, and
// every mutation filters on organisation_id so a forged id can never reach
// another workspace's rows. RLS enforces the same rule at the database as
// a second line of defence.
//
// NOTE on typing: the hand-written Database type does not fully cooperate
// with @supabase/postgrest-js overloads, so every function casts the client
// to `any`. Zod validation keeps the payloads strict at the boundary.

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; field?: string };

const EmployeeSchema = z.object({
  surname: z.string().trim().min(1, "Surname is required"),
  names: z.string().trim().min(1, "First name(s) required"),
  sa_id: z.string().trim().regex(/^\d{13}$/, "SA ID must be 13 digits"),
  site: z.string().trim().max(120).optional().or(z.literal("")),
  superior: z.string().trim().max(120).optional().or(z.literal("")),
  designation: z.string().trim().max(120).optional().or(z.literal("")),
});

function fieldOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function friendlyError(error: any): string {
  // 23505 = unique_violation. The only unique constraint on employees a
  // user can trip is (organisation_id, sa_id).
  if (error?.code === "23505") {
    return "An employee with that SA ID already exists in this workspace.";
  }
  return error?.message ?? "Something went wrong. Try again.";
}

/**
 * Confirm the signed-in user is an owner or admin of this organisation
 * before any write. Returns an error string to surface, or null to proceed.
 */
async function assertAdmin(orgId: string): Promise<string | null> {
  if (!orgId) return "Missing workspace.";
  const supabase: any = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Not signed in.";
  const { data: mem } = await supabase
    .from("org_members")
    .select("role")
    .eq("organisation_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!mem || !["owner", "admin"].includes(mem.role)) {
    return "You do not have permission to change employees in this workspace.";
  }
  return null;
}

function parseEmployee(formData: FormData) {
  return EmployeeSchema.safeParse({
    surname: formData.get("surname"),
    names: formData.get("names"),
    sa_id: formData.get("sa_id"),
    site: formData.get("site") ?? "",
    superior: formData.get("superior") ?? "",
    designation: formData.get("designation") ?? "",
  });
}

// ---------------------------------------------------------------------------
// Certifications
// ---------------------------------------------------------------------------

const CERT_BUCKET = "certificates";
const MAX_CERT_FILE_BYTES = 15 * 1024 * 1024;

// Extension to content type. Anything not listed here is refused, so the
// bucket only ever holds certificates people can actually open.
const ALLOWED_CERT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
};

const CertificationSchema = z.object({
  employee_id: z.string().uuid("Choose an employee."),
  training_type_id: z.string().uuid("Choose a training type."),
  training_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Training date is not a valid date.")
    .optional()
    .or(z.literal("")),
  expiry_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expiry date is not a valid date.")
    .optional()
    .or(z.literal("")),
});

/**
 * Same membership check as assertAdmin, but it hands back the user id so an
 * insert can stamp created_by without a second round trip.
 */
async function assertAdminUser(
  orgId: string,
): Promise<{ error: string } | { userId: string }> {
  if (!orgId) return { error: "Missing workspace." };
  const supabase: any = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  const { data: mem } = await supabase
    .from("org_members")
    .select("role")
    .eq("organisation_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!mem || !["owner", "admin"].includes(mem.role)) {
    return {
      error:
        "You do not have permission to change certifications in this workspace.",
    };
  }
  return { userId: user.id };
}

/**
 * Confirm a referenced row lives in this workspace. The certifications table
 * has foreign keys to employees and training_types but no constraint tying
 * those rows to the same organisation, so an admin of one workspace could
 * otherwise file a certificate against another workspace's employee.
 */
async function belongsToOrg(
  table: "employees" | "training_types",
  orgId: string,
  id: string,
): Promise<boolean> {
  const supabase: any = await createClient();
  const { data } = await supabase
    .from(table)
    .select("id")
    .eq("organisation_id", orgId)
    .eq("id", id)
    .maybeSingle();
  return Boolean(data);
}

function certFileExt(name: string): string {
  const match = /\.([A-Za-z0-9]+)$/.exec(name.trim());
  return match ? match[1].toLowerCase() : "";
}

function friendlyCertError(error: any): string {
  // 23505 = unique_violation on (employee_id, training_type_id).
  if (error?.code === "23505") {
    return "This employee already has a record for that training type.";
  }
  return error?.message ?? "Something went wrong. Try again.";
}

function revalidateCertPaths(slug: string, employeeId: string): void {
  revalidatePath(`/${slug}/hr`);
  revalidatePath(`/${slug}/hr/renewals`);
  revalidatePath(`/${slug}/hr/employees`);
  revalidatePath(`/${slug}/hr/employees/${employeeId}`);
}

/**
 * Create or update one certification. The table keeps a single row per
 * (employee, training type) pair, so a submission without an id updates the
 * existing pair rather than failing.
 *
 * File handling is ordered so storage and the table cannot disagree. The
 * upload happens first, the row is written second, and only a successful row
 * write earns the right to delete the object it replaced. If the row write
 * fails, the object just uploaded is removed again, so a failed save never
 * leaves a file nothing points at.
 */
export async function upsertCertification(
  orgId: string,
  slug: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = CertificationSchema.safeParse({
    employee_id: formData.get("employee_id"),
    training_type_id: formData.get("training_type_id"),
    training_date: formData.get("training_date") ?? "",
    expiry_date: formData.get("expiry_date") ?? "",
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first.message, field: String(first.path[0]) };
  }

  const trainingDate = fieldOrNull(parsed.data.training_date);
  const expiryDate = fieldOrNull(parsed.data.expiry_date);
  if (trainingDate && expiryDate && expiryDate < trainingDate) {
    return {
      ok: false,
      error: "Expiry date cannot be before the training date.",
      field: "expiry_date",
    };
  }

  const guard = await assertAdminUser(orgId);
  if ("error" in guard) return { ok: false, error: guard.error };

  if (!(await belongsToOrg("employees", orgId, parsed.data.employee_id))) {
    return {
      ok: false,
      error: "That employee is not in this workspace.",
      field: "employee_id",
    };
  }
  if (
    !(await belongsToOrg("training_types", orgId, parsed.data.training_type_id))
  ) {
    return {
      ok: false,
      error: "That training type is not in this workspace.",
      field: "training_type_id",
    };
  }

  const supabase: any = await createClient();
  const certId = String(formData.get("id") ?? "").trim();

  // Work out which row we are writing, and what file it points at today.
  let existing: { id: string; cert_file_path: string | null } | null = null;
  if (certId) {
    const { data } = await supabase
      .from("certifications")
      .select("id, cert_file_path")
      .eq("organisation_id", orgId)
      .eq("id", certId)
      .maybeSingle();
    if (!data) return { ok: false, error: "That certification no longer exists." };
    existing = data as { id: string; cert_file_path: string | null };
  } else {
    const { data } = await supabase
      .from("certifications")
      .select("id, cert_file_path")
      .eq("organisation_id", orgId)
      .eq("employee_id", parsed.data.employee_id)
      .eq("training_type_id", parsed.data.training_type_id)
      .maybeSingle();
    existing = (data ?? null) as { id: string; cert_file_path: string | null } | null;
  }

  let uploadedPath: string | null = null;
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_CERT_FILE_BYTES) {
      return { ok: false, error: "That file is larger than 15 MB.", field: "file" };
    }
    const ext = certFileExt(file.name);
    const contentType = ALLOWED_CERT_TYPES[ext];
    if (!contentType) {
      return {
        ok: false,
        error: "Attach a PDF, an image, or a Word document.",
        field: "file",
      };
    }
    // The storage policy reads the first path segment as the organisation id,
    // so this prefix is what makes the write legal in the first place.
    const path = `${orgId}/manual/${parsed.data.employee_id}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(CERT_BUCKET)
      .upload(path, file, { contentType, upsert: false });
    if (uploadError) {
      return {
        ok: false,
        error: "The file could not be uploaded. Try again.",
        field: "file",
      };
    }
    uploadedPath = path;
  }

  const payload: Record<string, unknown> = {
    organisation_id: orgId,
    employee_id: parsed.data.employee_id,
    training_type_id: parsed.data.training_type_id,
    training_date: trainingDate,
    expiry_date: expiryDate,
  };
  if (uploadedPath) payload.cert_file_path = uploadedPath;

  let writeError: any = null;
  if (existing) {
    const { error } = await supabase
      .from("certifications")
      .update(payload)
      .eq("organisation_id", orgId)
      .eq("id", existing.id);
    writeError = error;
  } else {
    const { error } = await supabase.from("certifications").insert({
      ...payload,
      source: "manual",
      created_by: guard.userId,
    });
    writeError = error;
  }

  if (writeError) {
    if (uploadedPath) {
      await supabase.storage.from(CERT_BUCKET).remove([uploadedPath]);
    }
    return { ok: false, error: friendlyCertError(writeError) };
  }

  if (
    uploadedPath &&
    existing?.cert_file_path &&
    existing.cert_file_path !== uploadedPath
  ) {
    await supabase.storage.from(CERT_BUCKET).remove([existing.cert_file_path]);
  }

  revalidateCertPaths(slug, parsed.data.employee_id);
  return { ok: true };
}

/** Detach the attachment from one certification and delete the object. */
export async function removeCertificationFile(
  orgId: string,
  slug: string,
  id: string,
): Promise<ActionResult> {
  const guard = await assertAdminUser(orgId);
  if ("error" in guard) return { ok: false, error: guard.error };

  const supabase: any = await createClient();
  const { data: existing } = await supabase
    .from("certifications")
    .select("id, employee_id, cert_file_path")
    .eq("organisation_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "That certification no longer exists." };

  const row = existing as {
    id: string;
    employee_id: string;
    cert_file_path: string | null;
  };
  if (!row.cert_file_path) return { ok: true };

  // Clear the pointer first. An orphaned object is recoverable; a row that
  // points at a deleted object shows the user a broken link.
  const { error } = await supabase
    .from("certifications")
    .update({ cert_file_path: null })
    .eq("organisation_id", orgId)
    .eq("id", id);
  if (error) return { ok: false, error: friendlyCertError(error) };

  await supabase.storage.from(CERT_BUCKET).remove([row.cert_file_path]);
  revalidateCertPaths(slug, row.employee_id);
  return { ok: true };
}

/** Delete one certification and its attachment. */
export async function deleteCertification(
  orgId: string,
  slug: string,
  id: string,
): Promise<ActionResult> {
  const guard = await assertAdminUser(orgId);
  if ("error" in guard) return { ok: false, error: guard.error };

  const supabase: any = await createClient();
  const { data: existing } = await supabase
    .from("certifications")
    .select("id, employee_id, cert_file_path")
    .eq("organisation_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "That certification no longer exists." };

  const row = existing as {
    id: string;
    employee_id: string;
    cert_file_path: string | null;
  };

  const { error } = await supabase
    .from("certifications")
    .delete()
    .eq("organisation_id", orgId)
    .eq("id", id);
  if (error) return { ok: false, error: friendlyCertError(error) };

  if (row.cert_file_path) {
    await supabase.storage.from(CERT_BUCKET).remove([row.cert_file_path]);
  }
  revalidateCertPaths(slug, row.employee_id);
  return { ok: true };
}

/**
 * Delete many certifications at once, along with their attachments. The ids
 * are re-read under the workspace filter first, so ids belonging to another
 * workspace are dropped before anything is deleted.
 */
export async function bulkDeleteCertifications(
  orgId: string,
  slug: string,
  ids: string[],
): Promise<{ ok: true; deleted: number } | { ok: false; error: string }> {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { ok: false, error: "No certifications selected." };
  }
  const guard = await assertAdminUser(orgId);
  if ("error" in guard) return { ok: false, error: guard.error };

  const supabase: any = await createClient();
  const { data: rows, error: readError } = await supabase
    .from("certifications")
    .select("id, employee_id, cert_file_path")
    .eq("organisation_id", orgId)
    .in("id", ids);
  if (readError) return { ok: false, error: friendlyCertError(readError) };

  const found = (rows ?? []) as Array<{
    id: string;
    employee_id: string;
    cert_file_path: string | null;
  }>;
  if (found.length === 0) {
    return { ok: false, error: "Nothing to delete." };
  }

  const { error, count } = await supabase
    .from("certifications")
    .delete({ count: "exact" })
    .eq("organisation_id", orgId)
    .in(
      "id",
      found.map((r) => r.id),
    );
  if (error) return { ok: false, error: friendlyCertError(error) };

  const paths = found
    .map((r) => r.cert_file_path)
    .filter((p): p is string => Boolean(p));
  if (paths.length > 0) {
    await supabase.storage.from(CERT_BUCKET).remove(paths);
  }

  revalidatePath(`/${slug}/hr`);
  revalidatePath(`/${slug}/hr/renewals`);
  revalidatePath(`/${slug}/hr/employees`);
  for (const employeeId of new Set(found.map((r) => r.employee_id))) {
    revalidatePath(`/${slug}/hr/employees/${employeeId}`);
  }
  return { ok: true, deleted: count ?? found.length };
}

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

/** Create a new employee in this workspace. */
export async function createEmployee(
  orgId: string,
  slug: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseEmployee(formData);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first.message, field: String(first.path[0]) };
  }
  const saCheck = validateSaId(parsed.data.sa_id);
  if (!saCheck.valid) {
    return { ok: false, error: saCheck.reason, field: "sa_id" };
  }

  const guard = await assertAdmin(orgId);
  if (guard) return { ok: false, error: guard };

  const supabase: any = await createClient();
  const { error } = await supabase.from("employees").insert({
    organisation_id: orgId,
    surname: parsed.data.surname,
    names: parsed.data.names,
    sa_id: parsed.data.sa_id,
    site: fieldOrNull(parsed.data.site),
    superior: fieldOrNull(parsed.data.superior),
    designation: fieldOrNull(parsed.data.designation),
  });
  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath(`/${slug}/hr`);
  revalidatePath(`/${slug}/hr/employees`);
  return { ok: true };
}

/** Update an employee in this workspace. */
export async function updateEmployee(
  orgId: string,
  slug: string,
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseEmployee(formData);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first.message, field: String(first.path[0]) };
  }
  const saCheck = validateSaId(parsed.data.sa_id);
  if (!saCheck.valid) {
    return { ok: false, error: saCheck.reason, field: "sa_id" };
  }

  const guard = await assertAdmin(orgId);
  if (guard) return { ok: false, error: guard };

  const supabase: any = await createClient();
  const { error } = await supabase
    .from("employees")
    .update({
      surname: parsed.data.surname,
      names: parsed.data.names,
      sa_id: parsed.data.sa_id,
      site: fieldOrNull(parsed.data.site),
      superior: fieldOrNull(parsed.data.superior),
      designation: fieldOrNull(parsed.data.designation),
    })
    .eq("organisation_id", orgId)
    .eq("id", id);
  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath(`/${slug}/hr`);
  revalidatePath(`/${slug}/hr/employees`);
  revalidatePath(`/${slug}/hr/employees/${id}`);
  return { ok: true };
}

/** Delete one employee. Their certifications cascade-delete in the database. */
export async function deleteEmployee(
  orgId: string,
  slug: string,
  id: string,
): Promise<ActionResult> {
  const guard = await assertAdmin(orgId);
  if (guard) return { ok: false, error: guard };

  const supabase: any = await createClient();
  const { error } = await supabase
    .from("employees")
    .delete()
    .eq("organisation_id", orgId)
    .eq("id", id);
  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath(`/${slug}/hr`);
  revalidatePath(`/${slug}/hr/employees`);
  return { ok: true };
}

/**
 * Delete many employees at once. All their certifications cascade-delete.
 * Returns the count of employees actually removed.
 */
export async function bulkDeleteEmployees(
  orgId: string,
  slug: string,
  ids: string[],
): Promise<{ ok: true; deleted: number } | { ok: false; error: string }> {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { ok: false, error: "No employees selected." };
  }
  const guard = await assertAdmin(orgId);
  if (guard) return { ok: false, error: guard };

  const supabase: any = await createClient();
  const { error, count } = await supabase
    .from("employees")
    .delete({ count: "exact" })
    .eq("organisation_id", orgId)
    .in("id", ids);
  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath(`/${slug}/hr`);
  revalidatePath(`/${slug}/hr/employees`);
  return { ok: true, deleted: count ?? ids.length };
}
