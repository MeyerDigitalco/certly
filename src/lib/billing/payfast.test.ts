import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  phpUrlEncode,
  signatureStringFor,
  signPayload,
  verifyNotificationSignature,
  checkoutFields,
  secretShape,
  signatureProbe,
  diagnosticVariants,
  SANDBOX_DOCS_PASSPHRASE,
  processUrl,
  validateUrl,
  type PayFastField,
  type PayFastConfig,
} from "./payfast";
import {
  apiSignature,
  apiTimestamp,
  updateSubscriptionAmount,
} from "./payfast-api";

const CONFIG: PayFastConfig = {
  merchantId: "10000100",
  merchantKey: "46f0cd694581a",
  passphrase: "jt7NOE43FZPn",
  sandbox: true,
};

describe("phpUrlEncode", () => {
  it("encodes a space as a plus, not as %20", () => {
    expect(phpUrlEncode("Certly subscription")).toBe("Certly+subscription");
  });

  it("uses upper case hex, which is what PayFast hashes", () => {
    expect(phpUrlEncode("a@b.co.za")).toBe("a%40b.co.za");
    expect(phpUrlEncode("R1,009")).toBe("R1%2C009");
    expect(phpUrlEncode("50%")).toBe("50%25");
  });

  it("escapes the characters encodeURIComponent leaves alone", () => {
    expect(phpUrlEncode("a!b")).toBe("a%21b");
    expect(phpUrlEncode("a'b")).toBe("a%27b");
    expect(phpUrlEncode("a(b)c")).toBe("a%28b%29c");
    expect(phpUrlEncode("a*b")).toBe("a%2Ab");
  });

  it("leaves letters, digits, hyphen, underscore and dot alone", () => {
    expect(phpUrlEncode("Abc-123_x.y")).toBe("Abc-123_x.y");
  });

  it("escapes the tilde, because PayFast signs with urlencode and not rawurlencode", () => {
    expect(phpUrlEncode("Abc~z")).toBe("Abc%7Ez");
  });
});

describe("signatureStringFor", () => {
  it("keeps the order it was given rather than sorting", () => {
    const fields: PayFastField[] = [
      ["merchant_id", "10000100"],
      ["amount", "999.00"],
      ["item_name", "Certly subscription"],
    ];
    expect(signatureStringFor(fields)).toBe(
      "merchant_id=10000100&amount=999.00&item_name=Certly+subscription",
    );
  });

  it("drops empty fields instead of sending them as empty strings", () => {
    const fields: PayFastField[] = [
      ["merchant_id", "10000100"],
      ["custom_str3", ""],
      ["amount", "999.00"],
    ];
    expect(signatureStringFor(fields)).toBe(
      "merchant_id=10000100&amount=999.00",
    );
  });

  it("appends the passphrase last", () => {
    const fields: PayFastField[] = [["merchant_id", "10000100"]];
    expect(signatureStringFor(fields, "jt7NOE43FZPn")).toBe(
      "merchant_id=10000100&passphrase=jt7NOE43FZPn",
    );
  });

  it("trims values, because a trailing space changes the hash", () => {
    const fields: PayFastField[] = [["item_name", "  Certly  "]];
    expect(signatureStringFor(fields)).toBe("item_name=Certly");
  });
});

describe("signPayload", () => {
  it("produces the MD5 of the signature string", () => {
    const fields: PayFastField[] = [
      ["merchant_id", "10000100"],
      ["amount", "999.00"],
    ];
    const expected = createHash("md5")
      .update("merchant_id=10000100&amount=999.00&passphrase=jt7NOE43FZPn")
      .digest("hex");
    expect(signPayload(fields, "jt7NOE43FZPn")).toBe(expected);
  });

  it("changes when the passphrase changes", () => {
    const fields: PayFastField[] = [["merchant_id", "10000100"]];
    expect(signPayload(fields, "one")).not.toBe(signPayload(fields, "two"));
    expect(signPayload(fields)).not.toBe(signPayload(fields, "one"));
  });

  it("changes when field order changes, which is why order is preserved", () => {
    const a: PayFastField[] = [
      ["merchant_id", "1"],
      ["amount", "2"],
    ];
    const b: PayFastField[] = [
      ["amount", "2"],
      ["merchant_id", "1"],
    ];
    expect(signPayload(a)).not.toBe(signPayload(b));
  });
});

describe("verifyNotificationSignature", () => {
  const notification: PayFastField[] = [
    ["m_payment_id", "org-uuid"],
    ["pf_payment_id", "1089250"],
    ["payment_status", "COMPLETE"],
    ["amount_gross", "999.00"],
  ];

  it("accepts a signature it generated itself", () => {
    const signature = signPayload(notification, CONFIG.passphrase);
    expect(
      verifyNotificationSignature(
        [...notification, ["signature", signature]],
        signature,
        CONFIG.passphrase,
      ),
    ).toBe(true);
  });

  it("rejects a tampered amount", () => {
    const signature = signPayload(notification, CONFIG.passphrase);
    const tampered: PayFastField[] = notification.map(([k, v]) =>
      k === "amount_gross" ? [k, "1.00"] : [k, v],
    );
    expect(
      verifyNotificationSignature(tampered, signature, CONFIG.passphrase),
    ).toBe(false);
  });

  it("rejects a signature made without the passphrase", () => {
    const unsalted = signPayload(notification);
    expect(
      verifyNotificationSignature(notification, unsalted, CONFIG.passphrase),
    ).toBe(false);
  });

  it("rejects a missing or malformed signature without throwing", () => {
    expect(
      verifyNotificationSignature(notification, "", CONFIG.passphrase),
    ).toBe(false);
    expect(
      verifyNotificationSignature(notification, "abc", CONFIG.passphrase),
    ).toBe(false);
  });
});

describe("checkoutFields", () => {
  const built = checkoutFields({
    config: CONFIG,
    origin: "https://certly.co.za",
    orgId: "11111111-2222-3333-4444-555555555555",
    orgName: "Acme Scaffolding",
    slug: "acme",
    billingEmail: "owner@acme.co.za",
    amount: "1009.00",
    seats: 51,
  });

  const map = new Map(built.fields);

  it("posts to the sandbox when configured for it", () => {
    expect(built.action).toBe("https://sandbox.payfast.co.za/eng/process");
    expect(processUrl(false)).toBe("https://www.payfast.co.za/eng/process");
    expect(validateUrl(true)).toContain("sandbox.payfast.co.za");
  });

  it("carries the workspace id so a notification can be matched back", () => {
    expect(map.get("m_payment_id")).toBe(
      "11111111-2222-3333-4444-555555555555",
    );
    expect(map.get("custom_str1")).toBe(
      "11111111-2222-3333-4444-555555555555",
    );
    expect(map.get("custom_int1")).toBe("51");
  });

  it("asks for an indefinite monthly subscription", () => {
    expect(map.get("subscription_type")).toBe("1");
    expect(map.get("frequency")).toBe("3");
    expect(map.get("cycles")).toBe("0");
  });

  it("sends the notify url on our own origin", () => {
    expect(map.get("notify_url")).toBe(
      "https://certly.co.za/api/payfast/notify",
    );
    expect(map.get("return_url")).toContain("/acme/hr/billing?paid=1");
    expect(map.get("cancel_url")).toContain("/acme/hr/billing?cancelled=1");
  });

  it("appends the signature last and over every preceding field", () => {
    const last = built.fields[built.fields.length - 1];
    expect(last[0]).toBe("signature");

    const withoutSignature = built.fields.slice(0, -1);
    expect(signPayload(withoutSignature, CONFIG.passphrase)).toBe(last[1]);
  });

  it("signs the amount that is actually posted", () => {
    expect(map.get("amount")).toBe("1009.00");
    const tampered = built.fields
      .slice(0, -1)
      .map(([k, v]): PayFastField => (k === "amount" ? [k, "1.00"] : [k, v]));
    expect(signPayload(tampered, CONFIG.passphrase)).not.toBe(
      map.get("signature"),
    );
  });
});

describe("apiSignature", () => {
  it("sorts headers alphabetically, unlike the payment form which preserves order", () => {
    const sig = apiSignature(
      { version: "v1", "merchant-id": "10000100", timestamp: "2026-09-08T10:00:00+00:00" },
      { amount: "99900" },
    );
    const expected = createHash("md5")
      .update(
        "amount=99900&merchant-id=10000100&timestamp=2026-09-08T10%3A00%3A00%2B00%3A00&version=v1",
      )
      .digest("hex");
    expect(sig).toBe(expected);
  });

  it("includes the passphrase as a sorted field, not appended at the end", () => {
    const withPass = apiSignature(
      { "merchant-id": "1", version: "v1" },
      { amount: "100" },
      "zzz",
    );
    const manual = createHash("md5")
      .update("amount=100&merchant-id=1&passphrase=zzz&version=v1")
      .digest("hex");
    expect(withPass).toBe(manual);
  });

  it("gives the same answer whatever order the caller passes fields in", () => {
    const a = apiSignature({ version: "v1", "merchant-id": "1" }, { amount: "5" });
    const b = apiSignature({ "merchant-id": "1", version: "v1" }, { amount: "5" });
    expect(a).toBe(b);
  });

  it("changes when the amount changes", () => {
    const base = { "merchant-id": "1", version: "v1" };
    expect(apiSignature(base, { amount: "100" })).not.toBe(
      apiSignature(base, { amount: "200" }),
    );
  });
});

describe("apiTimestamp", () => {
  it("uses an explicit offset rather than a Z suffix", () => {
    const stamp = apiTimestamp(new Date("2026-09-08T10:00:00.123Z"));
    expect(stamp).toBe("2026-09-08T10:00:00+00:00");
    expect(stamp).not.toContain("Z");
    expect(stamp).not.toContain(".");
  });
});

describe("updateSubscriptionAmount", () => {
  it("refuses to call the live API from sandbox mode", async () => {
    const outcome = await updateSubscriptionAmount(
      { ...CONFIG, sandbox: true },
      "token-123",
      { amountCents: 99900 },
    );
    expect(outcome.status).toBe("skipped");
  });

  it("skips a workspace with no token instead of throwing", async () => {
    const outcome = await updateSubscriptionAmount(
      { ...CONFIG, sandbox: false },
      "",
      { amountCents: 99900 },
    );
    expect(outcome.status).toBe("skipped");
  });
});

describe("checkout field order", () => {
  const input = {
    config: {
      merchantId: "10000100",
      merchantKey: "46f0cd694581a",
      passphrase: "jt7NOE43FZPn",
      sandbox: true,
    },
    origin: "https://certly.co.za",
    orgId: "11111111-2222-3333-4444-555555555555",
    orgName: "MDC",
    slug: "mdc",
    billingEmail: "owner@example.co.za",
    amount: "999.00",
    seats: 50,
  };

  it("emits PayFast's documented attribute order, custom_int before custom_str", () => {
    const { fields } = checkoutFields(input);
    expect(fields.map(([k]) => k)).toEqual([
      "merchant_id",
      "merchant_key",
      "return_url",
      "cancel_url",
      "notify_url",
      "email_address",
      "m_payment_id",
      "amount",
      "item_name",
      "item_description",
      "custom_int1",
      "custom_str1",
      "custom_str2",
      "subscription_type",
      "frequency",
      "cycles",
      "signature",
    ]);
  });

  it("signs the fields in that same order with the passphrase appended last", () => {
    const { fields } = checkoutFields(input);
    const signature = fields.find(([k]) => k === "signature")?.[1];
    const withoutSignature = fields.filter(([k]) => k !== "signature");
    expect(signature).toBe(signPayload(withoutSignature, input.config.passphrase));
    const str = signatureStringFor(withoutSignature, input.config.passphrase);
    expect(str.startsWith("merchant_id=10000100&merchant_key=46f0cd694581a&")).toBe(true);
    expect(str.endsWith("&passphrase=jt7NOE43FZPn")).toBe(true);
    expect(str.indexOf("custom_int1=")).toBeLessThan(str.indexOf("custom_str1="));
  });

  it("keeps zero values in the signature string", () => {
    // PayFast omits a field whose value is an empty string and keeps one whose
    // value is "0". Dropping cycles=0 or custom_int1=0 the way PHP's empty()
    // would is a signature mismatch, not a fix.
    const { fields } = checkoutFields({ ...input, seats: 0 });
    const withoutSignature = fields.filter(([k]) => k !== "signature");
    const str = signatureStringFor(withoutSignature);
    expect(str.includes("cycles=0")).toBe(true);
    expect(str.includes("custom_int1=0")).toBe(true);
  });

  it("encodes the way PHP urlencode does, including tilde and space", () => {
    expect(phpUrlEncode("a b")).toBe("a+b");
    expect(phpUrlEncode("~")).toBe("%7E");
    expect(phpUrlEncode("it's (x)*")).toBe("it%27s+%28x%29%2A");
    expect(phpUrlEncode("https://certly.co.za/mdc/hr/billing?paid=1")).toBe(
      "https%3A%2F%2Fcertly.co.za%2Fmdc%2Fhr%2Fbilling%3Fpaid%3D1",
    );
  });
});

describe("secretShape", () => {
  it("reports absence rather than printing an empty mask", () => {
    expect(secretShape(undefined)).toBe("not set");
    expect(secretShape("")).toBe("not set");
  });

  it("keeps the first and last character so two candidates can be told apart", () => {
    expect(secretShape("jt7NOE43FZPn")).toBe("j**********n (12 characters)");
  });

  it("never prints the middle of a secret", () => {
    const shape = secretShape("correct horse battery staple");
    expect(shape.includes("horse")).toBe(false);
    expect(shape.includes("battery")).toBe(false);
  });
});

describe("signatureProbe", () => {
  const fields: PayFastField[] = [
    ["merchant_id", "10000100"],
    ["merchant_key", "46f0cd694581a"],
    ["return_url", "https://certly.co.za/mdc/hr/billing?paid=1"],
    ["cancel_url", "https://certly.co.za/mdc/hr/billing?cancelled=1"],
    ["notify_url", "https://certly.co.za/api/payfast/notify"],
    ["amount", "999.00"],
    ["item_name", "Certly subscription"],
    ["custom_int1", "0"],
    ["cycles", "0"],
  ];

  it("masks the passphrase in the string it prints", () => {
    const probe = signatureProbe(fields, "jt7NOE43FZPn");
    expect(probe.hashedString.includes("jt7NOE43FZPn")).toBe(false);
    expect(probe.hashedString.includes("passphrase=j**********n")).toBe(true);
  });

  it("says plainly when no passphrase is set at all", () => {
    const probe = signatureProbe(fields, undefined);
    expect(probe.passphraseShape).toBe("not set");
    expect(probe.hashedString.includes("passphrase=")).toBe(false);
  });
});

describe("diagnosticVariants", () => {
  const fields: PayFastField[] = [
    ["merchant_id", "10000100"],
    ["merchant_key", "46f0cd694581a"],
    ["return_url", "https://certly.co.za/mdc/hr/billing?paid=1"],
    ["cancel_url", "https://certly.co.za/mdc/hr/billing?cancelled=1"],
    ["notify_url", "https://certly.co.za/api/payfast/notify"],
    ["amount", "999.00"],
    ["item_name", "Certly subscription"],
    ["custom_int1", "0"],
    ["cycles", "0"],
  ];

  it("covers each hashing order against each passphrase state", () => {
    const keys = diagnosticVariants(fields).map((v) => v.key);
    expect(keys).toEqual([
      "posted-none",
      "posted-docs",
      "sorted-none",
      "sorted-docs",
      "bare-none",
      "bare-docs",
    ]);
  });

  it("adds the configured passphrase as its own candidate when one is set", () => {
    const keys = diagnosticVariants(fields, "something-else").map((v) => v.key);
    expect(keys).toContain("posted-configured");
    expect(keys).toContain("posted-none");
    expect(keys).toContain("posted-docs");
  });

  it("does not repeat the documented passphrase when it is the configured one", () => {
    const keys = diagnosticVariants(fields, SANDBOX_DOCS_PASSPHRASE).map((v) => v.key);
    expect(keys.filter((k) => k.endsWith("-docs"))).toHaveLength(0);
  });

  it("posts the full field list but hashes it sorted for the sorted variant", () => {
    const sorted = diagnosticVariants(fields).find((v) => v.key === "sorted-none")!;
    expect(sorted.fields.map(([k]) => k)).toEqual(fields.map(([k]) => k));
    expect(sorted.signed.map(([k]) => k)).toEqual([
      "amount",
      "cancel_url",
      "custom_int1",
      "cycles",
      "item_name",
      "merchant_id",
      "merchant_key",
      "notify_url",
      "return_url",
    ]);
    expect(sorted.signature).toBe(signPayload(sorted.signed));
  });

  it("strips the bare variant to the fields PayFast requires", () => {
    const bare = diagnosticVariants(fields).find((v) => v.key === "bare-none")!;
    expect(bare.fields.map(([k]) => k)).toEqual([
      "merchant_id",
      "merchant_key",
      "return_url",
      "cancel_url",
      "notify_url",
      "amount",
      "item_name",
    ]);
    expect(bare.fields.some(([k]) => k.startsWith("custom_"))).toBe(false);
    expect(bare.fields.some(([k]) => k === "cycles")).toBe(false);
  });

  it("signs each variant over exactly what it claims to sign", () => {
    for (const v of diagnosticVariants(fields, "something-else")) {
      expect(v.signature).toBe(signPayload(v.signed, v.passphrase));
    }
  });

  it("gives every variant a distinct signature", () => {
    const variants = diagnosticVariants(fields, "something-else");
    expect(new Set(variants.map((v) => v.signature)).size).toBe(variants.length);
  });
});
