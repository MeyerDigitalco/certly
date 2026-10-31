/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@/lib/supabase/server";
import {
  accessFor,
  isPlan,
  isSubscriptionStatus,
  quoteFor,
  type Access,
  type Quote,
} from "./plan";



export interface BillingState extends Access {
  seats: number;
  quote: Quote;
}

/**
 * Read the billing columns for one workspace and decide what it may do.
 *
 * Scoped by organisation_id like every other read. The seat count comes from
 * the ordinary tenant client rather than a definer function, so RLS applies
 * and a caller who is not a member counts nothing.
 */
export async function getBillingState(orgId: string): Promise<BillingState> {
  const supabase: any = await createClient();

  const { data: org } = await supabase
    .from("organisations")
    .select(
      "plan, subscription_status, trial_ends_at, current_period_end, billing_exempt",
    )
    .eq("id", orgId)
    .maybeSingle();

  const { count } = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("organisation_id", orgId)
    .is("terminated_at", null);

  const seats = count ?? 0;

  const access = accessFor({
    plan: isPlan(org?.plan) ? org.plan : "trial",
    subscriptionStatus: isSubscriptionStatus(org?.subscription_status)
      ? org.subscription_status
      : "none",
    trialEndsAt: org?.trial_ends_at ?? "",
    currentPeriodEnd: org?.current_period_end ?? null,
    billingExempt: Boolean(org?.billing_exempt),
  });

  return { ...access, seats, quote: quoteFor(seats) };
}

/**
 * Gate for write server actions. Returns an error string to surface, or null
 * to proceed.
 *
 * This sits behind the role check rather than in front of it, so a viewer
 * trying to write is told they lack permission rather than being told the
 * workspace is unpaid, which is not their business.
 */
export async function assertWritable(orgId: string): Promise<string | null> {
  const state = await getBillingState(orgId);
  if (state.canWrite) return null;
  return state.reason;
}
