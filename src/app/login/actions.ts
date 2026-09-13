"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/safe-redirect";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type SignInResult = { ok: false; error: string };

/**
 * Password sign-in. On success this redirects (so the promise never
 * resolves); it only returns a value when there is an error to show.
 * First login with a generated temp password (has_password !== true)
 * is forced through /set-password.
 */
export async function signIn(
  formData: FormData,
): Promise<SignInResult | void> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeRedirectPath(String(formData.get("next") ?? ""), "");

  if (!email || !password) {
    return { ok: false, error: "Enter your email and password." };
  }

  const supabase: any = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    return { ok: false, error: "Email or password is incorrect." };
  }

  const hasPassword = data.user?.user_metadata?.has_password === true;
  if (!hasPassword) {
    redirect(
      `/set-password${next ? `?next=${encodeURIComponent(next)}` : ""}`,
    );
  }

  redirect(next || "/");
}
