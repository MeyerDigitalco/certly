import { describe, it, expect, afterEach } from "vitest";
import { authorisedCron } from "./cron-auth";

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
