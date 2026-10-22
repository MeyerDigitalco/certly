import { createHash } from "node:crypto";

/**
 * PayFast payment field handling.
 *
 * Two things about PayFast bite people, and both are encoded here rather than
 * left to a call site to remember.
 *
 * The signature is an MD5 of the fields in the exact order they are posted,
 * not sorted, with values URL encoded the way PHP's urlencode does it: spaces
 * as plus signs and hex digits in upper case. JavaScript's encodeURIComponent
 * differs on both counts and on which characters it leaves alone, so the
 * encoding is done by hand below. An empty field is omitted entirely; sending
 * it as an empty string changes the hash.
 *
 * The passphrase is appended last as its own encoded pair. If the merchant
 * account has a passphrase set and it is left out, or has none and one is
 * added, the signature fails and PayFast reports only a generic error.
 */

const PROCESS_URL_LIVE = "https://www.payfast.co.za/eng/process";
const PROCESS_URL_SANDBOX = "https://sandbox.payfast.co.za/eng/process";

const VALIDATE_URL_LIVE = "https://www.payfast.co.za/eng/query/validate";
const VALIDATE_URL_SANDBOX =
  "https://sandbox.payfast.co.za/eng/query/validate";

/**
 * PayFast posts notifications from these ranges. Documented by PayFast and
 * checked on every notification, because the signature alone proves only that
 * whoever sent it knows the passphrase.
 */
export const PAYFAST_HOSTS = [
  "www.payfast.co.za",
  "sandbox.payfast.co.za",
  "w1w.payfast.co.za",
  "w2w.payfast.co.za",
];

/** Monthly. PayFast frequency codes: 3 is monthly, 4 quarterly, 6 annual. */
export const FREQUENCY_MONTHLY = 3;

/** Cycles of 0 means bill until cancelled. */
export const CYCLES_INDEFINITE = 0;

export type PayFastField = [key: string, value: string];

/**
 * PHP urlencode, which is what PayFast's own signature code uses. Differs from
 * encodeURIComponent on four counts: space becomes a plus, and ! ' ( ) * ~
 * are all escaped where encodeURIComponent leaves them alone.
 */
export function phpUrlEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/g, "+")
    .replace(
      /[!'()*~]/g,
      (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
    )
    .replace(/%[0-9a-f]{2}/g, (m) => m.toUpperCase());
}

/**
 * Build the signature string from ordered fields, then hash it. Empty values
 * are dropped, matching PayFast's own implementation.
 */
export function signatureStringFor(
  fields: PayFastField[],
  passphrase?: string,
): string {
  const parts = fields
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${phpUrlEncode(String(value).trim())}`);

  if (passphrase) {
    parts.push(`passphrase=${phpUrlEncode(passphrase.trim())}`);
  }

  return parts.join("&");
}

export function signPayload(
  fields: PayFastField[],
  passphrase?: string,
): string {
  return createHash("md5")
    .update(signatureStringFor(fields, passphrase))
    .digest("hex");
}

/**
 * Show enough of a secret to recognise it without printing it.
 *
 * A passphrase mismatch is the one signature fault that cannot be seen from
 * the posted form, because the passphrase is the only input PayFast never
 * echoes. First character, last character and length are enough to tell two
 * candidate passphrases apart, and not enough to use one.
 */
export function secretShape(value: string | undefined): string {
  if (!value) return "not set";
  const v = value.trim();
  if (v.length <= 2) return `${"*".repeat(v.length)} (${v.length} characters)`;
  return `${v[0]}${"*".repeat(v.length - 2)}${v[v.length - 1]} (${v.length} characters)`;
}

/**
 * The passphrase PayFast prints in its own sandbox examples. Not a secret and
 * not necessarily the one set on any given sandbox account: the sandbox lets
 * each merchant generate their own, so this is a candidate to try, never a
 * default to rely on. Used only by the sandbox diagnostic below.
 */
export const SANDBOX_DOCS_PASSPHRASE = "jt7NOE43FZPn";

export interface SignatureCandidate {
  key: "configured" | "none" | "docs";
  label: string;
  signature: string;
}

export interface SignatureProbe {
  /** The exact string hashed, with the passphrase value replaced by its shape. */
  hashedString: string;
  passphraseShape: string;
  candidates: SignatureCandidate[];
}

/**
 * Everything needed to tell which signature PayFast is rejecting.
 *
 * A signature fault has exactly four possible causes: the field values, their
 * order, the character encoding and the passphrase. The first three are
 * visible in the posted form, so a dump of the form settles them. The
 * passphrase is not, which is why this returns the hash computed both ways.
 * Posting each in turn against the same account identifies the passphrase
 * state in one sitting rather than one deployment per guess.
 */
export function signatureProbe(
  fields: PayFastField[],
  passphrase?: string,
): SignatureProbe {
  const body = signatureStringFor(fields);
  const shape = secretShape(passphrase);
  const configured = passphrase?.trim();

  const candidates: SignatureCandidate[] = [];
  if (configured) {
    candidates.push({
      key: "configured",
      label: `With the passphrase set on this deployment (${shape})`,
      signature: signPayload(fields, configured),
    });
  }
  candidates.push({
    key: "none",
    label: "With no passphrase at all",
    signature: signPayload(fields),
  });
  if (configured !== SANDBOX_DOCS_PASSPHRASE) {
    candidates.push({
      key: "docs",
      label: "With the passphrase from PayFast's sandbox documentation",
      signature: signPayload(fields, SANDBOX_DOCS_PASSPHRASE),
    });
  }

  return {
    hashedString: configured
      ? `${body}&passphrase=${shape}`
      : `${body}   [nothing appended, no passphrase is set]`,
    passphraseShape: shape,
    candidates,
  };
}

/**
 * Verify a notification's signature. The notification's own signature field is
 * excluded from the hash, and the remaining fields are hashed in the order
 * PayFast sent them, which is why this takes ordered pairs rather than an
 * object: object key order is not something to bet a payment on.
 */
export function verifyNotificationSignature(
  fields: PayFastField[],
  signature: string,
  passphrase?: string,
): boolean {
  const withoutSignature = fields.filter(([key]) => key !== "signature");
  const expected = signPayload(withoutSignature, passphrase);
  return timingSafeEqualHex(expected, signature);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const left = a.toLowerCase();
  const right = (b ?? "").toLowerCase();
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

export interface PayFastConfig {
  merchantId: string;
  merchantKey: string;
  passphrase?: string;
  sandbox: boolean;
}

/**
 * Read PayFast credentials from the environment. Returns null when they are
 * absent so the billing screen can say the account is not connected yet,
 * rather than the app crashing on import.
 */
export function payfastConfig(): PayFastConfig | null {
  const merchantId = process.env.PAYFAST_MERCHANT_ID;
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
  if (!merchantId || !merchantKey) return null;
  return {
    merchantId,
    merchantKey,
    passphrase: process.env.PAYFAST_PASSPHRASE || undefined,
    sandbox: process.env.PAYFAST_SANDBOX === "true",
  };
}

export function processUrl(sandbox: boolean): string {
  return sandbox ? PROCESS_URL_SANDBOX : PROCESS_URL_LIVE;
}

export function validateUrl(sandbox: boolean): string {
  return sandbox ? VALIDATE_URL_SANDBOX : VALIDATE_URL_LIVE;
}

export interface CheckoutInput {
  config: PayFastConfig;
  origin: string;
  orgId: string;
  orgName: string;
  slug: string;
  billingEmail: string;
  amount: string;
  seats: number;
}

/**
 * The ordered fields for a monthly subscription, plus the signature over them.
 *
 * The order is not ours to choose. PayFast rebuilds the signature string from
 * its own documented attribute order, so every custom_int comes before every
 * custom_str whatever order the form posts them in. Getting that wrong gives
 * "Generated signature does not match submitted signature" and no other clue.
 * The array below is in PayFast's documented order and the form renders it in
 * the same order, so the two can never disagree.
 *
 * m_payment_id carries the workspace id so a notification can be matched back
 * to a tenant without trusting custom_str fields alone, and custom_str1 repeats
 * it because PayFast echoes both. The amount is verified again against a fresh
 * quote when the notification arrives; nothing here is trusted on return.
 */
export function checkoutFields(input: CheckoutInput): {
  action: string;
  fields: PayFastField[];
} {
  const { config, origin, orgId, orgName, slug, billingEmail, amount, seats } =
    input;

  const fields: PayFastField[] = [
    ["merchant_id", config.merchantId],
    ["merchant_key", config.merchantKey],
    ["return_url", `${origin}/${slug}/hr/billing?paid=1`],
    ["cancel_url", `${origin}/${slug}/hr/billing?cancelled=1`],
    ["notify_url", `${origin}/api/payfast/notify`],
    ["email_address", billingEmail],
    ["m_payment_id", orgId],
    ["amount", amount],
    ["item_name", "Certly subscription"],
    [
      "item_description",
      `Monthly subscription for ${orgName}, ${seats} ${seats === 1 ? "person" : "people"} on the register`,
    ],
    ["custom_int1", String(seats)],
    ["custom_str1", orgId],
    ["custom_str2", slug],
    ["subscription_type", "1"],
    ["frequency", String(FREQUENCY_MONTHLY)],
    ["cycles", String(CYCLES_INDEFINITE)],
  ];

  const signature = signPayload(fields, config.passphrase);

  return {
    action: processUrl(config.sandbox),
    fields: [...fields, ["signature", signature]],
  };
}
