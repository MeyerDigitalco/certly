import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { certStatus } from "@/lib/certifications/status";

/**
 * The register's status rule now lives in two places: certStatus in
 * TypeScript, used by renewals, the site dashboard and the safety file pack,
 * and the register_rows view in SQL, used by the register screen and the KPI
 * cards. Two implementations of one rule drift, and when they drift a
 * supervisor sees a certificate as valid on one screen and expired on
 * another.
 *
 * These tests pin the SQL side to the same boundaries the TypeScript side is
 * tested against, by reading the migration rather than the database. They
 * cannot prove Postgres evaluates it correctly, only that the rule written
 * down is the same rule. Running the migration and comparing a real row is
 * still the check that matters.
 */

const MIGRATIONS = resolve(__dirname, "..", "..", "..", "supabase", "migrations");

function viewSql(): string {
  const file = readdirSync(MIGRATIONS).find((f) => f.includes("register_view"));
  if (!file) throw new Error("register_view migration is missing");
  return readFileSync(join(MIGRATIONS, file), "utf8");
}

const SQL = viewSql();

describe("register_rows view", () => {
  it("is security_invoker, which is the only thing keeping RLS on", () => {
    expect(SQL).toMatch(/with\s*\(\s*security_invoker\s*=\s*true\s*\)/i);
  });

  it("never grants more than select, and only to authenticated", () => {
    const grants = SQL.match(/grant[^;]+;/gi) ?? [];
    expect(grants.length).toBeGreaterThan(0);
    for (const grant of grants) {
      expect(grant.toLowerCase()).toContain("select");
      expect(grant.toLowerCase()).toContain("to authenticated");
      expect(grant.toLowerCase()).not.toContain("insert");
      expect(grant.toLowerCase()).not.toContain("update");
      expect(grant.toLowerCase()).not.toContain("delete");
      expect(grant.toLowerCase()).not.toMatch(/\ball\b/);
    }
  });

  it("exposes organisation_id, without which nothing can scope a query to one workspace", () => {
    expect(SQL).toMatch(/organisation_id\s+as\s+organisation_id/i);
  });

  it("counts today in South African time, not UTC", () => {
    expect(SQL).toContain("Africa/Johannesburg");
    const utcNow = SQL.match(/current_date/gi) ?? [];
    expect(utcNow).toHaveLength(0);
  });

  it("reads the due-soon window from the organisation rather than hard coding it", () => {
    expect(SQL).toContain("o.due_soon_days");
    expect(SQL).not.toMatch(/interval\s+'30\s+days'/i);
  });

  it("uses the same four status values the application knows", () => {
    for (const status of ["no_expiry", "expired", "due_soon", "valid"]) {
      expect(SQL).toContain(`'${status}'`);
    }
  });

  it("treats a certificate expiring today as due_soon, matching certStatus", () => {
    // SQL: expiry_date < today is expired, so expiry_date = today falls
    // through to the due_soon branch. The TypeScript agrees.
    expect(SQL).toMatch(/expiry_date\s*\n?\s*<\s*\(now\(\)/);
    expect(SQL).not.toMatch(/expiry_date\s*\n?\s*<=\s*\(now\(\)\s*at time zone 'Africa\/Johannesburg'\)::date\s*then 'expired'/);

    const today = "2026-09-08";
    expect(certStatus(today, 30, today).status).toBe("due_soon");
    expect(certStatus("2026-09-07", 30, today).status).toBe("expired");
  });

  it("puts the last day of the window inside it, matching certStatus", () => {
    // SQL: expiry_date <= today + due_soon_days is due_soon.
    expect(SQL).toMatch(/<=\s*\(now\(\) at time zone 'Africa\/Johannesburg'\)::date\s*\n?\s*\+\s*o\.due_soon_days/);

    const today = "2026-09-08";
    expect(certStatus("2026-10-08", 30, today).status).toBe("due_soon");
    expect(certStatus("2026-10-09", 30, today).status).toBe("valid");
  });

  it("orders urgency the way the application sorts it", () => {
    const urgency = SQL.slice(SQL.indexOf("as urgency") - 400);
    expect(urgency).toContain("then 3");
    expect(urgency).toContain("then 0");
    expect(urgency).toContain("then 1");
    expect(urgency).toContain("else 2");
  });

  it("indexes the columns the register filters and sorts on", () => {
    for (const index of [
      "idx_certs_org_expiry",
      "idx_employees_org_surname",
      "idx_employees_org_site",
    ]) {
      expect(SQL).toContain(index);
    }
  });
});

describe("register query layer", () => {
  it("no longer keeps a JavaScript copy of the filter and sort rules", async () => {
    const queries = readFileSync(
      resolve(__dirname, "queries.ts"),
      "utf8",
    );
    expect(queries).not.toContain("applyRegisterFilters");
    expect(queries).not.toContain("sortRegisterRows");
    expect(queries).toContain("register_rows");
  });

  it("scopes every register read to one workspace", () => {
    const queries = readFileSync(resolve(__dirname, "queries.ts"), "utf8");
    const reads = queries.split('.from("register_rows")').slice(1);
    expect(reads.length).toBeGreaterThan(0);
    for (const read of reads) {
      const statement = read.slice(0, read.indexOf(";"));
      expect(statement).toContain('.eq("organisation_id", orgId)');
    }
  });
});
