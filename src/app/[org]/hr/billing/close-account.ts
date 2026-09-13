"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type CloseResult = { ok: false; error: string };

const CERT_BUCKET = "certificates";
const IDENTITY_BUCKET = "identity-documents";
const COMPANY_BUCKET = "company-documents";
const REMOVE_BATCH = 100;

/**
 * Close a workspace and destroy everything in it.
 *
 * Deliberately not gated on the billing state. Every other write stops when a
 * workspace goes read only, but a customer must always be able to take their
 * data out and then have it erased, whether or not their last invoice was
 * paid. POPIA section 14 does not have an exception for people who owe you
 * money, and holding personal information hostage over a debt is exactly the
 * kind of thing the Information Regulator exists for.
 *
 * Owner only, and only the owner of this workspace. Admins run the register
 * and cannot end it.
 *
 * Order matters. Storage objects are listed and removed before the rows that
 * point at them, because once the rows are gone the paths are unrecoverable
 * and the files would sit in the bucket forever with nothing referencing them.
 * The organisation row is deleted last and cascades the tables.
 */
export async function closeAccount(
  formData: FormData,
): Promise<CloseResult | void> {
  const orgId = String(formData.get("orgId") ?? "");
  const confirmation = String(formData.get("confirm") ?? "").trim();
  const expected = String(formData.get("expected") ?? "").trim();

  if (!orgId) return { ok: false, error: "Missing workspace." };

  if (!expected || confirmation !== expected) {
    return {
      ok: false,
      error: `Type ${expected} exactly to confirm. Nothing has been deleted.`,
    };
  }

  const supabase: any = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: membership } = await supabase
    .from("org_members")
    .select("role")
    .eq("organisation_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || membership.role !== "owner") {
    return {
      ok: false,
      error: "Only the owner of this workspace can close it.",
    };
  }

  const admin: any = createAdminClient();

  const [certRows, identityRows, companyRows] = await Promise.all([
    admin
      .from("certifications")
      .select("cert_file_path")
      .eq("organisation_id", orgId)
      .not("cert_file_path", "is", null),
    admin
      .from("employees")
      .select("id_file_path")
      .eq("organisation_id", orgId)
      .not("id_file_path", "is", null),
    admin
      .from("company_documents")
      .select("file_path")
      .eq("organisation_id", orgId)
      .not("file_path", "is", null),
  ]);

  const certPaths = paths(certRows.data, "cert_file_path");
  const identityPaths = paths(identityRows.data, "id_file_path");
  const companyPaths = paths(companyRows.data, "file_path");

  await Promise.all([
    removeAll(admin, CERT_BUCKET, certPaths),
    removeAll(admin, IDENTITY_BUCKET, identityPaths),
    removeAll(admin, COMPANY_BUCKET, companyPaths),
  ]);

  // Anything the listing missed, for example a file whose row was already
  // gone, is caught by sweeping the workspace's own folder in each bucket.
  await Promise.all([
    sweepFolder(admin, CERT_BUCKET, orgId),
    sweepFolder(admin, IDENTITY_BUCKET, orgId),
    sweepFolder(admin, COMPANY_BUCKET, orgId),
  ]);

  const { error } = await admin
    .from("organisations")
    .delete()
    .eq("id", orgId);

  if (error) {
    return {
      ok: false,
      error:
        "The workspace could not be closed. Nothing further was deleted. Contact us and we will finish it by hand.",
    };
  }

  redirect("/?closed=1");
}

function paths(rows: unknown, key: string): string[] {
  return ((rows ?? []) as Array<Record<string, string | null>>)
    .map((row) => row[key])
    .filter((value): value is string => Boolean(value));
}

async function removeAll(
  admin: any,
  bucket: string,
  all: string[],
): Promise<void> {
  for (let i = 0; i < all.length; i += REMOVE_BATCH) {
    const batch = all.slice(i, i + REMOVE_BATCH);
    if (batch.length > 0) {
      await admin.storage.from(bucket).remove(batch);
    }
  }
}

/**
 * Every object this workspace owns lives under a folder named for its id, and
 * the storage policies key off that same first path segment. Listing the
 * folder and removing what is in it catches orphans the table scan could not
 * see.
 */
async function sweepFolder(
  admin: any,
  bucket: string,
  orgId: string,
): Promise<void> {
  const { data } = await admin.storage
    .from(bucket)
    .list(orgId, { limit: 1000 });
  const names = ((data ?? []) as Array<{ name: string }>)
    .map((entry) => `${orgId}/${entry.name}`)
    .filter((name) => !name.endsWith("/.emptyFolderPlaceholder"));
  await removeAll(admin, bucket, names);
}
