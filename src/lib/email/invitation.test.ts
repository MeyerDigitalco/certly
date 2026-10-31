import { describe, it, expect } from "vitest";
import { buildInvitation, describeRole } from "./invitation";

const base = {
  orgName: "Meyer Digital Co.",
  invitedBy: "owner@meyerdigitalco.com",
  role: "admin",
  email: "safety@meyerdigitalco.com",
  link: "https://certly.co.za/invite/abc123",
  days: 14,
};

describe("buildInvitation", () => {
  it("names the company and the inviter in the subject, so it is not mistaken for spam", () => {
    const mail = buildInvitation(base);
    expect(mail.subject).toContain("Meyer Digital Co.");
    expect(mail.subject).toContain("owner@meyerdigitalco.com");
  });

  it("puts the link in both parts, because the plain text has to stand alone", () => {
    const mail = buildInvitation(base);
    expect(mail.text).toContain(base.link);
    expect(mail.html).toContain(base.link);
  });

  it("says which address they must sign in as", () => {
    const mail = buildInvitation(base);
    expect(mail.text).toContain("safety@meyerdigitalco.com");
    expect(mail.html).toContain("safety@meyerdigitalco.com");
  });

  it("reads one day rather than 1 days", () => {
    expect(buildInvitation({ ...base, days: 1 }).text).toContain("1 day.");
    expect(buildInvitation({ ...base, days: 14 }).text).toContain("14 days.");
  });

  it("escapes a company name that contains markup", () => {
    const mail = buildInvitation({ ...base, orgName: 'A & B <script>' });
    expect(mail.html).toContain("A &amp; B &lt;script&gt;");
    expect(mail.html).not.toContain("<script>");
  });

  it("tells someone who was not expecting it that nothing has happened yet", () => {
    const mail = buildInvitation(base);
    expect(mail.text).toContain("Nothing happens until you accept.");
  });

  it("carries no images or tracking, which is what gets a sender filtered", () => {
    const mail = buildInvitation(base);
    expect(mail.html).not.toContain("<img");
  });
});

describe("describeRole", () => {
  it("warns a viewer that the statutory reports are closed to them", () => {
    expect(describeRole("viewer")).toContain("cannot change records");
    expect(describeRole("viewer")).toContain("statutory reports");
  });

  it("describes an admin as able to pull the reports", () => {
    expect(describeRole("admin")).toContain("statutory reports");
    expect(describeRole("admin")).toContain("load certificates");
  });

  it("mentions billing only for an owner", () => {
    expect(describeRole("owner")).toContain("billing");
    expect(describeRole("admin")).not.toContain("billing");
    expect(describeRole("viewer")).not.toContain("billing");
  });

  it("falls back to the admin wording rather than saying nothing", () => {
    expect(describeRole("nonsense")).toBe(describeRole("admin"));
  });
});
