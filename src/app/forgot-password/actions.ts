"use server";

import { publicOrigin } from "@/lib/origin";
import { createClient } from "@/lib/supabase/server";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ResetRequestResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

const NEUTRAL =
  "If that email has a Certly account, a reset link is on its way. Check your inbox and your spam folder.";


export async function requestPasswordReset(
  formData: FormData,
): Promise<ResetRequestResult> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email || !email.includes("@") || email.length > 254) {
    return { ok: false, error: "Enter the email address on your account." };
  }

  const origin = await publicOrigin();
  const redirectTo = `${origin}/auth/callback`;

  const supabase: any = await createClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  return { ok: true, message: NEUTRAL };
}
