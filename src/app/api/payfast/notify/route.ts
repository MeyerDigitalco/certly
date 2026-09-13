import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  payfastConfig,
  validateUrl,
  verifyNotificationSignature,
  PAYFAST_HOSTS,
  type PayFastField,
} from "@/lib/billing/payfast";
import { quoteFor } from "@/lib/billing/plan";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * PayFast Instant Transaction Notification.
 *
 * This endpoint moves money state, is unauthenticated, and its URL is public,
 * so it assumes every request is hostile until four things hold:
 *
 *   1. The signature matches, proving the sender knows the passphrase.
 *   2. The request came from a PayFast host, because a leaked passphrase
 *      alone should not be enough.
 *   3. PayFast itself confirms the notification when we post it back.
 *   4. The amount matches what this workspace should actually be paying,
 *      recomputed here rather than taken from the notification.
 *
 * Only then does anything change. PayFast retries anything that is not a
 * clean 200, so the handler is idempotent on pf_payment_id: a repeat is
 * recorded as already seen and returns 200 rather than double applying.
 *
 * It always answers 200 with an empty body, even on rejection. Telling an
 * attacker which of the four checks they failed is free help, and a non-200
 * only makes PayFast retry a notification we have already refused.
 */

const OK = new Response("", { status: 200 });

function hostAllowed(request: NextRequest): boolean {
  const forwarded = request.headers.get("x-forwarded-host");
  const referer = request.headers.get("referer") ?? "";
  if (PAYFAST_HOSTS.some((host) => referer.includes(host))) return true;
  if (forwarded && PAYFAST_HOSTS.includes(forwarded)) return true;
  return false;
}

async function confirmWithPayFast(
  body: string,
  sandbox: boolean,
): Promise<boolean> {
  try {
    const response = await fetch(validateUrl(sandbox), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const text = (await response.text()).trim();
    return text.startsWith("VALID");
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const config = payfastConfig();
  if (!config) return OK;

  const raw = await request.text();
  const fields: PayFastField[] = [];
  for (const pair of raw.split("&")) {
    if (!pair) continue;
    const index = pair.indexOf("=");
    const key = index === -1 ? pair : pair.slice(0, index);
    const value = index === -1 ? "" : pair.slice(index + 1);
    fields.push([
      decodeURIComponent(key.replace(/\+/g, " ")),
      decodeURIComponent(value.replace(/\+/g, " ")),
    ]);
  }

  const get = (key: string): string =>
    fields.find(([k]) => k === key)?.[1] ?? "";

  const signature = get("signature");
  if (!verifyNotificationSignature(fields, signature, config.passphrase)) {
    return OK;
  }

  if (!config.sandbox && !hostAllowed(request)) {
    return OK;
  }

  if (!(await confirmWithPayFast(raw, config.sandbox))) {
    return OK;
  }

  const orgId = get("custom_str1") || get("m_payment_id");
  const pfPaymentId = get("pf_payment_id");
  const paymentStatus = get("payment_status").toUpperCase();
  const token = get("token");
  const grossRands = Number(get("amount_gross"));

  if (!orgId || !pfPaymentId) return OK;

  const admin: any = createAdminClient();

  const { data: org } = await admin
    .from("organisations")
    .select("id, payfast_token")
    .eq("id", orgId)
    .maybeSingle();
  if (!org) return OK;

  const { count: seatCount } = await admin
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("organisation_id", orgId);
  const seats = seatCount ?? 0;
  const expectedRands = quoteFor(seats).totalCents / 100;

  // A short payment is never accepted. An overpayment is recorded but not
  // treated as a failure, since the headcount can drop between the debit
  // order going out and this arriving.
  const amountOk =
    Number.isFinite(grossRands) && grossRands >= expectedRands - 0.01;

  const { error: insertError } = await admin.from("billing_events").insert({
    organisation_id: orgId,
    source: "payfast",
    event_type: paymentStatus.toLowerCase() || "unknown",
    pf_payment_id: pfPaymentId,
    payfast_token: token || null,
    amount_cents: Number.isFinite(grossRands)
      ? Math.round(grossRands * 100)
      : null,
    seats,
    status: amountOk ? "accepted" : "amount_mismatch",
    raw: Object.fromEntries(fields.filter(([k]) => k !== "signature")),
  });

  // 23505 on pf_payment_id means PayFast is retrying something already
  // applied. Answer 200 so the retries stop.
  if (insertError?.code === "23505") return OK;
  if (insertError) return OK;

  if (!amountOk) return OK;

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  if (paymentStatus === "COMPLETE") {
    await admin
      .from("organisations")
      .update({
        plan: "standard",
        subscription_status: "active",
        payfast_token: token || org.payfast_token,
        current_period_end: periodEnd.toISOString(),
        billed_seats: seats,
        billed_amount_cents: Math.round(grossRands * 100),
        subscribed_at: now.toISOString(),
        cancelled_at: null,
      })
      .eq("id", orgId);
  } else if (paymentStatus === "FAILED") {
    await admin
      .from("organisations")
      .update({ subscription_status: "past_due" })
      .eq("id", orgId);
  } else if (paymentStatus === "CANCELLED") {
    await admin
      .from("organisations")
      .update({
        subscription_status: "cancelled",
        cancelled_at: now.toISOString(),
      })
      .eq("id", orgId);
  }

  return OK;
}

export async function GET() {
  return new Response("Not found", { status: 404 });
}
