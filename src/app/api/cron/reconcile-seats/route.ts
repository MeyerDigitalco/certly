/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { quoteFor } from "@/lib/billing/plan";
import { payfastConfig } from "@/lib/billing/payfast";
import { updateSubscriptionAmount } from "@/lib/billing/payfast-api";
import { authorisedCron } from "@/lib/cron-auth";



export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Bring every live subscription's recurring amount back in line with the
 * workspace's headcount.
 *
 * PayFast debits a fixed amount each cycle. Certly prices per person. Without
 * this, a customer who grew from 50 people to 120 keeps paying the figure
 * agreed on signup and the difference is never billed.
 *
 * Runs monthly, before the debit orders go out. Every change is written to
 * billing_events, because a customer who queries their statement deserves a
 * record of when the amount changed and why, and because a silent price
 * increase with no trail is the kind of thing that ends up at the ombud.
 *
 * A decrease is applied as readily as an increase. Charging a customer for
 * people who have left would be worse than the undercharge this fixes.
 */


export async function GET(request: NextRequest) {
  if (!authorisedCron(request)) {
    return new Response("Not found", { status: 404 });
  }

  const config = payfastConfig();
  if (!config) {
    return Response.json({
      ok: true,
      skipped: "PayFast is not configured on this deployment.",
    });
  }

  const admin: any = createAdminClient();

  const { data: orgs } = await admin
    .from("organisations")
    .select("id, slug, payfast_token, billed_seats, billed_amount_cents")
    .eq("subscription_status", "active")
    .not("payfast_token", "is", null);

  const report: Array<{
    slug: string;
    seats: number;
    from: number | null;
    to: number;
    outcome: string;
  }> = [];

  for (const org of (orgs ?? []) as Array<{
    id: string;
    slug: string;
    payfast_token: string;
    billed_seats: number | null;
    billed_amount_cents: number | null;
  }>) {
    const orgId = org.id;
    const { count } = await admin
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", orgId)
      .is("terminated_at", null);
    const seats = count ?? 0;
    const quote = quoteFor(seats);

    if (org.billed_amount_cents === quote.totalCents) continue;

    const outcome = await updateSubscriptionAmount(
      config,
      org.payfast_token,
      { amountCents: quote.totalCents },
    );

    if (outcome.status === "updated") {
      await admin
        .from("organisations")
        .update({
          billed_seats: seats,
          billed_amount_cents: quote.totalCents,
        })
        .eq("id", orgId);
    }

    await admin.from("billing_events").insert({
      organisation_id: orgId,
      source: "manual",
      event_type: "seat_reconciliation",
      seats,
      amount_cents: quote.totalCents,
      status: outcome.status,
      raw: {
        previous_seats: org.billed_seats,
        previous_amount_cents: org.billed_amount_cents,
        new_amount_cents: quote.totalCents,
        reason: outcome.status === "updated" ? null : outcome.reason,
      },
    });

    report.push({
      slug: org.slug,
      seats,
      from: org.billed_amount_cents,
      to: quote.totalCents,
      outcome: outcome.status,
    });
  }

  return Response.json({ ok: true, changed: report.length, report });
}
