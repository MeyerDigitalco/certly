"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { publicOrigin } from "@/lib/origin";
import { SITE } from "@/lib/site";
import { buildSuggestion } from "@/lib/email/suggestion";
import { sendEmail } from "@/lib/email/send";

import {
  MIN_LENGTH,
  MAX_LENGTH,
  SUGGESTION_BUCKET,
  SUGGESTIONS_PER_HOUR,
} from "./limits";

const Input = z.object({
  body: z
    .string()
    .trim()
    .min(MIN_LENGTH, "Write a little more than that.")
    .max(MAX_LENGTH, "That is longer than this box takes. Send the short version."),
  context: z.string().trim().max(200).optional(),
});

export type SuggestResult =
  | { ok: true; delivered: boolean }
  | { ok: false; error: string };

/**
 * Send a suggestion about the product.
 *
 * Deliberately open to every role, viewers included. The person who notices
 * that a screen is wrong is usually the one who cannot change anything on it,
 * and a role check here would silence exactly them.
 *
 * The row is written first and the email is sent second. A suggestion that
 * was stored but not delivered is still readable; one that was delivered and
 * not stored is gone the moment the inbox is tidied.
 */
export async function sendSuggestion(
  formData: FormData,
): Promise<SuggestResult> {
  const orgId = String(formData.get("orgId") ?? "");
  if (!orgId) return { ok: false, error: "Missing workspace." };

  const parsed = Input.safeParse({
    body: String(formData.get("body") ?? ""),
    context: String(formData.get("context") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const supabase: any = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Membership is re-read here rather than trusted from the page, and the
  // organisation is read through the signed-in client so RLS decides whether
  // this person may see it at all.
  const { data: org } = await supabase
    .from("organisations")
    .select("id, name, slug")
    .eq("id", orgId)
    .maybeSingle();
  if (!org) return { ok: false, error: "Missing workspace." };

  const { data: membership } = await supabase
    .from("org_members")
    .select("role")
    .eq("organisation_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { ok: false, error: "Missing workspace." };

  // This writes into somebody else's inbox, so it is capped per workspace.
  const { data: allowed, error: limitError } = await supabase.rpc(
    "consume_rate_limit",
    {
      p_org: orgId,
      p_bucket: SUGGESTION_BUCKET,
      p_limit: SUGGESTIONS_PER_HOUR,
      p_window_seconds: 3600,
    },
  );
  if (limitError) {
    return { ok: false, error: "Could not send that just now. Try again shortly." };
  }
  if (allowed === false) {
    return {
      ok: false,
      error: `That is ${SUGGESTIONS_PER_HOUR} suggestions from this workspace in an hour, which is the limit. Send the rest a bit later.`,
    };
  }

  const { error: insertError } = await supabase.from("suggestions").insert({
    organisation_id: orgId,
    submitted_by: user.id,
    body: parsed.data.body,
    context: parsed.data.context || null,
  });
  if (insertError) {
    return { ok: false, error: "That could not be saved. Try again." };
  }

  const origin = await publicOrigin();
  const message = buildSuggestion({
    orgName: org.name ?? org.slug,
    slug: org.slug,
    fromEmail: user.email ?? "unknown",
    body: parsed.data.body,
    context: parsed.data.context ?? "",
    origin,
  });

  const outcome = await sendEmail({
    to: SITE.email,
    subject: message.subject,
    html: message.html,
    text: message.text,
    replyTo: user.email ?? undefined,
  });

  if (outcome.status === "failed") {
    console.error(`suggestion.email failed: ${outcome.reason}`);
  }

  // Saved either way, so the person is thanked either way. Whether our mail
  // server worked is not their problem and not their business.
  return { ok: true, delivered: outcome.status === "sent" };
}
