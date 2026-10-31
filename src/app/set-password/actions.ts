"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { publicOrigin } from "@/lib/origin";
import { buildPasswordChanged } from "@/lib/email/security";
import { sendEmail } from "@/lib/email/send";

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

  // Told, not asked. The password has already changed by this point, so a
  // sending failure must not be reported as a failure to change it, or the
  // person tries again and ends up not knowing which password is live.
  if (user.email) {
    const origin = await publicOrigin();
    const notice = buildPasswordChanged({
      email: user.email,
      origin,
      when: new Date(),
    });
    const outcome = await sendEmail({
      to: user.email,
      subject: notice.subject,
      html: notice.html,
      text: notice.text,
    });
    if (outcome.status === "failed") {
      console.error(`password.notice failed: ${outcome.reason}`);
    }
  }

  redirect(safeRedirectPath(next));
}
