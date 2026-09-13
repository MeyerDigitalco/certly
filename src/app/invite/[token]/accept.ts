"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  hashInviteToken,
  inviteState,
  normaliseInviteEmail,
} from "@/lib/invitations";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type AcceptResult = { ok: false; error: string };

/**
 * Accept an invitation.
 *
 * Everything is re-checked here rather than trusted from the page that
 * rendered the button: the token is re-hashed and looked up, the invitation is
 * re-tested for expiry and revocation, and the signed-in address is compared
 * to the invited address again. A page render is a suggestion; this is where
 * the membership is actually written.
 *
 * Runs under the service role because no RLS policy lets a signed-in user
 * write their own membership row, which is the property that makes this the
 * only way in.
 */
export async function acceptInvitation(
  formData: FormData,
): Promise<AcceptResult | void> {
  const token = String(formData.get("token") ?? "");
  if (!token) return { ok: false, error: "This link is not valid." };

  const supabase: any = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);

  const admin: any = createAdminClient();
  const { data: invite } = await admin
    .from("invitations")
    .select("id, organisation_id, email, role, expires_at, accepted_at, revoked_at")
    .eq("token_hash", hashInviteToken(token))
    .maybeSingle();

  const state = inviteState(invite ?? null, user.email ?? null);
  if (state !== "valid") {
    return { ok: false, error: messageFor(state) };
  }

  const { data: org } = await admin
    .from("organisations")
    .select("slug")
    .eq("id", invite.organisation_id)
    .maybeSingle();
  if (!org?.slug) {
    return { ok: false, error: "That workspace no longer exists." };
  }

  const { error: memberError } = await admin.from("org_members").upsert(
    {
      organisation_id: invite.organisation_id,
      user_id: user.id,
      role: invite.role,
    },
    { onConflict: "organisation_id,user_id" },
  );
  if (memberError) {
    return { ok: false, error: "You could not be added. Try again." };
  }

  await admin
    .from("invitations")
    .update({
      accepted_at: new Date().toISOString(),
      accepted_by: user.id,
    })
    .eq("id", invite.id)
    .is("accepted_at", null);

  redirect(`/${org.slug}/hr`);
}

export async function declineInvitation(
  formData: FormData,
): Promise<AcceptResult | void> {
  const token = String(formData.get("token") ?? "");
  if (!token) return { ok: false, error: "This link is not valid." };

  const supabase: any = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin: any = createAdminClient();
  const { data: invite } = await admin
    .from("invitations")
    .select("id, email, accepted_at, revoked_at, expires_at")
    .eq("token_hash", hashInviteToken(token))
    .maybeSingle();

  // Only the person it was addressed to may decline it, so a forwarded link
  // cannot be used to withdraw somebody else's invitation.
  if (
    invite &&
    !invite.accepted_at &&
    normaliseInviteEmail(invite.email) ===
      normaliseInviteEmail(user.email ?? "")
  ) {
    await admin
      .from("invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", invite.id);
  }

  redirect("/?declined=1");
}

function messageFor(state: string): string {
  switch (state) {
    case "expired":
      return "This invitation has expired. Ask for a new one.";
    case "accepted":
      return "This invitation has already been used.";
    case "revoked":
      return "This invitation was withdrawn.";
    case "wrong_account":
      return "This invitation was sent to a different email address. Sign in as that address to accept it.";
    default:
      return "This link is not valid.";
  }
}
