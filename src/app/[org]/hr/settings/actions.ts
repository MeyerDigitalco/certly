"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertWritable } from "@/lib/billing/access";



type Result =
  | { ok: true; email: string; password: string }
  | { ok: false; error: string };
type SimpleResult = { ok: true } | { ok: false; error: string };

/**
 * A readable one-time password a person can retype off a phone screen.
 * Every choice comes from the system CSPRNG: Math.random is seeded state a
 * caller can observe and roll forward, which for a password reset would let
 * someone who triggered one reset predict the next.
 */
function generateTempPassword(): string {
  const adjectives = ["Bright","Swift","Bold","Calm","Fair","Kind","Loyal","Sharp","Quiet","Solid","True","Warm","Wise","Brave","Quick","Steady","Fresh","Clear","Strong"];
  const nouns = ["River","Mountain","Ember","Beacon","Harbour","Anchor","Falcon","Meadow","Summit","Ridge","Valley","Torch","Cedar","Forest","Delta","Compass","Shield"];
  const pick = <T,>(a: T[]): T => a[randomInt(a.length)];
  const digits = String(1000 + randomInt(9000));
  return `${pick(adjectives)}-${pick(nouns)}-${digits}-${randomToken(4)}`;
}

/** Uniform integer in [0, max) from the system CSPRNG, without modulo bias. */
function randomInt(max: number): number {
  const limit = Math.floor(0xffffffff / max) * max;
  const buf = new Uint32Array(1);
  let v = 0;
  do {
    crypto.getRandomValues(buf);
    v = buf[0];
  } while (v >= limit);
  return v % max;
}

function randomToken(length: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i += 1) out += alphabet[randomInt(alphabet.length)];
  return out;
}

/**
 * True when this workspace is the only one the user belongs to.
 *
 * An owner may reset a password only for an account that exists solely
 * because they created it. Anyone who belongs to a second workspace has a
 * credential that is not this owner's to change, and changing it would lock
 * them out of somebody else's data.
 */
async function isSoleMembership(userId: string, orgId: string): Promise<boolean> {
  const admin: any = createAdminClient();
  const { data } = await admin
    .from("org_members")
    .select("organisation_id")
    .eq("user_id", userId);
  const rows = (data ?? []) as Array<{ organisation_id: string }>;
  return rows.length === 1 && rows[0].organisation_id === orgId;
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
 * addMember was removed. It created an auth account, or attached an existing
 * one, without the person ever agreeing. See invite-actions.ts: access now
 * begins when the invitee signs in as the invited address and accepts.
 */

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

  // Promotion grows what the workspace can do, so it is gated on billing.
  // Demotion is not, because taking rights away should never be blocked by an
  // unpaid invoice. Removal and password reset stay open for the same reason.
  if (role === "owner" || role === "admin") {
    const blocked = await assertWritable(orgId);
    if (blocked) return { ok: false, error: blocked };
  }

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

  if (!(await isSoleMembership(userId, orgId))) {
    return {
      ok: false,
      error:
        "This person belongs to another Certly workspace, so their password is not yours to reset. Ask them to use Forgot your password on the sign in page.",
    };
  }

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
