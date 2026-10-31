import { describe, it, expect, afterEach } from "vitest";
import { isSuperadmin, superadminEmails } from "./superadmin";
import { monthlyRands } from "./pricing";

const KEY = "CERTLY_SUPERADMIN_EMAILS";

function set(value: string | undefined): void {
  if (value === undefined) delete process.env[KEY];
  else process.env[KEY] = value;
}

afterEach(() => set(undefined));

describe("isSuperadmin", () => {
  it("fails closed when the variable is missing", () => {
    set(undefined);
    expect(isSuperadmin("anyone@example.com")).toBe(false);
  });

  it("fails closed when the variable is blank, which looks set in a dashboard", () => {
    set("");
    expect(isSuperadmin("anyone@example.com")).toBe(false);
    set("   ");
    expect(isSuperadmin("anyone@example.com")).toBe(false);
  });

  it("fails closed when a comma leaves empty entries", () => {
    set(",,");
    expect(superadminEmails()).toEqual([]);
    expect(isSuperadmin("")).toBe(false);
  });

  it("admits a listed address", () => {
    set("owner@example.com");
    expect(isSuperadmin("owner@example.com")).toBe(true);
  });

  it("ignores case and surrounding spaces, because a dashboard paste carries both", () => {
    set(" Owner@Example.com , second@example.com ");
    expect(isSuperadmin("OWNER@example.com")).toBe(true);
    expect(isSuperadmin("second@example.com")).toBe(true);
  });

  it("refuses an address that is not listed", () => {
    set("owner@example.com");
    expect(isSuperadmin("someone@example.com")).toBe(false);
  });

  it("refuses a missing address even when the list has entries", () => {
    set("owner@example.com");
    expect(isSuperadmin(null)).toBe(false);
    expect(isSuperadmin(undefined)).toBe(false);
    expect(isSuperadmin("  ")).toBe(false);
  });

  it("does not treat a substring as a match", () => {
    set("owner@example.com");
    expect(isSuperadmin("owner@example.com.attacker.test")).toBe(false);
    expect(isSuperadmin("notowner@example.com")).toBe(false);
  });
});

describe("monthlyRands", () => {
  it("is the base price up to the included headcount", () => {
    expect(monthlyRands(0)).toBe(999);
    expect(monthlyRands(50)).toBe(999);
  });

  it("adds the per person rate above it", () => {
    expect(monthlyRands(51)).toBe(1009);
    expect(monthlyRands(54)).toBe(1039);
  });
});
