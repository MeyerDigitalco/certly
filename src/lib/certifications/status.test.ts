import { describe, it, expect } from "vitest";
import { certStatus, statusLabel, todayIso } from "./status";

const TODAY = "2026-08-14";

describe("certStatus", () => {
  it("treats a missing expiry as an open-ended certificate", () => {
    expect(certStatus(null, 30, TODAY)).toEqual({
      status: "no_expiry",
      daysLeft: null,
    });
  });

  it("counts a certificate expiring today as still valid today", () => {
    const result = certStatus(TODAY, 30, TODAY);
    expect(result.status).toBe("due_soon");
    expect(result.daysLeft).toBe(0);
  });

  it("counts yesterday as expired", () => {
    expect(certStatus("2026-08-13", 30, TODAY)).toEqual({
      status: "expired",
      daysLeft: -1,
    });
  });

  it("puts the last day of the window inside it and the next day outside", () => {
    expect(certStatus("2026-09-13", 30, TODAY).status).toBe("due_soon");
    expect(certStatus("2026-09-13", 30, TODAY).daysLeft).toBe(30);
    expect(certStatus("2026-09-14", 30, TODAY).status).toBe("valid");
    expect(certStatus("2026-09-14", 30, TODAY).daysLeft).toBe(31);
  });

  it("honours a workspace window other than thirty days", () => {
    expect(certStatus("2026-08-21", 7, TODAY).status).toBe("due_soon");
    expect(certStatus("2026-08-22", 7, TODAY).status).toBe("valid");
    expect(certStatus("2026-11-01", 90, TODAY).status).toBe("due_soon");
  });

  it("does not shift the boundary with the server timezone", () => {
    const original = process.env.TZ;
    const answers = new Set<string>();
    for (const tz of [
      "UTC",
      "Africa/Johannesburg",
      "America/Los_Angeles",
      "Pacific/Kiritimati",
    ]) {
      process.env.TZ = tz;
      answers.add(
        `${certStatus(TODAY, 30, TODAY).status}:${certStatus(TODAY, 30, TODAY).daysLeft}`,
      );
      answers.add(
        `${certStatus("2026-08-13", 30, TODAY).status}:${certStatus("2026-08-13", 30, TODAY).daysLeft}`,
      );
    }
    process.env.TZ = original;
    expect([...answers].sort()).toEqual(["due_soon:0", "expired:-1"]);
  });

  it("crosses a month and a year end correctly", () => {
    expect(certStatus("2027-01-01", 30, "2026-12-31").daysLeft).toBe(1);
    expect(certStatus("2026-03-01", 30, "2026-02-28").daysLeft).toBe(1);
    expect(certStatus("2028-03-01", 30, "2028-02-28").daysLeft).toBe(2);
  });

  it("does not throw on a malformed date from the database", () => {
    expect(certStatus("not-a-date", 30, TODAY).status).toBe("no_expiry");
    expect(certStatus("", 30, TODAY).status).toBe("no_expiry");
  });

  it("falls back to a sane window when the org value is missing", () => {
    expect(certStatus("2026-09-01", Number.NaN, TODAY).status).toBe("due_soon");
    expect(certStatus("2027-09-01", Number.NaN, TODAY).status).toBe("valid");
  });
});

describe("todayIso", () => {
  it("returns a plain ISO date", () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("uses South African time, not the server's", () => {
    const sa = todayIso("Africa/Johannesburg");
    const kiritimati = todayIso("Pacific/Kiritimati");
    expect(sa).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(kiritimati).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("statusLabel", () => {
  it("labels every status", () => {
    expect(statusLabel("expired")).toBe("Expired");
    expect(statusLabel("due_soon")).toBe("Due soon");
    expect(statusLabel("valid")).toBe("Valid");
    expect(statusLabel("no_expiry")).toBe("No expiry");
  });
});
