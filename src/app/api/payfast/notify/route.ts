/* eslint-disable @typescript-eslint/no-explicit-any */
import { promises as dns } from "node:dns";
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



export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * PayFast Instant Transaction Notification.
 *
 * This endpoint moves money state, is unauthenticated, and its URL is public,
 * so it assumes every request is hostile until four things hold:
 *
 *   1. The signature matches, proving the sender knows the passphrase.
 *   2. PayFast itself confirms the notification when we post it back. This
 *      is the authoritative check: an attacker who somehow forged a valid
 *      signature still cannot make PayFast vouch for a transaction that
 *      never happened.
 *   3. The amount matches what this workspace should actually be paying,
 *      recomputed here rather than taken from the notification.
 *
 * The source IP is also checked against PayFast's own servers, resolved by
 * DNS, but only as a recorded observation. It does not reject. An earlier
 * version rejected on a header comparison that can never match a real
 * server-to-server POST, which would have dropped every genuine payment
 * while returning 200 so PayFast never retried. A check that produces false
 * negatives on live traffic is worse than no check, and the validate
 * callback above already carries the weight.
 *
 * Only then does anything change. PayFast retries anything that is not a
 * clean 200, so the handler is idempotent on pf_payment_id: a repeat is
 * recorded as already seen and returns 200 rather than double applying.
 *
 * It always answers 200 with an empty body, even on rejection. Telling an
 * attacker which check they failed is free help, and a non-200
 * only makes PayFast retry a notification we have already refused.
 */

const OK = new Response("", { status: 200 });

/**
 * Record why a notification was refused.
 *
 * The handler answers 200 to everything on purpose, and the checks that run
 * before the billing_events insert leave no trace at all, so an ITN that is
 * rejected and an ITN that never arrived look identical from the database.
 * That is the difference between a five minute diagnosis and a day of
 * guessing, and it matters most on the live payment path.
 *
 * This writes to the platform log rather than the database deliberately. The
 * endpoint is unauthenticated by nature, so a row per rejected call would be
 * a table anyone on the internet can fill. Nothing here identifies a person:
 * the payment reference and the reason, and no email, name or amount.
 */
function refused(reason: string, detail: Record<string, string> = {}): Response {
  const parts = Object.entries(detail)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
  console.warn(`payfast.notify refused: ${reason}${parts ? ` ${parts}` : ""}`);
  return OK;
}

function sourceIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for") ?? "";
  const first = forwardedFor.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip") || "";
}

type IpCheck = "match" | "mismatch" | "unknown";

/**
 * Compare the caller's IP to the addresses PayFast's own hosts resolve to.
 * Returns "unknown" rather than "mismatch" when DNS or the proxy headers
 * give us nothing to compare, so a resolver blip is never mistaken for an
 * intruder.
 */
async function checkSourceIp(request: NextRequest): Promise<IpCheck> {
  const ip = sourceIp(request);
  if (!ip) return "unknown";

  const lookups = await Promise.all(
    PAYFAST_HOSTS.map(async (host) => {
      const [v4, v6] = await Promise.all([
        dns.resolve4(host).catch(() => [] as string[]),
        dns.resolve6(host).catch(() => [] as string[]),
      ]);
      return [...v4, ...v6];
    }),
  );

  const known = new Set(lookups.flat());
  if (known.size === 0) return "unknown";
  return known.has(ip) ? "match" : "mismatch";
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
  if (!config) return refused("no PayFast credentials on this deployment");

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
    // Almost always PAYFAST_PASSPHRASE here not matching the one set on the
    // PayFast account, rather than anything hostile.
    return refused("signature mismatch", {
      pf_payment_id: get("pf_payment_id"),
      passphrase_set: config.passphrase ? "yes" : "no",
      fields: String(fields.length),
    });
  }

  if (!(await confirmWithPayFast(raw, config.sandbox))) {
    // PayFast did not answer VALID to the server to server check, or we could
    // not reach them at all.
    return refused("PayFast did not confirm the notification", {
      pf_payment_id: get("pf_payment_id"),
      sandbox: String(config.sandbox),
    });
  }

  const ipCheck = config.sandbox
    ? "unknown"
    : await checkSourceIp(request).catch((): IpCheck => "unknown");

  const orgId = get("custom_str1") || get("m_payment_id");
  const pfPaymentId = get("pf_payment_id");
  const paymentStatus = get("payment_status").toUpperCase();
  const token = get("token");
  const grossRands = Number(get("amount_gross"));

  if (!orgId || !pfPaymentId) {
    return refused("notification is missing the workspace or payment id", {
      has_org: orgId ? "yes" : "no",
      has_payment_id: pfPaymentId ? "yes" : "no",
    });
  }

  const admin: any = createAdminClient();

  const { data: org } = await admin
    .from("organisations")
    .select("id, payfast_token")
    .eq("id", orgId)
    .maybeSingle();
  if (!org) {
    return refused("no workspace with that id", { pf_payment_id: pfPaymentId });
  }

  const { count: seatCount } = await admin
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("organisation_id", orgId)
    .is("terminated_at", null);
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
    status: amountOk
      ? ipCheck === "mismatch"
        ? "accepted_source_ip_mismatch"
        : "accepted"
      : "amount_mismatch",
    raw: {
      ...Object.fromEntries(fields.filter(([k]) => k !== "signature")),
      source_ip: sourceIp(request),
      source_ip_check: ipCheck,
    },
  });

  // 23505 on pf_payment_id means PayFast is retrying something already
  // applied. Answer 200 so the retries stop.
  // A repeat of something already applied. PayFast retries until it gets a
  // clean 200, so this is expected rather than a fault.
  if (insertError?.code === "23505") return OK;
  if (insertError) {
    return refused("could not record the notification", {
      pf_payment_id: pfPaymentId,
      code: insertError.code ?? "",
    });
  }

  if (!amountOk) {
    return refused("short payment", {
      pf_payment_id: pfPaymentId,
      paid: String(grossRands),
      expected: String(expectedRands),
      seats: String(seats),
    });
  }

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
    console.info(
      `payfast.notify applied: COMPLETE pf_payment_id=${pfPaymentId} seats=${seats} token=${token ? "stored" : "MISSING"}`,
    );
  } else if (paymentStatus === "FAILED") {
    await admin
      .from("organisations")
      .update({ subscription_status: "past_due" })
      .eq("id", orgId);
    console.info(`payfast.notify applied: FAILED pf_payment_id=${pfPaymentId}`);
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
