"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Result =
  | { ok: true; email: string; password: string }
  | { ok: false; error: string };
type SimpleResult = { ok: true } | { ok: false; error: string };

function generateTempPassword(): string {
  const adjectives = ["Bright","Swift","Bold","Calm","Fair","Kind","Loyal","Sharp","Quiet","Solid","True","Warm","Wise","Brave","Quick","Steady","Fresh","Clear","Strong"];
  const nouns = ["River","Mountain","Ember","Beacon","Harbour","Anchor","Falcon","Meadow","Summit","Ridge","Valley","Torch","Cedar","Forest","Delta","Compass","Shield"];
  const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
  return `${pick(adjectives)}-${pick(nouns)}-${String(Math.floor(1000 + Math.random() * 9000))}`;
}

async function assertOwner(orgId: string): Promise<string | null> {
  const supabase: any = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "Not signed in.";
  const { data: mem } = await supabase
    .from("org_members")
    .select("role").eq("organisation_id", orgId).eq("user_id", user.id).maybeSingle();
  if (!mem || mem.role !== "owner") return "Only the owner can manage members.";
  return null;
}

/**
 * Add a new member. If the email already has a Certly account, we just
 * add the membership row. Otherwise we create the auth user with a
 * generated temp password and add the membership. Either way, we return
 * the temp password so the owner can share it.
 */
export async function addMember(formData: FormData): Promise<Result> {
  const orgId = String(formData.get("orgId") ?? "");
  const role = String(formData.get("role") ?? "admin") as "admin" | "viewer" | "owner";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (!["admin","viewer","owner"].includes(role)) {
    return { ok: false, error: "Invalid role." };
  }
  const err = await assertOwner(orgId);
  if (err) return { ok: false, error: err };

  const admin: any = createAdminClient();
  const password = generateTempPassword();
  const { data: userList } = await admin.auth.admin.listUsers({ page: 1, perPage: 500 });
  const existing = (userList?.users ?? []).find((u: any) =>
    (u.email ?? "").toLowerCase() === email);

  let userId: string;
  if (existing) {
    // Existing Certly user: reset their password (so the owner has one to share).
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password, email_confirm: true,
      user_metadata: { ...(existing.user_metadata ?? {}), has_password: false },
    });
    if (error) return { ok: false, error: error.message };
    userId = existing.id;
  } else {
    const { data: created, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { has_password: false },
    });
    if (error || !created.user) return { ok: false, error: error?.message ?? "Could not create user." };
    userId = created.user.id;
  }

  const { error: memErr } = await admin.from("org_members").upsert({
    organisation_id: orgId, user_id: userId, role,
  }, { onConflict: "organisation_id,user_id" });
  if (memErr) return { ok: false, error: memErr.message };

  const { data: org } = await admin.from("organisations").select("slug").eq("id", orgId).single();
  if (org?.slug) revalidatePath(`/${org.slug}/hr/settings`);

  return { ok: true, email, password };
}

export async function removeMember(formData: FormData): Promise<SimpleResult> {
  const orgId = String(formData.get("orgId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const err = await assertOwner(orgId);
  if (err) return { ok: false, error: err };
  const admin: any = createAdminClient();

  // Refuse to leave the org with no owners.
  const { data: cur } = await admin.from("org_members").select("role")
    .eq("organisation_id", orgId).eq("user_id", userId).maybeSingle();
  if (cur?.role === "owner") {
    const { count } = await admin.from("org_members")
      .select("*", { count: "exact", head: true })
      .eq("organisation_id", orgId).eq("role", "owner");
    if ((count ?? 0) <= 1) {
      return { ok: false, error: "Cannot remove the last owner. Promote another member first." };
    }
  }

  const { error } = await admin.from("org_members").delete()
    .eq("organisation_id", orgId).eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  const { data: org } = await admin.from("organisations").select("slug").eq("id", orgId).single();
  if (org?.slug) revalidatePath(`/${org.slug}/hr/settings`);
  return { ok: true };
}

export async function changeMemberRole(formData: FormData): Promise<SimpleResult> {
  const orgId = String(formData.get("orgId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "") as "owner" | "admin" | "viewer";
  if (!["owner","admin","viewer"].includes(role)) return { ok: false, error: "Invalid role." };
  const err = await assertOwner(orgId);
  if (err) return { ok: false, error: err };

  const admin: any = createAdminClient();
  // If demoting an owner, make sure another owner exists.
  if (role !== "owner") {
    const { data: cur } = await admin.from("org_members").select("role")
      .eq("organisation_id", orgId).eq("user_id", userId).maybeSingle();
    if (cur?.role === "owner") {
      const { count } = await admin.from("org_members")
        .select("*", { count: "exact", head: true })
        .eq("organisation_id", orgId).eq("role", "owner");
      if ((count ?? 0) <= 1) {
        return { ok: false, error: "Promote another member to owner first." };
      }
    }
  }
  const { error } = await admin.from("org_members").update({ role })
    .eq("organisation_id", orgId).eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  const { data: org } = await admin.from("organisations").select("slug").eq("id", orgId).single();
  if (org?.slug) revalidatePath(`/${org.slug}/hr/settings`);
  return { ok: true };
}

export async function resetMemberPassword(formData: FormData): Promise<Result> {
  const orgId = String(formData.get("orgId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const err = await assertOwner(orgId);
  if (err) return { ok: false, error: err };

  const admin: any = createAdminClient();
  // Verify they are a member (defence in depth)
  const { data: cur } = await admin.from("org_members").select("user_id")
    .eq("organisation_id", orgId).eq("user_id", userId).maybeSingle();
  if (!cur) return { ok: false, error: "That user isn't a member of this workspace." };

  const { data: userList } = await admin.auth.admin.listUsers({ page: 1, perPage: 500 });
  const target = (userList?.users ?? []).find((u: any) => u.id === userId);
  if (!target) return { ok: false, error: "User not found." };

  const password = generateTempPassword();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password, email_confirm: true,
    user_metadata: { ...(target.user_metadata ?? {}), has_password: false },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, email: target.email ?? "unknown", password };
}
