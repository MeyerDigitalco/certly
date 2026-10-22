"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicOrigin } from "@/lib/origin";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type SignUpResult =
  | { ok: false; error: string; field?: string }
  | { ok: true; checkEmail: string };

const SignupSchema = z.object({
  company: z.string().trim().min(2, "Company name is required"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/,
      "Use 3 to 50 letters, numbers or hyphens",
    ),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  sector: z.enum(["mining", "general"], { message: "Choose the sector you work in" }),
});

/**
 * Create a new workspace.
 *
 * A new address goes through Supabase's own sign-up, which sends a
 * confirmation email when "Confirm email" is on in the project's auth
 * settings. The workspace is not created until the address is confirmed:
 * what was asked for is kept in the user's metadata as pending_workspace,
 * and the /workspace page provisions it on the first confirmed visit. That
 * way nobody can squat a slug or hold a workspace with an address they do
 * not own. If confirmation is switched off, sign-up returns a session at
 * once and the workspace is provisioned here immediately.
 *
 * This endpoint is unauthenticated, so it must never touch the credentials
 * of an account that already exists. If the address is already registered,
 * the only way through is to be signed in as that account already; anything
 * else is refused. Setting a password here for an existing address would
 * hand any stranger who knows a customer's email address their account.
 */
export async function signUp(formData: FormData): Promise<SignUpResult | void> {
  const parsed = SignupSchema.safeParse({
    company: formData.get("company"),
    slug: formData.get("slug"),
    email: formData.get("email"),
    password: formData.get("password"),
    sector: formData.get("sector") ?? "",
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first.message, field: String(first.path[0]) };
  }
  const { company, slug, email, password, sector } = parsed.data;

  const admin: any = createAdminClient();

  // Reject a taken slug up front for a clean message.
  const { data: existingOrg } = await admin
    .from("organisations")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existingOrg) {
    return { ok: false, error: "That workspace URL is taken.", field: "slug" };
  }

  // Reuse an existing account if the email already has one, otherwise create.
  const { data: userList } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const existingUser = (userList?.users ?? []).find(
    (u: any) => (u.email ?? "").toLowerCase() === email,
  );

  const supabase: any = await createClient();
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  if (existingUser) {
    if (!sessionUser || sessionUser.id !== existingUser.id) {
      return {
        ok: false,
        error:
          "That email address already has a Certly account. Sign in first, then create the new workspace.",
        field: "email",
      };
    }
    const { error: provErr } = await admin.rpc("provision_organisation", {
      p_slug: slug,
      p_name: company,
      p_user_id: existingUser.id,
      p_sector: sector,
    });
    if (provErr) return { ok: false, error: provErr.message };
    redirect(`/${slug}/hr`);
  }

  const origin = await publicOrigin();
  const { data: signedUp, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/workspace`,
      data: {
        has_password: true,
        pending_workspace: { company, slug, sector },
      },
    },
  });
  if (signUpError || !signedUp?.user) {
    return { ok: false, error: signUpError?.message ?? "Could not create account." };
  }

  if (signedUp.session) {
    const { error: provErr } = await admin.rpc("provision_organisation", {
      p_slug: slug,
      p_name: company,
      p_user_id: signedUp.user.id,
      p_sector: sector,
    });
    if (provErr) {
      await admin.auth.admin.deleteUser(signedUp.user.id);
      return { ok: false, error: provErr.message };
    }
    await admin.auth.admin.updateUserById(signedUp.user.id, {
      user_metadata: { has_password: true },
    });
    redirect(`/${slug}/hr`);
  }

  return { ok: true, checkEmail: email };
}
