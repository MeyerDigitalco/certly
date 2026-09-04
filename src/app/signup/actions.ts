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
});

/**
 * Create a new workspace: an auth user (who sets their own password, so
 * has_password is true from the start) plus an organisation and owner
 * membership via the provision_organisation RPC. On success it signs the
 * user in and redirects into their workspace.
 */
export async function signUp(formData: FormData): Promise<SignUpResult | void> {
  const parsed = SignupSchema.safeParse({
    company: formData.get("company"),
    slug: formData.get("slug"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first.message, field: String(first.path[0]) };
  }
  const { company, slug, email, password } = parsed.data;

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

  let userId: string;
  if (existingUser) {
    userId = existingUser.id;
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: { ...(existingUser.user_metadata ?? {}), has_password: true },
    });
    if (error) return { ok: false, error: error.message };
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
  }

  const { error: provErr } = await admin.rpc("provision_organisation", {
    p_slug: slug,
    p_name: company,
    p_user_id: userId,
  });
  if (provErr) {
    // Roll back a freshly-created user so a failed signup can be retried.
    if (!existingUser) await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: provErr.message };
  }

  const supabase: any = await createClient();
  await supabase.auth.signInWithPassword({ email, password });

  redirect(`/${slug}/hr`);
}
