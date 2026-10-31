"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findAuthUserByEmail } from "@/lib/auth-users";
import { hashInviteToken, inviteState } from "@/lib/invitations";

export type CreateAccountResult = { ok: false; error: string };

/**
 * Create an account for someone who was invited and has never used Certly.
 *
 * Until now the invitation screen told a stranger to use Forgot your password
 * on an account that did not exist, which sends nothing and tells them
 * nothing, so an invited person simply could not get in.
 *
 * The invitation token is what authorises this. It is thirty-two random bytes
 * that went to one address, so holding it proves the same thing a password
 * reset link proves. It is therefore allowed to create an account for that
 * address and nothing else: if the address already has an account this
 * refuses, because otherwise a forwarded link would be a way to take over
 * somebody's existing login.
 *
 * Accepting is still a separate, deliberate click. This only gets them to the
 * screen that asks.
 */
export async function createInvitedAccount(
  formData: FormData,
): Promise<CreateAccountResult | void> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!token) return { ok: false, error: "This link is not valid." };
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { ok: false, error: "The two passwords do not match." };
  }

  const admin: any = createAdminClient();
  const { data: invite } = await admin
    .from("invitations")
    .select("email, expires_at, accepted_at, revoked_at")
    .eq("token_hash", hashInviteToken(token))
    .maybeSingle();

  // Checked against no signed in address, because the whole point of this
  // path is that there is no account yet.
  const state = inviteState(invite ?? null, null);
  if (state !== "valid") {
    return {
      ok: false,
      error:
        state === "expired"
          ? "This invitation has expired. Ask for a new one."
          : state === "accepted"
            ? "This invitation has already been used."
            : state === "revoked"
              ? "This invitation was withdrawn."
              : "This link is not valid.",
    };
  }

  const email = String(invite.email);

  const existing = await findAuthUserByEmail(admin, email);
  if (existing) {
    return {
      ok: false,
      error:
        "That address already has a Certly account. Sign in instead, then open this link again.",
    };
  }

  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    // Confirmed on creation because the invitation arrived at this address
    // and was opened from it, which is the same proof a confirmation mail
    // would collect, and a second round trip loses people.
    email_confirm: true,
    user_metadata: { has_password: true },
  });
  if (createError) {
    return {
      ok: false,
      error: createError.message ?? "Your account could not be created.",
    };
  }

  const supabase: any = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) {
    redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  redirect(`/invite/${token}`);
}
