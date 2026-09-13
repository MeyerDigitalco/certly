"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/safe-redirect";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type SetPasswordResult = { ok: false; error: string };

/**
 * Set (or change) the signed-in user's password and mark has_password so
 * they are no longer forced through this screen on future logins.
 */
export async function setPassword(
  formData: FormData,
): Promise<SetPasswordResult | void> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const next = String(formData.get("next") ?? "");

  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { ok: false, error: "The two passwords do not match." };
  }

  const supabase: any = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.auth.updateUser({
    password,
    data: { has_password: true },
  });
  if (error) return { ok: false, error: error.message };

  redirect(safeRedirectPath(next));
}
