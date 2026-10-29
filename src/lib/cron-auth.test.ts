import { describe, it, expect, afterEach } from "vitest";
import { authorisedCron, checkCronAuth } from "./cron-auth";

const ORIGINAL = process.env.CRON_SECRET;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL;
});

function req(headers: Record<string, string>, url = "https://certly.co.za/api/cron/digest") {
  return new Request(url, { headers });
}

describe("authorisedCron", () => {
  it("accepts the secret as a bearer token", () => {
    process.env.CRON_SECRET = "s3cret-value";
    expect(authorisedCron(req({ authorization: "Bearer s3cret-value" }))).toBe(true);
  });

  it("accepts the bearer prefix in any case, and bare", () => {
    process.env.CRON_SECRET = "s3cret-value";
    expect(authorisedCron(req({ authorization: "bearer s3cret-value" }))).toBe(true);
    expect(authorisedCron(req({ authorization: "s3cret-value" }))).toBe(true);
  });

  it("refuses the secret in the query string", () => {
    process.env.CRON_SECRET = "s3cret-value";
    expect(
      authorisedCron(req({}, "https://certly.co.za/api/cron/digest?key=s3cret-value")),
    ).toBe(false);
  });

  it("refuses a wrong secret", () => {
    process.env.CRON_SECRET = "s3cret-value";
    expect(authorisedCron(req({ authorization: "Bearer wrong" }))).toBe(false);
  });

  it("refuses when no secret is presented", () => {
    process.env.CRON_SECRET = "s3cret-value";
    expect(authorisedCron(req({}))).toBe(false);
  });

  it("fails closed when CRON_SECRET is not set", () => {
    delete process.env.CRON_SECRET;
    expect(authorisedCron(req({ authorization: "Bearer anything" }))).toBe(false);
    expect(authorisedCron(req({}))).toBe(false);
  });

  it("does not reveal the secret length by refusing early", () => {
    process.env.CRON_SECRET = "s3cret-value";
    expect(authorisedCron(req({ authorization: "Bearer x" }))).toBe(false);
    expect(
      authorisedCron(req({ authorization: `Bearer ${"x".repeat(500)}` })),
    ).toBe(false);
  });
});

describe("checkCronAuth reasons", () => {
  it("separates a missing secret from a wrong one", () => {
    delete process.env.CRON_SECRET;
    expect(checkCronAuth(req({ authorization: "Bearer anything" })).reason).toBe(
      "no_secret_configured",
    );

    process.env.CRON_SECRET = "s3cret-value";
    expect(checkCronAuth(req({ authorization: "Bearer wrong" })).reason).toBe(
      "mismatch",
    );
  });

  it("separates a wrong credential from none being sent at all", () => {
    // These have opposite fixes: rotate the secret, or change how the job
    // authenticates because the platform is not sending one.
    process.env.CRON_SECRET = "s3cret-value";
    expect(checkCronAuth(req({})).reason).toBe("no_credential_presented");
    expect(checkCronAuth(req({ authorization: "Bearer " })).reason).toBe(
      "no_credential_presented",
    );
  });

  it("reports which relevant headers arrived, by name", () => {
    process.env.CRON_SECRET = "s3cret-value";
    const result = checkCronAuth(
      req({
        authorization: "Bearer wrong",
        "x-vercel-cron": "1",
        "x-vercel-id": "cpt1::abc",
        "user-agent": "vercel-cron/1.0",
      }),
    );
    expect(result.saw).toBe("authorization,x-vercel-cron,x-vercel-id");
    expect(result.saw).not.toContain("user-agent");
  });

  it("says none when nothing relevant arrived", () => {
    process.env.CRON_SECRET = "s3cret-value";
    expect(checkCronAuth(req({ "user-agent": "curl" })).saw).toBe("none");
  });

  it("never puts a header value in what it reports", () => {
    process.env.CRON_SECRET = "s3cret-value";
    const result = checkCronAuth(
      req({ authorization: "Bearer s3cret-value", "x-vercel-cron": "1" }),
    );
    expect(result.ok).toBe(true);
    expect(result.saw).not.toContain("s3cret-value");
    expect(JSON.stringify(result)).not.toContain("s3cret-value");
  });

  it("does not accept a platform header as proof on its own", () => {
    // x-vercel-cron can be sent by anyone. Trusting it would make a route
    // that reads every workspace public.
    process.env.CRON_SECRET = "s3cret-value";
    expect(checkCronAuth(req({ "x-vercel-cron": "1" })).ok).toBe(false);
  });
});
