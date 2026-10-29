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
 * Build the signature string from ordered fields, then hash it.
 *
 * Empty values are dropped by default, which is what PayFast's own code does
 * when it generates a payment form. It is not what PayFast does when it signs
 * a notification: there every field it sends is included, empty ones too, and
 * a notification carries all ten custom fields whether they were used or not.
 * Dropping them is a hash that can never match, so keepEmpty exists for that
 * side of the conversation.
 */
export function signatureStringFor(
  fields: PayFastField[],
  passphrase?: string,
  options: { keepEmpty?: boolean } = {},
): string {
  const parts = fields
    .filter(([, value]) => {
      if (value === undefined || value === null) return false;
      return options.keepEmpty ? true : value !== "";
    })
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

export interface DiagnosticVariant {
  key: string;
  label: string;
  explains: string;
  /** Posted to PayFast, in this order, without the signature field. */
  fields: PayFastField[];
  /** Hashed over these, which is not always the posted order. */
  signed: PayFastField[];
  passphrase?: string;
  signature: string;
}

export interface SignatureProbe {
  /**
   * The exact string hashed, with the two secrets in it replaced by their
   * shape: the merchant key and the passphrase. Everything else is either
   * public or already visible in the posted form, so this is safe to show a
   * workspace owner on a live merchant account as well as in the sandbox.
   */
  hashedString: string;
  passphraseShape: string;
  merchantKeyShape: string;
  variants: DiagnosticVariant[];
}

/**
 * Fields PayFast needs for a plain once-off payment and nothing else.
 *
 * This exists to bisect a signature failure. Every optional field is a chance
 * to mis-encode something, and the subscription fields add a second set of
 * rules on top. If the shortest legal form is rejected too, the fault is not
 * in how a particular field is built, it is in the credentials, the account or
 * the algorithm itself, and there is no point auditing field values further.
 */
const BARE_KEYS = [
  "merchant_id",
  "merchant_key",
  "return_url",
  "cancel_url",
  "notify_url",
  "amount",
  "item_name",
];

function pick(fields: PayFastField[], keys: string[]): PayFastField[] {
  return keys
    .map((key) => fields.find(([k]) => k === key))
    .filter((f): f is PayFastField => Boolean(f));
}

function sortedByKey(fields: PayFastField[]): PayFastField[] {
  return [...fields].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Candidate signatures over one checkout, each isolating a different rule.
 *
 * PayFast reports a signature fault in one sentence with no detail, so each
 * theory otherwise costs a deployment to test. These post the same checkout
 * with the signature computed a different way, so a run through the list
 * narrows the cause to whichever one PayFast accepts, or proves that none of
 * the usual suspects is the problem.
 */
export function diagnosticVariants(
  base: PayFastField[],
  passphrase?: string,
): DiagnosticVariant[] {
  const configured = passphrase?.trim() || undefined;
  const bare = pick(base, BARE_KEYS);

  const shapes: Array<{
    key: string;
    label: string;
    explains: string;
    fields: PayFastField[];
    signed: PayFastField[];
  }> = [
    {
      key: "posted",
      label: "Everything, signed in the order it is posted",
      explains: "What the live button already does.",
      fields: base,
      signed: base,
    },
    {
      key: "sorted",
      label: "Everything, signed in alphabetical order",
      explains:
        "Tests whether PayFast sorts the fields before hashing rather than taking them as posted.",
      fields: base,
      signed: sortedByKey(base),
    },
    {
      key: "bare",
      label: "A once-off payment with only the required fields",
      explains:
        "No subscription, no custom fields, no description. If even this is rejected, the fault is not in a field value.",
      fields: bare,
      signed: bare,
    },
  ];

  const passes: Array<{ suffix: string; note: string; value?: string }> = [];
  if (configured) {
    passes.push({
      suffix: "configured",
      note: `passphrase ${secretShape(configured)}`,
      value: configured,
    });
  }
  passes.push({ suffix: "none", note: "no passphrase" });
  if (configured !== SANDBOX_DOCS_PASSPHRASE) {
    passes.push({
      suffix: "docs",
      note: "documented sandbox passphrase",
      value: SANDBOX_DOCS_PASSPHRASE,
    });
  }

  const out: DiagnosticVariant[] = [];
  for (const shape of shapes) {
    for (const pass of passes) {
      out.push({
        key: `${shape.key}-${pass.suffix}`,
        label: `${shape.label}, ${pass.note}`,
        explains: shape.explains,
        fields: shape.fields,
        signed: shape.signed,
        passphrase: pass.value,
        signature: signPayload(shape.signed, pass.value),
      });
    }
  }
  return out;
}

/**
 * Everything needed to tell which signature PayFast is rejecting.
 *
 * A signature fault has four possible causes: the field values, their order,
 * the character encoding and the passphrase. The values and the encoding are
 * readable in the printed string. The order and the passphrase are not, so
 * each gets its own candidate below rather than another round of guessing.
 */
export function signatureProbe(
  fields: PayFastField[],
  passphrase?: string,
): SignatureProbe {
  const body = signatureStringFor(fields);
  const shape = secretShape(passphrase);
  const configured = passphrase?.trim();

  const merchantKey = fields.find(([k]) => k === "merchant_key")?.[1] ?? "";
  const merchantKeyShape = secretShape(merchantKey);

  const withPassphrase = configured
    ? `${body}&passphrase=${shape}`
    : `${body}   [nothing appended, no passphrase is set]`;

  // The merchant key is a secret and it sits inside the signature string, so
  // it is replaced by its shape rather than printed. First character, last
  // character and length are enough to check it against the PayFast dashboard
  // and not enough to use it.
  const hashedString = merchantKey
    ? withPassphrase.split(merchantKey).join(merchantKeyShape)
    : withPassphrase;

  return {
    hashedString,
    passphraseShape: shape,
    merchantKeyShape,
    variants: diagnosticVariants(fields, passphrase),
  };
}

/**
 * Verify a notification's signature. The notification's own signature field is
 * excluded from the hash, and the remaining fields are hashed in the order
 * PayFast sent them, which is why this takes ordered pairs rather than an
 * object: object key order is not something to bet a payment on.
 */
export type NotificationMatch = "kept_empty" | "dropped_empty" | "raw" | null;

/**
 * Work out which of PayFast's encodings produced this notification's
 * signature, or null if none did.
 *
 * Three are accepted because PayFast's documented rules and its behaviour
 * have not always agreed, and each round of getting this wrong costs a real
 * payment to retest. "kept_empty" is what their notification code does.
 * "dropped_empty" is what their payment form code does, kept in case a given
 * account behaves that way. "raw" hashes the body exactly as it arrived,
 * which sidesteps the question of whether decoding and re-encoding a value
 * round trips byte for byte.
 *
 * Accepting more than one encoding does not weaken anything: every candidate
 * is a hash over the same data with the same passphrase appended, so forging
 * any of them still requires the passphrase.
 */
export function matchNotificationSignature(
  fields: PayFastField[],
  signature: string,
  passphrase?: string,
  rawBody?: string,
): NotificationMatch {
  const withoutSignature = fields.filter(([key]) => key !== "signature");

  const candidates: Array<[NotificationMatch, string]> = [
    [
      "kept_empty",
      signatureStringFor(withoutSignature, passphrase, { keepEmpty: true }),
    ],
    ["dropped_empty", signatureStringFor(withoutSignature, passphrase)],
  ];

  if (rawBody) {
    const pairs = rawBody
      .split("&")
      .filter((pair) => pair && !/^signature=/.test(pair));
    if (passphrase) {
      pairs.push(`passphrase=${phpUrlEncode(passphrase.trim())}`);
    }
    candidates.push(["raw", pairs.join("&")]);
  }

  for (const [name, text] of candidates) {
    const expected = createHash("md5").update(text).digest("hex");
    if (timingSafeEqualHex(expected, signature)) return name;
  }
  return null;
}

export function verifyNotificationSignature(
  fields: PayFastField[],
  signature: string,
  passphrase?: string,
  rawBody?: string,
): boolean {
  return (
    matchNotificationSignature(fields, signature, passphrase, rawBody) !== null
  );
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
