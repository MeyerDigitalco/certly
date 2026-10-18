"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  validateIdentification,
  normaliseIdNumber,
} from "@/lib/validation/identification";
import { isCompanyCategory } from "@/lib/hr/company-documents";
import { assertWritable } from "@/lib/billing/access";
import { normaliseTrainingTypeName } from "@/lib/hr/training-type-name";
import { isTerminationReason } from "@/lib/hr/operations";

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
  id_number: z.string().trim().min(1, "An identification number is required"),
  id_type: z.enum(["sa_id", "passport", "work_permit", "asylum", "other"]),
  id_country: z.string().trim().max(10).optional().or(z.literal("")),
  id_expiry: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Document expiry is not a valid date")
    .optional()
    .or(z.literal("")),
  site: z.string().trim().max(120).optional().or(z.literal("")),
  superior: z.string().trim().max(120).optional().or(z.literal("")),
  designation: z.string().trim().max(120).optional().or(z.literal("")),
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth is not a valid date")
    .optional()
    .or(z.literal("")),
  engaged_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Start date is not a valid date")
    .optional()
    .or(z.literal("")),
  retirement_age: z
    .string()
    .regex(/^\d{0,2}$/, "Retirement age must be a whole number")
    .optional()
    .or(z.literal("")),
  approved_retirement_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Approved retirement date is not a valid date")
    .optional()
    .or(z.literal("")),
});

function intOrNull(v: unknown): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isInteger(n) ? n : null;
}

function fieldOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function friendlyError(error: any): string {
  // 23505 = unique_violation. The only unique constraint on employees a
  // user can trip is (organisation_id, id_number).
  if (error?.code === "23505") {
    return "An employee with that identification number already exists in this workspace.";
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
  return assertWritable(orgId);
}

function parseEmployee(formData: FormData) {
  return EmployeeSchema.safeParse({
    surname: formData.get("surname"),
    names: formData.get("names"),
    id_number: formData.get("id_number"),
    id_type: formData.get("id_type") ?? "sa_id",
    id_country: formData.get("id_country") ?? "",
    id_expiry: formData.get("id_expiry") ?? "",
    site: formData.get("site") ?? "",
    superior: formData.get("superior") ?? "",
    designation: formData.get("designation") ?? "",
    date_of_birth: formData.get("date_of_birth") ?? "",
    engaged_at: formData.get("engaged_at") ?? "",
    retirement_age: formData.get("retirement_age") ?? "",
    approved_retirement_date: formData.get("approved_retirement_date") ?? "",
  });
}

function lifecycleFields(data: {
  date_of_birth?: string;
  engaged_at?: string;
  retirement_age?: string;
  approved_retirement_date?: string;
}) {
  const age = intOrNull(data.retirement_age);
  return {
    date_of_birth: fieldOrNull(data.date_of_birth),
    engaged_at: fieldOrNull(data.engaged_at),
    retirement_age: age !== null && age >= 50 && age <= 75 ? age : null,
    approved_retirement_date: fieldOrNull(data.approved_retirement_date),
  };
}

// ---------------------------------------------------------------------------
// Training types
// ---------------------------------------------------------------------------

const TrainingTypeNameSchema = z
  .string()
  .trim()
  .min(2, "Give the training type a name.")
  .max(120, "That name is too long.");

function friendlyTypeError(error: any): string {
  if (error?.code === "23505") {
    return "This workspace already has a training type with that name.";
  }
  if (error?.code === "23503") {
    return "That training type is used by existing certifications. Hide it instead of deleting it.";
  }
  return error?.message ?? "Something went wrong. Try again.";
}

function revalidateTypePaths(slug: string): void {
  revalidatePath(`/${slug}/hr`);
  revalidatePath(`/${slug}/hr/settings`);
  revalidatePath(`/${slug}/hr/certifications/new`);
  revalidatePath(`/${slug}/hr/safety-file`);
}

/** Add a training type to this workspace, placed at the end of the list. */
export async function createTrainingType(
  orgId: string,
  slug: string,
  name: string,
): Promise<ActionResult> {
  const parsed = TrainingTypeNameSchema.safeParse(name);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message, field: "name" };
  }
  const guard = await assertAdminUser(orgId);
  if ("error" in guard) return { ok: false, error: guard.error };

  const supabase: any = await createClient();
  const { data: last } = await supabase
    .from("training_types")
    .select("sort_order")
    .eq("organisation_id", orgId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = ((last?.sort_order as number | undefined) ?? 0) + 10;
  const { error } = await supabase.from("training_types").insert({
    organisation_id: orgId,
    name: parsed.data,
    sort_order: nextOrder,
    active: true,
  });
  if (error) return { ok: false, error: friendlyTypeError(error), field: "name" };

  revalidateTypePaths(slug);
  return { ok: true };
}

/**
 * Rename a training type. The new name applies retroactively to every
 * certification already filed under it, including packs already submitted.
 */
export async function renameTrainingType(
  orgId: string,
  slug: string,
  id: string,
  name: string,
): Promise<ActionResult> {
  const parsed = TrainingTypeNameSchema.safeParse(name);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message, field: "name" };
  }
  const guard = await assertAdminUser(orgId);
  if ("error" in guard) return { ok: false, error: guard.error };

  const supabase: any = await createClient();
  const { error } = await supabase
    .from("training_types")
    .update({ name: parsed.data })
    .eq("organisation_id", orgId)
    .eq("id", id);
  if (error) return { ok: false, error: friendlyTypeError(error), field: "name" };

  revalidateTypePaths(slug);
  return { ok: true };
}

/**
 * Hide or restore a training type. Hidden types drop out of the pickers and out
 * of new safety file packs, but certifications already filed under them keep
 * showing on the register, because the history is still true.
 */
export async function setTrainingTypeActive(
  orgId: string,
  slug: string,
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const guard = await assertAdminUser(orgId);
  if ("error" in guard) return { ok: false, error: guard.error };

  const supabase: any = await createClient();
  const { error } = await supabase
    .from("training_types")
    .update({ active })
    .eq("organisation_id", orgId)
    .eq("id", id);
  if (error) return { ok: false, error: friendlyTypeError(error) };

  revalidateTypePaths(slug);
  return { ok: true };
}

/** Delete a training type. Refused while any certification still points at it. */
export async function deleteTrainingType(
  orgId: string,
  slug: string,
  id: string,
): Promise<ActionResult> {
  const guard = await assertAdminUser(orgId);
  if ("error" in guard) return { ok: false, error: guard.error };

  const supabase: any = await createClient();
  const { count } = await supabase
    .from("certifications")
    .select("id", { count: "exact", head: true })
    .eq("organisation_id", orgId)
    .eq("training_type_id", id);

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `${count} certification${count === 1 ? "" : "s"} still use this training type. Hide it instead.`,
    };
  }

  const { error } = await supabase
    .from("training_types")
    .delete()
    .eq("organisation_id", orgId)
    .eq("id", id);
  if (error) return { ok: false, error: friendlyTypeError(error) };

  revalidateTypePaths(slug);
  return { ok: true };
}

/** Move a training type one place up or down the workspace's display order. */
export async function moveTrainingType(
  orgId: string,
  slug: string,
  id: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  const guard = await assertAdminUser(orgId);
  if ("error" in guard) return { ok: false, error: guard.error };

  const supabase: any = await createClient();
  const { data, error: readError } = await supabase
    .from("training_types")
    .select("id, sort_order")
    .eq("organisation_id", orgId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (readError) return { ok: false, error: friendlyTypeError(readError) };

  const list = (data ?? []) as Array<{ id: string; sort_order: number }>;
  const index = list.findIndex((r) => r.id === id);
  if (index < 0) return { ok: false, error: "That training type no longer exists." };

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= list.length) return { ok: true };

  const moving = list[index];
  const neighbour = list[target];
  const movingOrder =
    moving.sort_order === neighbour.sort_order
      ? direction === "up"
        ? neighbour.sort_order - 5
        : neighbour.sort_order + 5
      : neighbour.sort_order;
  const neighbourOrder =
    moving.sort_order === neighbour.sort_order
      ? neighbour.sort_order
      : moving.sort_order;

  const first = await supabase
    .from("training_types")
    .update({ sort_order: movingOrder })
    .eq("organisation_id", orgId)
    .eq("id", moving.id);
  if (first.error) return { ok: false, error: friendlyTypeError(first.error) };

  const second = await supabase
    .from("training_types")
    .update({ sort_order: neighbourOrder })
    .eq("organisation_id", orgId)
    .eq("id", neighbour.id);
  if (second.error) return { ok: false, error: friendlyTypeError(second.error) };

  revalidateTypePaths(slug);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Certifications
// ---------------------------------------------------------------------------

const CERT_BUCKET = "certificates";
const IDENTITY_BUCKET = "identity-documents";
const COMPANY_BUCKET = "company-documents";
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
  const blocked = await assertWritable(orgId);
  if (blocked) return { error: blocked };
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

const ScannedIdentitySchema = z.object({
  employee_id: z.string().uuid().optional().or(z.literal("")),
  surname: z.string().trim().optional().or(z.literal("")),
  names: z.string().trim().optional().or(z.literal("")),
  id_number: z.string().trim().min(1, "An identification number is required."),
  id_type: z.enum(["sa_id", "passport", "work_permit", "asylum", "other"]),
  id_country: z.string().trim().max(10).optional().or(z.literal("")),
  id_expiry: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Document expiry is not a valid date.")
    .optional()
    .or(z.literal("")),
  site: z.string().trim().max(120).optional().or(z.literal("")),
  designation: z.string().trim().max(120).optional().or(z.literal("")),
});

/**
 * Save identification read off an identity document, passport or permit.
 *
 * This updates who a person is rather than what training they hold, so it
 * writes to the employee record and creates no certification. The scan itself
 * is deliberately not stored: identity documents are more sensitive than
 * training certificates and the certificates bucket is not the place for them.
 */
export async function saveScannedIdentity(
  orgId: string,
  slug: string,
  formData: FormData,
): Promise<{ ok: true; employeeId: string } | { ok: false; error: string; field?: string }> {
  const parsed = ScannedIdentitySchema.safeParse({
    employee_id: formData.get("employee_id") ?? "",
    surname: formData.get("surname") ?? "",
    names: formData.get("names") ?? "",
    id_number: formData.get("id_number") ?? "",
    id_type: formData.get("id_type") ?? "sa_id",
    id_country: formData.get("id_country") ?? "",
    id_expiry: formData.get("id_expiry") ?? "",
    site: formData.get("site") ?? "",
    designation: formData.get("designation") ?? "",
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first.message, field: String(first.path[0]) };
  }

  const idCheck = validateIdentification(parsed.data.id_type, parsed.data.id_number);
  if (!idCheck.valid) {
    return { ok: false, error: idCheck.reason, field: "id_number" };
  }
  const idNumber = normaliseIdNumber(parsed.data.id_type, parsed.data.id_number);

  const guard = await assertAdminUser(orgId);
  if ("error" in guard) return { ok: false, error: guard.error };

  const supabase: any = await createClient();
  const identityFields = {
    id_number: idNumber,
    id_type: parsed.data.id_type,
    id_country: fieldOrNull(parsed.data.id_country),
    id_expiry: fieldOrNull(parsed.data.id_expiry),
  };

  let employeeId = parsed.data.employee_id ?? "";
  let previousFile: string | null = null;

  if (!employeeId) {
    const { data: existing } = await supabase
      .from("employees")
      .select("id")
      .eq("organisation_id", orgId)
      .eq("id_number", idNumber)
      .maybeSingle();
    if (existing?.id) employeeId = existing.id as string;
  }

  if (employeeId) {
    const { data: current } = await supabase
      .from("employees")
      .select("id, id_file_path")
      .eq("organisation_id", orgId)
      .eq("id", employeeId)
      .maybeSingle();
    if (!current) {
      return { ok: false, error: "That employee is not in this workspace.", field: "employee_id" };
    }
    previousFile = (current.id_file_path as string | null) ?? null;

    const { error } = await supabase
      .from("employees")
      .update(identityFields)
      .eq("organisation_id", orgId)
      .eq("id", employeeId);
    if (error) return { ok: false, error: friendlyError(error), field: "id_number" };
  } else {
    const surname = fieldOrNull(parsed.data.surname);
    const names = fieldOrNull(parsed.data.names);
    if (!surname) return { ok: false, error: "A surname is required.", field: "surname" };
    if (!names) return { ok: false, error: "First names are required.", field: "names" };

    const { data: created, error: createError } = await supabase
      .from("employees")
      .insert({
        organisation_id: orgId,
        surname,
        names,
        ...identityFields,
        site: fieldOrNull(parsed.data.site),
        designation: fieldOrNull(parsed.data.designation),
      })
      .select("id")
      .maybeSingle();
    if (createError || !created?.id) {
      return {
        ok: false,
        error: friendlyError(createError ?? { message: "The employee could not be created." }),
        field: "id_number",
      };
    }
    employeeId = created.id as string;
  }

  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_CERT_FILE_BYTES) {
      return { ok: false, error: "That file is larger than 15 MB.", field: "file" };
    }
    const ext = certFileExt(file.name);
    const contentType = ALLOWED_CERT_TYPES[ext];
    if (!contentType) {
      return { ok: false, error: "Attach a PDF or an image of the document.", field: "file" };
    }
    const path = `${orgId}/${employeeId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(IDENTITY_BUCKET)
      .upload(path, file, { contentType, upsert: false });
    if (uploadError) {
      return { ok: false, error: "The document could not be uploaded. Try again.", field: "file" };
    }

    const { error: pointerError } = await supabase
      .from("employees")
      .update({ id_file_path: path })
      .eq("organisation_id", orgId)
      .eq("id", employeeId);
    if (pointerError) {
      await supabase.storage.from(IDENTITY_BUCKET).remove([path]);
      return { ok: false, error: friendlyError(pointerError), field: "file" };
    }

    if (previousFile && previousFile !== path) {
      await supabase.storage.from(IDENTITY_BUCKET).remove([previousFile]);
    }
  }

  revalidateCertPaths(slug, employeeId);
  return { ok: true, employeeId };
}

/** Remove a stored identity document and delete the object. */
export async function removeIdentityFile(
  orgId: string,
  slug: string,
  employeeId: string,
): Promise<ActionResult> {
  const guard = await assertAdminUser(orgId);
  if ("error" in guard) return { ok: false, error: guard.error };

  const supabase: any = await createClient();
  const { data: current } = await supabase
    .from("employees")
    .select("id, id_file_path")
    .eq("organisation_id", orgId)
    .eq("id", employeeId)
    .maybeSingle();
  if (!current) return { ok: false, error: "That employee is not in this workspace." };

  const path = (current.id_file_path as string | null) ?? null;
  if (!path) return { ok: true };

  const { error } = await supabase
    .from("employees")
    .update({ id_file_path: null })
    .eq("organisation_id", orgId)
    .eq("id", employeeId);
  if (error) return { ok: false, error: friendlyError(error) };

  await supabase.storage.from(IDENTITY_BUCKET).remove([path]);
  revalidateCertPaths(slug, employeeId);
  return { ok: true };
}

const ScannedSchema = z.object({
  employee_id: z.string().uuid().optional().or(z.literal("")),
  new_surname: z.string().trim().optional().or(z.literal("")),
  new_names: z.string().trim().optional().or(z.literal("")),
  new_id_number: z.string().trim().optional().or(z.literal("")),
  new_id_type: z
    .enum(["sa_id", "passport", "work_permit", "asylum", "other"])
    .optional(),
  new_id_country: z.string().trim().max(10).optional().or(z.literal("")),
  new_id_expiry: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  new_site: z.string().trim().max(120).optional().or(z.literal("")),
  new_designation: z.string().trim().max(120).optional().or(z.literal("")),
  training_type_id: z.string().uuid().optional().or(z.literal("")),
  new_training_type: z.string().trim().max(120).optional().or(z.literal("")),
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
 * Save a certificate that came off the scanner, after a person has checked it.
 *
 * One submission can create three things: the employee, if this is somebody the
 * register has never seen, the training type, if the certificate is for training
 * this workspace has not catalogued, and the certification itself with the
 * scanned document attached. Everything is created inside the passed workspace
 * and nothing is created without an explicit instruction from the form.
 */
export async function saveScannedCertificate(
  orgId: string,
  slug: string,
  formData: FormData,
): Promise<{ ok: true; employeeId: string } | { ok: false; error: string; field?: string }> {
  const parsed = ScannedSchema.safeParse({
    employee_id: formData.get("employee_id") ?? "",
    new_surname: formData.get("new_surname") ?? "",
    new_names: formData.get("new_names") ?? "",
    new_id_number: formData.get("new_id_number") ?? "",
    new_id_type: formData.get("new_id_type") ?? undefined,
    new_id_country: formData.get("new_id_country") ?? "",
    new_id_expiry: formData.get("new_id_expiry") ?? "",
    new_site: formData.get("new_site") ?? "",
    new_designation: formData.get("new_designation") ?? "",
    training_type_id: formData.get("training_type_id") ?? "",
    new_training_type: formData.get("new_training_type") ?? "",
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

  const supabase: any = await createClient();

  let employeeId = parsed.data.employee_id ?? "";
  if (employeeId) {
    if (!(await belongsToOrg("employees", orgId, employeeId))) {
      return { ok: false, error: "That employee is not in this workspace.", field: "employee_id" };
    }
  } else {
    const surname = fieldOrNull(parsed.data.new_surname);
    const names = fieldOrNull(parsed.data.new_names);
    const idNumberRaw = fieldOrNull(parsed.data.new_id_number);
    const idType = parsed.data.new_id_type ?? "sa_id";
    if (!surname) return { ok: false, error: "A surname is required.", field: "new_surname" };
    if (!names) return { ok: false, error: "First names are required.", field: "new_names" };
    if (!idNumberRaw) {
      return {
        ok: false,
        error: "An identification number is required.",
        field: "new_id_number",
      };
    }
    const idCheck = validateIdentification(idType, idNumberRaw);
    if (!idCheck.valid) {
      return { ok: false, error: idCheck.reason, field: "new_id_number" };
    }
    const idNumber = normaliseIdNumber(idType, idNumberRaw);

    const { data: existing } = await supabase
      .from("employees")
      .select("id")
      .eq("organisation_id", orgId)
      .eq("id_number", idNumber)
      .maybeSingle();

    if (existing?.id) {
      employeeId = existing.id as string;
    } else {
      const { data: created, error: employeeError } = await supabase
        .from("employees")
        .insert({
          organisation_id: orgId,
          surname,
          names,
          id_number: idNumber,
          id_type: idType,
          id_country: fieldOrNull(parsed.data.new_id_country),
          id_expiry: fieldOrNull(parsed.data.new_id_expiry),
          site: fieldOrNull(parsed.data.new_site),
          designation: fieldOrNull(parsed.data.new_designation),
        })
        .select("id")
        .maybeSingle();
      if (employeeError || !created?.id) {
        return {
          ok: false,
          error: friendlyError(employeeError ?? { message: "The employee could not be created." }),
          field: "new_id_number",
        };
      }
      employeeId = created.id as string;
    }
  }

  let trainingTypeId = parsed.data.training_type_id ?? "";
  if (trainingTypeId) {
    if (!(await belongsToOrg("training_types", orgId, trainingTypeId))) {
      return {
        ok: false,
        error: "That training type is not in this workspace.",
        field: "training_type_id",
      };
    }
  } else {
    // Read off a certificate, so it arrives however the certificate prints it,
    // which is usually in capitals. Typed names are left exactly as typed.
    const name = normaliseTrainingTypeName(
      fieldOrNull(parsed.data.new_training_type) ?? "",
    ) || null;
    if (!name) {
      return {
        ok: false,
        error: "Choose a training type or give a name for a new one.",
        field: "training_type_id",
      };
    }
    const { data: existingType } = await supabase
      .from("training_types")
      .select("id")
      .eq("organisation_id", orgId)
      .ilike("name", name)
      .maybeSingle();

    if (existingType?.id) {
      trainingTypeId = existingType.id as string;
    } else {
      const { data: last } = await supabase
        .from("training_types")
        .select("sort_order")
        .eq("organisation_id", orgId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { data: createdType, error: typeError } = await supabase
        .from("training_types")
        .insert({
          organisation_id: orgId,
          name,
          sort_order: ((last?.sort_order as number | undefined) ?? 0) + 10,
          active: true,
        })
        .select("id")
        .maybeSingle();
      if (typeError || !createdType?.id) {
        return {
          ok: false,
          error: friendlyTypeError(typeError ?? { message: "The training type could not be created." }),
          field: "training_type_id",
        };
      }
      trainingTypeId = createdType.id as string;
    }
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
      return { ok: false, error: "Attach a PDF, an image, or a Word document.", field: "file" };
    }
    const path = `${orgId}/extracted/${employeeId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(CERT_BUCKET)
      .upload(path, file, { contentType, upsert: false });
    if (uploadError) {
      return { ok: false, error: "The file could not be uploaded. Try again.", field: "file" };
    }
    uploadedPath = path;
  }

  const extractionMetaRaw = formData.get("extraction_meta");
  let extractionMeta: unknown = null;
  if (typeof extractionMetaRaw === "string" && extractionMetaRaw.length > 0) {
    try {
      extractionMeta = JSON.parse(extractionMetaRaw);
    } catch {
      extractionMeta = null;
    }
  }

  const { data: existingCert } = await supabase
    .from("certifications")
    .select("id, cert_file_path")
    .eq("organisation_id", orgId)
    .eq("employee_id", employeeId)
    .eq("training_type_id", trainingTypeId)
    .maybeSingle();

  const payload: Record<string, unknown> = {
    organisation_id: orgId,
    employee_id: employeeId,
    training_type_id: trainingTypeId,
    training_date: trainingDate,
    expiry_date: expiryDate,
    source: "extracted",
    extraction_meta: extractionMeta,
  };
  if (uploadedPath) payload.cert_file_path = uploadedPath;

  let writeError: any = null;
  if (existingCert?.id) {
    const { error } = await supabase
      .from("certifications")
      .update(payload)
      .eq("organisation_id", orgId)
      .eq("id", existingCert.id);
    writeError = error;
  } else {
    const { error } = await supabase
      .from("certifications")
      .insert({ ...payload, created_by: guard.userId });
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
    existingCert?.cert_file_path &&
    existingCert.cert_file_path !== uploadedPath
  ) {
    await supabase.storage.from(CERT_BUCKET).remove([existingCert.cert_file_path]);
  }

  revalidateCertPaths(slug, employeeId);
  return { ok: true, employeeId };
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
  const idCheck = validateIdentification(
    parsed.data.id_type,
    parsed.data.id_number,
  );
  if (!idCheck.valid) {
    return { ok: false, error: idCheck.reason, field: "id_number" };
  }

  const guard = await assertAdmin(orgId);
  if (guard) return { ok: false, error: guard };

  const supabase: any = await createClient();
  const { error } = await supabase.from("employees").insert({
    organisation_id: orgId,
    surname: parsed.data.surname,
    names: parsed.data.names,
    id_number: normaliseIdNumber(parsed.data.id_type, parsed.data.id_number),
    id_type: parsed.data.id_type,
    id_country: fieldOrNull(parsed.data.id_country),
    id_expiry: fieldOrNull(parsed.data.id_expiry),
    site: fieldOrNull(parsed.data.site),
    superior: fieldOrNull(parsed.data.superior),
    designation: fieldOrNull(parsed.data.designation),
    ...lifecycleFields(parsed.data),
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
  const idCheck = validateIdentification(
    parsed.data.id_type,
    parsed.data.id_number,
  );
  if (!idCheck.valid) {
    return { ok: false, error: idCheck.reason, field: "id_number" };
  }

  const guard = await assertAdmin(orgId);
  if (guard) return { ok: false, error: guard };

  const supabase: any = await createClient();
  const { error } = await supabase
    .from("employees")
    .update({
      surname: parsed.data.surname,
      names: parsed.data.names,
      id_number: normaliseIdNumber(parsed.data.id_type, parsed.data.id_number),
    id_type: parsed.data.id_type,
    id_country: fieldOrNull(parsed.data.id_country),
    id_expiry: fieldOrNull(parsed.data.id_expiry),
      site: fieldOrNull(parsed.data.site),
      superior: fieldOrNull(parsed.data.superior),
      designation: fieldOrNull(parsed.data.designation),
      ...lifecycleFields(parsed.data),
    })
    .eq("organisation_id", orgId)
    .eq("id", id);
  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath(`/${slug}/hr`);
  revalidatePath(`/${slug}/hr/employees`);
  revalidatePath(`/${slug}/hr/employees/${id}`);
  return { ok: true };
}

const TerminationSchema = z.object({
  terminated_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Give the last day of service as a date"),
  termination_reason: z.string().min(1, "Choose a reason"),
  termination_notes: z.string().trim().max(500).optional().or(z.literal("")),
});

/**
 * Record that an employee has left.
 *
 * The row stays. A terminated employee is history that the Staff Movement
 * report is made of, and deleting them would delete the thing the client is
 * paying to see. What changes is that they stop counting as a seat, drop out
 * of the live register, and no longer appear in a safety file pack.
 */
export async function terminateEmployee(
  orgId: string,
  slug: string,
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = TerminationSchema.safeParse({
    terminated_at: formData.get("terminated_at") ?? "",
    termination_reason: formData.get("termination_reason") ?? "",
    termination_notes: formData.get("termination_notes") ?? "",
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first.message, field: String(first.path[0]) };
  }
  if (!isTerminationReason(parsed.data.termination_reason)) {
    return { ok: false, error: "Choose a reason", field: "termination_reason" };
  }

  const guard = await assertAdmin(orgId);
  if (guard) return { ok: false, error: guard };

  const supabase: any = await createClient();
  const { error } = await supabase
    .from("employees")
    .update({
      terminated_at: parsed.data.terminated_at,
      termination_reason: parsed.data.termination_reason,
      termination_notes: fieldOrNull(parsed.data.termination_notes),
    })
    .eq("organisation_id", orgId)
    .eq("id", id);
  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath(`/${slug}/hr`);
  revalidatePath(`/${slug}/hr/employees`);
  revalidatePath(`/${slug}/hr/employees/${id}`);
  revalidatePath(`/${slug}/hr/reports`);
  return { ok: true };
}

/** Undo a termination recorded in error. */
export async function reinstateEmployee(
  orgId: string,
  slug: string,
  id: string,
): Promise<ActionResult> {
  const guard = await assertAdmin(orgId);
  if (guard) return { ok: false, error: guard };

  const supabase: any = await createClient();
  const { error } = await supabase
    .from("employees")
    .update({
      terminated_at: null,
      termination_reason: null,
      termination_notes: null,
    })
    .eq("organisation_id", orgId)
    .eq("id", id);
  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath(`/${slug}/hr`);
  revalidatePath(`/${slug}/hr/employees`);
  revalidatePath(`/${slug}/hr/employees/${id}`);
  revalidatePath(`/${slug}/hr/reports`);
  return { ok: true };
}

/**
 * Collect every stored object belonging to a set of employees, so the files
 * can be removed after the rows are gone. Certifications cascade-delete in the
 * database, which used to leave their scans and identity copies orphaned in
 * storage forever. POPIA section 14 does not allow that.
 */
async function collectEmployeeFiles(
  orgId: string,
  employeeIds: string[],
): Promise<{ certificates: string[]; identity: string[] }> {
  if (employeeIds.length === 0) return { certificates: [], identity: [] };
  const supabase: any = await createClient();
  const [certResult, employeeResult] = await Promise.all([
    supabase
      .from("certifications")
      .select("cert_file_path")
      .eq("organisation_id", orgId)
      .in("employee_id", employeeIds)
      .not("cert_file_path", "is", null),
    supabase
      .from("employees")
      .select("id_file_path")
      .eq("organisation_id", orgId)
      .in("id", employeeIds)
      .not("id_file_path", "is", null),
  ]);
  const certificates = ((certResult.data ?? []) as Array<{ cert_file_path: string | null }>)
    .map((r) => r.cert_file_path)
    .filter((p): p is string => Boolean(p));
  const identity = ((employeeResult.data ?? []) as Array<{ id_file_path: string | null }>)
    .map((r) => r.id_file_path)
    .filter((p): p is string => Boolean(p));
  return { certificates, identity };
}

async function purgeFiles(
  certificates: string[],
  identity: string[],
): Promise<void> {
  const supabase: any = await createClient();
  if (certificates.length > 0) {
    await supabase.storage.from(CERT_BUCKET).remove(certificates);
  }
  if (identity.length > 0) {
    await supabase.storage.from(IDENTITY_BUCKET).remove(identity);
  }
}

/** Delete one employee, their certifications, and every file either held. */
export async function deleteEmployee(
  orgId: string,
  slug: string,
  id: string,
): Promise<ActionResult> {
  const guard = await assertAdmin(orgId);
  if (guard) return { ok: false, error: guard };

  const files = await collectEmployeeFiles(orgId, [id]);

  const supabase: any = await createClient();
  const { error } = await supabase
    .from("employees")
    .delete()
    .eq("organisation_id", orgId)
    .eq("id", id);
  if (error) return { ok: false, error: friendlyError(error) };

  await purgeFiles(files.certificates, files.identity);

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

  const files = await collectEmployeeFiles(orgId, ids);

  const supabase: any = await createClient();
  const { error, count } = await supabase
    .from("employees")
    .delete({ count: "exact" })
    .eq("organisation_id", orgId)
    .in("id", ids);
  if (error) return { ok: false, error: friendlyError(error) };

  await purgeFiles(files.certificates, files.identity);

  revalidatePath(`/${slug}/hr`);
  revalidatePath(`/${slug}/hr/employees`);
  return { ok: true, deleted: count ?? ids.length };
}

// ---------------------------------------------------------------------------
// Company documents
// ---------------------------------------------------------------------------

const CompanyDocSchema = z.object({
  title: z.string().trim().min(2, "Give the document a title.").max(160),
  category: z.string().trim().min(1),
  issued_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Issue date is not a valid date.")
    .optional()
    .or(z.literal("")),
  expires_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expiry date is not a valid date.")
    .optional()
    .or(z.literal("")),
});

function revalidateDocPaths(slug: string): void {
  revalidatePath(`/${slug}/hr/documents`);
  revalidatePath(`/${slug}/hr/safety-file`);
}

/**
 * Add or replace a company level document, the half of a safety file that does
 * not come off the register. Upload happens before the row is written, and the
 * object it replaces is only removed once that write succeeds, so a failed save
 * never leaves storage holding a file nothing points at.
 */
export async function upsertCompanyDocument(
  orgId: string,
  slug: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = CompanyDocSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category") ?? "other",
    issued_at: formData.get("issued_at") ?? "",
    expires_at: formData.get("expires_at") ?? "",
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first.message, field: String(first.path[0]) };
  }
  if (!isCompanyCategory(parsed.data.category)) {
    return { ok: false, error: "Choose a document category.", field: "category" };
  }

  const issued = fieldOrNull(parsed.data.issued_at);
  const expires = fieldOrNull(parsed.data.expires_at);
  if (issued && expires && expires < issued) {
    return {
      ok: false,
      error: "Expiry date cannot be before the issue date.",
      field: "expires_at",
    };
  }

  const guard = await assertAdminUser(orgId);
  if ("error" in guard) return { ok: false, error: guard.error };

  const supabase: any = await createClient();
  const docId = String(formData.get("id") ?? "").trim();

  let existing: { id: string; file_path: string | null } | null = null;
  if (docId) {
    const { data } = await supabase
      .from("company_documents")
      .select("id, file_path")
      .eq("organisation_id", orgId)
      .eq("id", docId)
      .maybeSingle();
    if (!data) return { ok: false, error: "That document no longer exists." };
    existing = data as { id: string; file_path: string | null };
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
    const path = `${orgId}/${parsed.data.category}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(COMPANY_BUCKET)
      .upload(path, file, { contentType, upsert: false });
    if (uploadError) {
      return { ok: false, error: "The file could not be uploaded. Try again.", field: "file" };
    }
    uploadedPath = path;
  }

  const payload: Record<string, unknown> = {
    organisation_id: orgId,
    category: parsed.data.category,
    title: parsed.data.title,
    issued_at: issued,
    expires_at: expires,
  };
  if (uploadedPath) payload.file_path = uploadedPath;

  let writeError: any = null;
  if (existing) {
    const { error } = await supabase
      .from("company_documents")
      .update(payload)
      .eq("organisation_id", orgId)
      .eq("id", existing.id);
    writeError = error;
  } else {
    const { data: last } = await supabase
      .from("company_documents")
      .select("sort_order")
      .eq("organisation_id", orgId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabase.from("company_documents").insert({
      ...payload,
      sort_order: ((last?.sort_order as number | undefined) ?? 0) + 10,
      created_by: guard.userId,
    });
    writeError = error;
  }

  if (writeError) {
    if (uploadedPath) {
      await supabase.storage.from(COMPANY_BUCKET).remove([uploadedPath]);
    }
    return { ok: false, error: writeError?.message ?? "Something went wrong. Try again." };
  }

  if (uploadedPath && existing?.file_path && existing.file_path !== uploadedPath) {
    await supabase.storage.from(COMPANY_BUCKET).remove([existing.file_path]);
  }

  revalidateDocPaths(slug);
  return { ok: true };
}

/** Delete a company document and its stored file. */
export async function deleteCompanyDocument(
  orgId: string,
  slug: string,
  id: string,
): Promise<ActionResult> {
  const guard = await assertAdminUser(orgId);
  if ("error" in guard) return { ok: false, error: guard.error };

  const supabase: any = await createClient();
  const { data: existing } = await supabase
    .from("company_documents")
    .select("id, file_path")
    .eq("organisation_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "That document no longer exists." };

  const { error } = await supabase
    .from("company_documents")
    .delete()
    .eq("organisation_id", orgId)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  const path = (existing.file_path as string | null) ?? null;
  if (path) {
    await supabase.storage.from(COMPANY_BUCKET).remove([path]);
  }

  revalidateDocPaths(slug);
  return { ok: true };
}

/** Record when an identity copy was certified by a commissioner of oaths. */
export async function setIdentityCertifiedAt(
  orgId: string,
  slug: string,
  employeeId: string,
  certifiedAt: string | null,
): Promise<ActionResult> {
  if (certifiedAt !== null && !/^\d{4}-\d{2}-\d{2}$/.test(certifiedAt)) {
    return { ok: false, error: "That is not a valid date." };
  }
  const guard = await assertAdminUser(orgId);
  if ("error" in guard) return { ok: false, error: guard.error };

  const supabase: any = await createClient();
  const { error } = await supabase
    .from("employees")
    .update({ id_certified_at: certifiedAt })
    .eq("organisation_id", orgId)
    .eq("id", employeeId);
  if (error) return { ok: false, error: friendlyError(error) };

  revalidateCertPaths(slug, employeeId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Labour plans
// ---------------------------------------------------------------------------

const LabourPlanSchema = z.object({
  site: z.string().trim().min(1, "Site is required").max(120),
  designation: z.string().trim().min(1, "Designation is required").max(120),
  planned: z
    .string()
    .regex(/^\d{1,5}$/, "Planned positions must be a whole number"),
  effective_from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Effective from is not a valid date"),
  notes: z.string().trim().max(300).optional().or(z.literal("")),
});

function revalidateReportPaths(slug: string): void {
  revalidatePath(`/${slug}/hr/reports`);
  revalidatePath(`/${slug}/hr/reports/staff-movement`);
  revalidatePath(`/${slug}/hr/reports/labour-plan`);
  revalidatePath(`/${slug}/hr/reports/labour-plan/plan`);
}

/**
 * Create or replace the planned headcount for one site, designation and
 * effective date. Writing the same key again replaces the number rather than
 * stacking a duplicate, which is what a manager correcting a typo expects.
 */
export async function upsertLabourPlan(
  orgId: string,
  slug: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = LabourPlanSchema.safeParse({
    site: formData.get("site") ?? "",
    designation: formData.get("designation") ?? "",
    planned: String(formData.get("planned") ?? "").trim(),
    effective_from: formData.get("effective_from") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first.message, field: String(first.path[0]) };
  }

  const guard = await assertAdminUser(orgId);
  if ("error" in guard) return { ok: false, error: guard.error };

  const supabase: any = await createClient();
  const { error } = await supabase.from("labour_plans").upsert(
    {
      organisation_id: orgId,
      site: parsed.data.site,
      designation: parsed.data.designation,
      planned: Number(parsed.data.planned),
      effective_from: parsed.data.effective_from,
      notes: fieldOrNull(parsed.data.notes),
      created_by: guard.userId,
    },
    { onConflict: "organisation_id,site,designation,effective_from" },
  );
  if (error) return { ok: false, error: error.message ?? "Could not save the plan." };

  revalidateReportPaths(slug);
  return { ok: true };
}

export async function deleteLabourPlan(
  orgId: string,
  slug: string,
  id: string,
): Promise<ActionResult> {
  const guard = await assertAdminUser(orgId);
  if ("error" in guard) return { ok: false, error: guard.error };

  const supabase: any = await createClient();
  const { error } = await supabase
    .from("labour_plans")
    .delete()
    .eq("organisation_id", orgId)
    .eq("id", id);
  if (error) return { ok: false, error: error.message ?? "Could not delete the plan row." };

  revalidateReportPaths(slug);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Onboarding candidates
// ---------------------------------------------------------------------------

const ONBOARDING_STATUS_VALUES = [
  "screening",
  "medical",
  "teba",
  "training",
  "ready",
  "engaged",
  "unfit",
  "withdrawn",
] as const;

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Not a valid date")
  .optional()
  .or(z.literal(""));

const OnboardingSchema = z.object({
  surname: z.string().trim().min(1, "Surname is required").max(120),
  names: z.string().trim().min(1, "First names are required").max(120),
  id_number: z.string().trim().max(40).optional().or(z.literal("")),
  id_type: z.enum(["sa_id", "passport", "work_permit", "asylum", "other"]).default("sa_id"),
  designation: z.string().trim().min(1, "Designation is required").max(120),
  site: z.string().trim().min(1, "Site is required").max(120),
  status: z.enum(ONBOARDING_STATUS_VALUES),
  screening_booked_at: optionalDate,
  screened_at: optionalDate,
  medical_booked_at: optionalDate,
  medical_at: optionalDate,
  rfac_at: optionalDate,
  medical_status: z.enum(["fit", "unfit", "pending"]).optional().or(z.literal("")),
  medical_review_at: optionalDate,
  teba_done: z.string().optional(),
  training_booked: z.string().optional(),
  training_start_at: optionalDate,
  expected_passout_at: optionalDate,
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

function onboardingPayload(data: z.infer<typeof OnboardingSchema>) {
  return {
    surname: data.surname,
    names: data.names,
    id_number: fieldOrNull(data.id_number),
    id_type: data.id_type,
    designation: data.designation,
    site: data.site,
    status: data.status,
    screening_booked_at: fieldOrNull(data.screening_booked_at),
    screened_at: fieldOrNull(data.screened_at),
    medical_booked_at: fieldOrNull(data.medical_booked_at),
    medical_at: fieldOrNull(data.medical_at),
    rfac_at: fieldOrNull(data.rfac_at),
    medical_status: fieldOrNull(data.medical_status),
    medical_review_at: fieldOrNull(data.medical_review_at),
    teba_done: data.teba_done === "on" || data.teba_done === "true",
    training_booked: data.training_booked === "on" || data.training_booked === "true",
    training_start_at: fieldOrNull(data.training_start_at),
    expected_passout_at: fieldOrNull(data.expected_passout_at),
    notes: fieldOrNull(data.notes),
  };
}

function parseOnboarding(formData: FormData) {
  const read = (k: string) => formData.get(k) ?? "";
  return OnboardingSchema.safeParse({
    surname: read("surname"),
    names: read("names"),
    id_number: read("id_number"),
    id_type: read("id_type") || "sa_id",
    designation: read("designation"),
    site: read("site"),
    status: read("status") || "screening",
    screening_booked_at: read("screening_booked_at"),
    screened_at: read("screened_at"),
    medical_booked_at: read("medical_booked_at"),
    medical_at: read("medical_at"),
    rfac_at: read("rfac_at"),
    medical_status: read("medical_status"),
    medical_review_at: read("medical_review_at"),
    teba_done: read("teba_done"),
    training_booked: read("training_booked"),
    training_start_at: read("training_start_at"),
    expected_passout_at: read("expected_passout_at"),
    notes: read("notes"),
  });
}

export async function createOnboardingCandidate(
  orgId: string,
  slug: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseOnboarding(formData);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first.message, field: String(first.path[0]) };
  }
  const guard = await assertAdminUser(orgId);
  if ("error" in guard) return { ok: false, error: guard.error };

  const supabase: any = await createClient();
  const { error } = await supabase.from("onboarding_candidates").insert({
    organisation_id: orgId,
    ...onboardingPayload(parsed.data),
    created_by: guard.userId,
  });
  if (error) return { ok: false, error: error.message ?? "Could not add the candidate." };

  revalidatePath(`/${slug}/hr/reports/labour-plan`);
  revalidatePath(`/${slug}/hr/reports/labour-plan/tracker`);
  return { ok: true };
}

export async function updateOnboardingCandidate(
  orgId: string,
  slug: string,
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseOnboarding(formData);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first.message, field: String(first.path[0]) };
  }
  const guard = await assertAdminUser(orgId);
  if ("error" in guard) return { ok: false, error: guard.error };

  const supabase: any = await createClient();
  const { error } = await supabase
    .from("onboarding_candidates")
    .update(onboardingPayload(parsed.data))
    .eq("organisation_id", orgId)
    .eq("id", id);
  if (error) return { ok: false, error: error.message ?? "Could not update the candidate." };

  revalidatePath(`/${slug}/hr/reports/labour-plan`);
  revalidatePath(`/${slug}/hr/reports/labour-plan/tracker`);
  return { ok: true };
}

export async function deleteOnboardingCandidate(
  orgId: string,
  slug: string,
  id: string,
): Promise<ActionResult> {
  const guard = await assertAdminUser(orgId);
  if ("error" in guard) return { ok: false, error: guard.error };

  const supabase: any = await createClient();
  const { error } = await supabase
    .from("onboarding_candidates")
    .delete()
    .eq("organisation_id", orgId)
    .eq("id", id);
  if (error) return { ok: false, error: error.message ?? "Could not remove the candidate." };

  revalidatePath(`/${slug}/hr/reports/labour-plan`);
  revalidatePath(`/${slug}/hr/reports/labour-plan/tracker`);
  return { ok: true };
}

/**
 * Promote a candidate who has passed out onto the register as an employee.
 * Creates the employee row from the candidate's details with today as the
 * start date, links the two, and marks the candidate engaged. If the person
 * is already on the register by document number, the existing row is linked
 * rather than duplicated.
 */
export async function engageOnboardingCandidate(
  orgId: string,
  slug: string,
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const engagedAt = String(formData.get("engaged_at") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(engagedAt)) {
    return { ok: false, error: "Give the start date", field: "engaged_at" };
  }

  const guard = await assertAdminUser(orgId);
  if ("error" in guard) return { ok: false, error: guard.error };

  const supabase: any = await createClient();
  const { data: candidate } = await supabase
    .from("onboarding_candidates")
    .select("*")
    .eq("organisation_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (!candidate) return { ok: false, error: "That candidate is not in this workspace." };

  if (!candidate.id_number) {
    return {
      ok: false,
      error: "Add the candidate's document number before engaging them, so the register row is complete.",
      field: "id_number",
    };
  }

  const idCheck = validateIdentification(candidate.id_type, candidate.id_number);
  if (!idCheck.valid) return { ok: false, error: idCheck.reason, field: "id_number" };
  const idNumber = normaliseIdNumber(candidate.id_type, candidate.id_number);

  let employeeId: string | null = null;
  const { data: existing } = await supabase
    .from("employees")
    .select("id")
    .eq("organisation_id", orgId)
    .eq("id_number", idNumber)
    .maybeSingle();

  if (existing?.id) {
    employeeId = existing.id as string;
    await supabase
      .from("employees")
      .update({
        engaged_at: engagedAt,
        terminated_at: null,
        termination_reason: null,
        termination_notes: null,
        site: candidate.site,
        designation: candidate.designation,
      })
      .eq("organisation_id", orgId)
      .eq("id", employeeId);
  } else {
    const { data: created, error } = await supabase
      .from("employees")
      .insert({
        organisation_id: orgId,
        surname: candidate.surname,
        names: candidate.names,
        id_number: idNumber,
        id_type: candidate.id_type,
        site: candidate.site,
        designation: candidate.designation,
        engaged_at: engagedAt,
      })
      .select("id")
      .maybeSingle();
    if (error || !created?.id) {
      return { ok: false, error: friendlyError(error ?? { message: "Could not create the employee." }) };
    }
    employeeId = created.id as string;
  }

  const { error: linkError } = await supabase
    .from("onboarding_candidates")
    .update({ status: "engaged", employee_id: employeeId })
    .eq("organisation_id", orgId)
    .eq("id", id);
  if (linkError) return { ok: false, error: linkError.message };

  revalidatePath(`/${slug}/hr`);
  revalidatePath(`/${slug}/hr/employees`);
  revalidateReportPaths(slug);
  revalidatePath(`/${slug}/hr/reports/labour-plan/tracker`);
  return { ok: true };
}
