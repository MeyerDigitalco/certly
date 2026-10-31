import { describe, it, expect } from "vitest";
import { buildSuggestion, subjectLine } from "./suggestion";

const base = {
  orgName: "Meyer Digital Co.",
  slug: "mdc",
  fromEmail: "safety@meyerdigitalco.com",
  body: "The renewals list should let me filter by crew, not only by site.",
  context: "/mdc/hr/renewals",
  origin: "https://certly.co.za",
};

describe("subjectLine", () => {
  it("puts the gist in the subject, so an inbox list is readable", () => {
    expect(subjectLine("MDC", "Add a crew filter")).toBe(
      "Certly suggestion from MDC: Add a crew filter",
    );
  });

  it("truncates a long first line rather than filling the subject", () => {
    const long = "a".repeat(200);
    const subject = subjectLine("MDC", long);
    expect(subject.length).toBeLessThan(90);
    expect(subject.endsWith("...")).toBe(true);
  });

  it("uses only the first line when somebody writes an essay", () => {
    const subject = subjectLine("MDC", "Crew filter\n\nBecause we run four crews.");
    expect(subject).toBe("Certly suggestion from MDC: Crew filter");
  });

  it("skips leading blank lines rather than producing a bare subject", () => {
    expect(subjectLine("MDC", "\n\nSomething")).toBe(
      "Certly suggestion from MDC: Something",
    );
  });

  it("falls back to the bare subject when there is nothing but whitespace", () => {
    expect(subjectLine("MDC", "   ")).toBe("Certly suggestion from MDC");
  });
});

describe("buildSuggestion", () => {
  it("carries who, where and what, which is what decides whether to build it", () => {
    const mail = buildSuggestion(base);
    expect(mail.text).toContain("safety@meyerdigitalco.com");
    expect(mail.text).toContain("/mdc/hr/renewals");
    expect(mail.text).toContain("filter by crew");
  });

  it("says the screen was not recorded rather than leaving it blank", () => {
    const mail = buildSuggestion({ ...base, context: "" });
    expect(mail.text).toContain("Screen: not recorded");
  });

  it("escapes a body containing markup, because this one is typed by a person", () => {
    const mail = buildSuggestion({ ...base, body: "<script>alert(1)</script>" });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
  });

  it("links back to the workspace that sent it", () => {
    const mail = buildSuggestion(base);
    expect(mail.text).toContain("https://certly.co.za/mdc/hr");
  });
});
