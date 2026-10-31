"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSuperadmin } from "@/lib/admin/superadmin";

export type AdminResult = { ok: true } | { ok: false; error: string };

/**
 * Turn billing off, or back on, for one workspace.
 *
 * Re-checks the caller here rather than trusting the page that drew the
 * button, because this writes through the service role and the service role
 * is the one thing the billing guard trigger lets through.
 */
export async function setBillingExempt(
  formData: FormData,
): Promise<AdminResult> {
  const orgId = String(formData.get("orgId") ?? "");
  const exempt = String(formData.get("exempt") ?? "") === "1";
  if (!orgId) return { ok: false, error: "Missing workspace." };

  const supabase: any = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isSuperadmin(user?.email)) {
    return { ok: false, error: "Not allowed." };
  }

  const admin: any = createAdminClient();
  const { error } = await admin
    .from("organisations")
    .update({ billing_exempt: exempt })
    .eq("id", orgId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin");
  return { ok: true };
}
