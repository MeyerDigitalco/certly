"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ResetRequestResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

const NEUTRAL =
  "If that email has a Certly account, a reset link is on its way. Check your inbox and your spam folder.";

async function originFromRequest(): Promise<string> {
  const h = await headers();
  const forwardedHost = h.get("x-forwarded-host");
  const host = forwardedHost ?? h.get("host");
  if (!host) return "";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");
  return `${proto}://${host}`;
}

export async function requestPasswordReset(
  formData: FormData,
): Promise<ResetRequestResult> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email || !email.includes("@") || email.length > 254) {
    return { ok: false, error: "Enter the email address on your account." };
  }

  const origin = await originFromRequest();
  const redirectTo = `${origin}/auth/callback`;

  const supabase: any = await createClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  return { ok: true, message: NEUTRAL };
}
