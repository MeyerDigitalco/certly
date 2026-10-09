"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { payfastConfig } from "@/lib/billing/payfast";
import { cancelSubscription } from "@/lib/billing/payfast-api";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type CancelResult =
  | { ok: true; periodEnd: string | null; warning: string | null }
  | { ok: false; error: string };

/**
 * Cancel a workspace's subscription.
 *
 * Owner only, and deliberately not gated on the billing state: a workspace
 * that is already read only because a payment failed must still be able to
 * stop the debit order.
 *
 * The local state is written whatever PayFast says. If their API is down, the
 * customer has still cancelled, and the worst case is a debit order we then
 * owe back under the refund policy. Leaving them marked subscribed because a
 * third party was briefly unreachable would be the worse of the two failures,
 * and it is the one they would discover on their bank statement.
 */
export async function cancelOwnSubscription(
  formData: FormData,
): Promise<CancelResult> {
  const orgId = String(formData.get("orgId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!orgId) return { ok: false, error: "Missing workspace." };

  const supabase: any = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: membership } = await supabase
    .from("org_members")
    .select("role")
    .eq("organisation_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership || membership.role !== "owner") {
    return { ok: false, error: "Only the owner can cancel the subscription." };
  }

  const admin: any = createAdminClient();
  const { data: org } = await admin
    .from("organisations")
    .select("payfast_token, subscription_status, current_period_end")
    .eq("id", orgId)
    .maybeSingle();
  if (!org) return { ok: false, error: "That workspace no longer exists." };

  if (org.subscription_status === "cancelled") {
    return {
      ok: true,
      periodEnd: org.current_period_end,
      warning: null,
    };
  }

  const config = payfastConfig();
  let warning: string | null = null;

  if (config && org.payfast_token) {
    const outcome = await cancelSubscription(config, org.payfast_token);
    if (outcome.status === "failed") {
      warning =
        "We could not reach PayFast to stop the debit order. Your subscription is cancelled here, and if a payment still goes through we will refund it. Cancelling in your PayFast account as well will make sure.";
    }
  }

  const now = new Date().toISOString();
  await admin
    .from("organisations")
    .update({ subscription_status: "cancelled", cancelled_at: now })
    .eq("id", orgId);

  await admin.from("billing_events").insert({
    organisation_id: orgId,
    source: "manual",
    event_type: "cancelled_by_owner",
    status: warning ? "payfast_unreachable" : "accepted",
    raw: { cancelled_at: now, by: user.id },
  });

  if (slug) revalidatePath(`/${slug}/hr/billing`);

  return { ok: true, periodEnd: org.current_period_end, warning };
}
