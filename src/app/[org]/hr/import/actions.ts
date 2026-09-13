"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertWritable } from "@/lib/billing/access";
import { parseImport, type ImportPlan } from "@/lib/hr/import";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type PreviewResult =
  | { ok: true; plan: ImportPlan }
  | { ok: false; error: string };

export type CommitResult =
  | { ok: true; people: number; certificates: number; types: number }
  | { ok: false; error: string };

const MAX_BYTES = 4 * 1024 * 1024;

async function assertAdmin(
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
    return { error: "You do not have permission to import into this workspace." };
  }
  const blocked = await assertWritable(orgId);
  if (blocked) return { error: blocked };
  return { userId: user.id };
}

async function contextFor(orgId: string): Promise<{
  knownTrainingTypes: string[];
  knownIdNumbers: string[];
}> {
  const supabase: any = await createClient();
  const [types, employees] = await Promise.all([
    supabase
      .from("training_types")
      .select("name")
      .eq("organisation_id", orgId),
    supabase
      .from("employees")
      .select("id_number")
      .eq("organisation_id", orgId),
  ]);
  return {
    knownTrainingTypes: ((types.data ?? []) as Array<{ name: string }>).map(
      (t) => t.name,
    ),
    knownIdNumbers: (
      (employees.data ?? []) as Array<{ id_number: string }>
    ).map((e) => e.id_number),
  };
}

/**
 * Read the file and describe what would happen. Writes nothing.
 */
export async function previewImport(
  orgId: string,
  formData: FormData,
): Promise<PreviewResult> {
  const guard = await assertAdmin(orgId);
  if ("error" in guard) return { ok: false, error: guard.error };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a CSV file." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "That file is larger than 4 MB." };
  }

  const text = await file.text();
  const plan = parseImport(text, await contextFor(orgId));
  return { ok: true, plan };
}

/**
 * Apply an import.
 *
 * The file is parsed again here rather than trusting a plan posted back from
 * the browser. A plan is a rendering of a file; re-reading the file is the
 * only way to be sure the rows written are the rows that were shown, and it
 * closes the gap where a modified payload could carry someone else's employee
 * id or a training type from another workspace.
 *
 * Rows with errors are skipped, never partially written. Employees are matched
 * on document number within this workspace only, so an import can update
 * people who are already on the register without ever reaching another one.
 */
export async function commitImport(
  orgId: string,
  slug: string,
  formData: FormData,
): Promise<CommitResult> {
  const guard = await assertAdmin(orgId);
  if ("error" in guard) return { ok: false, error: guard.error };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a CSV file." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "That file is larger than 4 MB." };
  }

  const supabase: any = await createClient();
  const text = await file.text();
  const plan = parseImport(text, await contextFor(orgId));

  if (plan.fatal) return { ok: false, error: plan.fatal };
  if (plan.missingColumns.length > 0) {
    return {
      ok: false,
      error: `That file is missing: ${plan.missingColumns.join(", ")}.`,
    };
  }
  if (plan.validRows.length === 0) {
    return { ok: false, error: "No rows in that file can be imported." };
  }

  // Training types first, so certificates have something to point at.
  const { data: existingTypes } = await supabase
    .from("training_types")
    .select("id, name, sort_order")
    .eq("organisation_id", orgId);

  const typeByName = new Map<string, string>();
  let maxSort = 0;
  for (const t of (existingTypes ?? []) as Array<{
    id: string;
    name: string;
    sort_order: number;
  }>) {
    typeByName.set(t.name.toLowerCase(), t.id);
    maxSort = Math.max(maxSort, t.sort_order);
  }

  let typesCreated = 0;
  for (const name of plan.newTrainingTypes) {
    if (typeByName.has(name.toLowerCase())) continue;
    maxSort += 10;
    const { data: created, error } = await supabase
      .from("training_types")
      .insert({
        organisation_id: orgId,
        name,
        sort_order: maxSort,
        active: true,
      })
      .select("id")
      .maybeSingle();
    if (error || !created?.id) continue;
    typeByName.set(name.toLowerCase(), created.id);
    typesCreated += 1;
  }

  const { data: existingPeople } = await supabase
    .from("employees")
    .select("id, id_number")
    .eq("organisation_id", orgId);
  const employeeByNumber = new Map<string, string>();
  for (const e of (existingPeople ?? []) as Array<{
    id: string;
    id_number: string;
  }>) {
    employeeByNumber.set(e.id_number.toLowerCase(), e.id);
  }

  let peopleCreated = 0;
  let certificates = 0;

  for (const row of plan.validRows) {
    const key = row.idNumber.toLowerCase();
    let employeeId = employeeByNumber.get(key);

    if (!employeeId) {
      const { data: created, error } = await supabase
        .from("employees")
        .insert({
          organisation_id: orgId,
          surname: row.surname,
          names: row.names,
          id_number: row.idNumber,
          id_type: row.idType,
          id_country: row.idCountry,
          id_expiry: row.idExpiry,
          site: row.site,
          superior: row.superior,
          designation: row.designation,
        })
        .select("id")
        .maybeSingle();
      if (error || !created?.id) continue;
      employeeId = created.id as string;
      employeeByNumber.set(key, employeeId);
      peopleCreated += 1;
    }

    if (!row.trainingType) continue;
    const typeId = typeByName.get(row.trainingType.toLowerCase());
    if (!typeId) continue;

    const { error: certError } = await supabase.from("certifications").upsert(
      {
        organisation_id: orgId,
        employee_id: employeeId,
        training_type_id: typeId,
        training_date: row.trainingDate,
        expiry_date: row.expiryDate,
        source: "import",
        created_by: guard.userId,
      },
      { onConflict: "employee_id,training_type_id" },
    );
    if (!certError) certificates += 1;
  }

  revalidatePath(`/${slug}/hr`);
  revalidatePath(`/${slug}/hr/employees`);
  revalidatePath(`/${slug}/hr/renewals`);

  return {
    ok: true,
    people: peopleCreated,
    certificates,
    types: typesCreated,
  };
}
