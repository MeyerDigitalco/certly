"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { publicOrigin } from "@/lib/origin";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertWritable } from "@/lib/billing/access";
import {
  newInviteToken,
  hashInviteToken,
  inviteLink,
  normaliseInviteEmail,
} from "@/lib/invitations";
import { buildInvitation } from "@/lib/email/invitation";
import { sendEmail } from "@/lib/email/send";

/** Matches the database default on invitations.expires_at. */
const INVITE_DAYS = 14;

/**
 * Whether the invited person was emailed.
 *
 * Reported honestly rather than assumed, because the link on screen is the
 * fallback and the owner can only decide whether to use it if they are told
 * which happened.
 */
export type InviteDelivery = "sent" | "skipped" | "failed";

export type InviteResult =
  | { ok: true; email: string; link: string; delivery: InviteDelivery }
  | { ok: false; error: string };

export type SimpleResult = { ok: true } | { ok: false; error: string };

async function assertOwner(orgId: string): Promise<
  { error: string } | { userId: string; userEmail: string }
> {
  if (!orgId) return { error: "Missing workspace." };
  const supabase: any = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  const { data: mem } = await supabase
    .from("org_members")
    .select("role")
    .eq("organisation_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!mem || mem.role !== "owner") {
    return { error: "Only the owner can invite people to this workspace." };
  }
  return { userId: user.id, userEmail: String(user.email ?? "") };
}


/**
 * Invite someone to this workspace.
 *
 * Creates a claim on an email address, not a membership. Nothing changes for
 * the invitee until they sign in as that address and accept, which is the
 * whole point: this register holds other people's identity numbers and
 * nobody should be handed access to it without agreeing to hold it.
 *
 * The raw token is returned once, in the link. Only its hash is stored, so
 * this response is the only chance to copy it.
 */
export async function inviteMember(
  formData: FormData,
): Promise<InviteResult> {
  const orgId = String(formData.get("orgId") ?? "");
  const role = String(formData.get("role") ?? "admin");
  const email = normaliseInviteEmail(String(formData.get("email") ?? ""));

  const guard = await assertOwner(orgId);
  if ("error" in guard) return { ok: false, error: guard.error };

  // Inviting grows the workspace, so it is gated on billing. Revoking is not:
  // an owner behind on an invoice must still be able to take access away.
  // These writes go through the service role, which bypasses RLS and the
  // billing trigger, so the gate has to be here or it is nowhere.
  const blocked = await assertWritable(orgId);
  if (blocked) return { ok: false, error: blocked };

  if (!z.string().email().max(254).safeParse(email).success) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (!["owner", "admin", "viewer"].includes(role)) {
    return { ok: false, error: "Invalid role." };
  }

  const admin: any = createAdminClient();

  const { data: existingUsers } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const existing = ((existingUsers?.users ?? []) as Array<{
    id: string;
    email: string | null;
  }>).find((u) => (u.email ?? "").toLowerCase() === email);

  if (existing) {
    const { data: alreadyMember } = await admin
      .from("org_members")
      .select("user_id")
      .eq("organisation_id", orgId)
      .eq("user_id", existing.id)
      .maybeSingle();
    if (alreadyMember) {
      return { ok: false, error: "That person is already in this workspace." };
    }
  }

  const token = newInviteToken();

  // Replace any outstanding invitation for this address rather than stacking
  // them up, so the newest link is the only one that works.
  await admin
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("organisation_id", orgId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .ilike("email", email);

  const { error } = await admin.from("invitations").insert({
    organisation_id: orgId,
    email,
    role,
    token_hash: hashInviteToken(token),
    invited_by: guard.userId,
  });
  if (error) {
    return {
      ok: false,
      error: error.message ?? "The invitation could not be created.",
    };
  }

  const { data: org } = await admin
    .from("organisations")
    .select("slug, name")
    .eq("id", orgId)
    .maybeSingle();
  if (org?.slug) revalidatePath(`/${org.slug}/hr/settings`);

  const origin = await publicOrigin();
  const link = inviteLink(origin, token);

  // The invitation already exists at this point. Email is an attempt, not a
  // condition: a sending failure must not leave a usable invitation reported
  // as a failure, because the owner would then invite the same person again.
  const message = buildInvitation({
    orgName: org?.name ?? "this workspace",
    invitedBy: guard.userEmail || "The owner",
    role,
    email,
    link,
    days: INVITE_DAYS,
  });

  const outcome = await sendEmail({
    to: email,
    subject: message.subject,
    html: message.html,
    text: message.text,
    replyTo: guard.userEmail || undefined,
  });

  if (outcome.status === "failed") {
    console.error(`invite.email failed: ${outcome.reason}`);
  } else if (outcome.status === "skipped") {
    console.info(`invite.email skipped: ${outcome.reason}`);
  }

  const delivery: InviteDelivery =
    outcome.status === "sent"
      ? "sent"
      : outcome.status === "failed"
        ? "failed"
        : "skipped";

  return { ok: true, email, link, delivery };
}

export async function revokeInvitation(
  formData: FormData,
): Promise<SimpleResult> {
  const orgId = String(formData.get("orgId") ?? "");
  const invitationId = String(formData.get("invitationId") ?? "");

  const guard = await assertOwner(orgId);
  if ("error" in guard) return { ok: false, error: guard.error };

  const admin: any = createAdminClient();
  const { error } = await admin
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("organisation_id", orgId)
    .eq("id", invitationId)
    .is("accepted_at", null);
  if (error) return { ok: false, error: error.message };

  const { data: org } = await admin
    .from("organisations")
    .select("slug")
    .eq("id", orgId)
    .maybeSingle();
  if (org?.slug) revalidatePath(`/${org.slug}/hr/settings`);
  return { ok: true };
}
