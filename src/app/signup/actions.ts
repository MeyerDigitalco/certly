"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type SignUpResult = { ok: false; error: string; field?: string };

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
 * Create a new workspace: an auth user (who sets their own password, so
 * has_password is true from the start) plus an organisation and owner
 * membership via the provision_organisation RPC. On success it signs the
 * user in and redirects into their workspace.
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

  let userId: string;
  let createdNewUser = false;
  if (existingUser) {
    if (!sessionUser || sessionUser.id !== existingUser.id) {
      return {
        ok: false,
        error:
          "That email address already has a Certly account. Sign in first, then create the new workspace.",
        field: "email",
      };
    }
    userId = existingUser.id;
  } else {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { has_password: true },
    });
    if (error || !created?.user) {
      return { ok: false, error: error?.message ?? "Could not create account." };
    }
    userId = created.user.id;
    createdNewUser = true;
  }

  const { error: provErr } = await admin.rpc("provision_organisation", {
    p_slug: slug,
    p_name: company,
    p_user_id: userId,
    p_sector: sector,
  });
  if (provErr) {
    // Roll back a freshly-created user so a failed signup can be retried.
    if (createdNewUser) await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: provErr.message };
  }

  if (createdNewUser) {
    await supabase.auth.signInWithPassword({ email, password });
  }

  redirect(`/${slug}/hr`);
}
