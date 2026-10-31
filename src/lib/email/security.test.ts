import { describe, it, expect } from "vitest";
import { buildPasswordChanged, formatMoment } from "./security";

const base = {
  email: "admin@meyerdigitalco.com",
  origin: "https://certly.co.za",
  when: new Date("2026-10-31T07:05:00Z"),
};

describe("formatMoment", () => {
  it("reads in South African order and names the zone", () => {
    expect(formatMoment(base.when)).toBe("31/10/2026 at 09:05 SAST");
  });

  it("keeps a 24 hour clock, so 09:05 is never read as evening", () => {
    expect(formatMoment(new Date("2026-10-31T19:30:00Z"))).toBe(
      "31/10/2026 at 21:30 SAST",
    );
  });
});

describe("buildPasswordChanged", () => {
  it("names the account, so a person with two addresses knows which one", () => {
    const mail = buildPasswordChanged(base);
    expect(mail.text).toContain("admin@meyerdigitalco.com");
    expect(mail.html).toContain("admin@meyerdigitalco.com");
  });

  it("says when it happened", () => {
    const mail = buildPasswordChanged(base);
    expect(mail.text).toContain("31/10/2026 at 09:05 SAST");
  });

  it("points at the ordinary reset page rather than a one-click undo", () => {
    const mail = buildPasswordChanged(base);
    expect(mail.text).toContain("https://certly.co.za/forgot-password");
    expect(mail.html).toContain("https://certly.co.za/forgot-password");
  });

  it("carries no token, because this mail goes out after the fact", () => {
    const mail = buildPasswordChanged(base);
    expect(mail.html).not.toMatch(/token|invite\//i);
  });

  it("tells somebody who did not do it what to do", () => {
    const mail = buildPasswordChanged(base);
    expect(mail.text).toContain("somebody else has access");
  });
});
