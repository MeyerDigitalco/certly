import { createHash } from "node:crypto";
import { phpUrlEncode, type PayFastConfig } from "./payfast";

/**
 * The PayFast merchant API, used to change a live subscription's recurring
 * amount.
 *
 * This exists because of a mismatch that is easy to miss: PayFast bills a
 * fixed amount every cycle, while Certly prices on headcount. A customer who
 * grows from 50 to 120 people keeps paying the amount agreed on the day they
 * subscribed, forever, unless something goes and changes it. That something is
 * this file.
 *
 * The merchant API signs differently to the payment form. Headers are sorted
 * alphabetically, the passphrase is included as a header rather than appended,
 * and the timestamp must be close to PayFast's clock. Getting any of it wrong
 * returns a generic error, so all of it is in one place with tests.
 */

const API_BASE = "https://api.payfast.co.za";
const API_VERSION = "v1";

export interface SubscriptionUpdate {
  /** New recurring amount in cents. */
  amountCents: number;
}

export type UpdateOutcome =
  | { status: "updated" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

/**
 * Sort the header set alphabetically, encode it the same way the payment form
 * does, and hash. The merchant API rejects an unsorted string even when every
 * value is right.
 */
export function apiSignature(
  headers: Record<string, string>,
  body: Record<string, string>,
  passphrase?: string,
): string {
  const all: Record<string, string> = { ...headers, ...body };
  if (passphrase) all.passphrase = passphrase;

  const parts = Object.keys(all)
    .sort()
    .filter((key) => all[key] !== undefined && all[key] !== "")
    .map((key) => `${key}=${phpUrlEncode(String(all[key]).trim())}`);

  return createHash("md5").update(parts.join("&")).digest("hex");
}

/** PayFast wants an ISO 8601 timestamp with an offset, not a Z suffix. */
export function apiTimestamp(now: Date = new Date()): string {
  const iso = now.toISOString();
  return `${iso.slice(0, 19)}+00:00`;
}

export async function updateSubscriptionAmount(
  config: PayFastConfig,
  token: string,
  update: SubscriptionUpdate,
): Promise<UpdateOutcome> {
  if (!token) {
    return { status: "skipped", reason: "No PayFast token on this workspace." };
  }
  if (config.sandbox) {
    return {
      status: "skipped",
      reason: "Sandbox mode; the merchant API is not called.",
    };
  }

  const timestamp = apiTimestamp();
  const headers: Record<string, string> = {
    "merchant-id": config.merchantId,
    version: API_VERSION,
    timestamp,
  };
  const body: Record<string, string> = {
    amount: String(Math.round(update.amountCents)),
  };

  const signature = apiSignature(headers, body, config.passphrase);

  try {
    const response = await fetch(
      `${API_BASE}/subscriptions/${encodeURIComponent(token)}/update`,
      {
        method: "PATCH",
        headers: {
          ...headers,
          signature,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      return {
        status: "failed",
        reason: `${response.status} ${text.slice(0, 200)}`,
      };
    }
    return { status: "updated" };
  } catch (error) {
    return {
      status: "failed",
      reason: error instanceof Error ? error.message : "Network error",
    };
  }
}

/**
 * Cancel a live subscription.
 *
 * Separate from the local state change on purpose. The workspace is marked
 * cancelled whatever this returns, because a customer who clicked cancel has
 * cancelled, and leaving them subscribed in our records while PayFast was
 * briefly unreachable would be the wrong failure. A failure here means the
 * debit order may still run, which is a refund we owe, not a subscription
 * they still have.
 */
export async function cancelSubscription(
  config: PayFastConfig,
  token: string,
): Promise<UpdateOutcome> {
  if (!token) {
    return { status: "skipped", reason: "No PayFast token on this workspace." };
  }
  if (config.sandbox) {
    return {
      status: "skipped",
      reason: "Sandbox mode; the merchant API is not called.",
    };
  }

  const headers: Record<string, string> = {
    "merchant-id": config.merchantId,
    version: API_VERSION,
    timestamp: apiTimestamp(),
  };
  const signature = apiSignature(headers, {}, config.passphrase);

  try {
    const response = await fetch(
      `${API_BASE}/subscriptions/${encodeURIComponent(token)}/cancel`,
      { method: "PUT", headers: { ...headers, signature } },
    );
    if (!response.ok) {
      const text = await response.text();
      return {
        status: "failed",
        reason: `${response.status} ${text.slice(0, 200)}`,
      };
    }
    return { status: "updated" };
  } catch (error) {
    return {
      status: "failed",
      reason: error instanceof Error ? error.message : "Network error",
    };
  }
}
