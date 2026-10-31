import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, relative } from "node:path";

/**
 * Tenant isolation is the claim the whole product rests on, and it is enforced
 * by a convention rather than by the type system: every statement that touches
 * a tenant-owned table filters on organisation_id, because RLS lets a signed-in
 * user read every workspace they belong to, not just the one in the URL.
 *
 * These tests read the source and fail when a statement breaks the convention.
 * They do not talk to Postgres, so they prove the filter is written, not that
 * the database enforces it. The RLS policies in supabase/migrations are the
 * other half of the guarantee.
 */

const SRC = resolve(__dirname, "..", "..");

const TENANT_TABLES = [
  "employees",
  "certifications",
  "training_types",
  "company_documents",
  "org_members",
  "audit_log",
  "billing_events",
  "extraction_drafts",
  "register_rows",
  "invitations",
  "labour_plans",
  "onboarding_candidates",
  "absences",
  "training_plans",
  "compliance_snapshots",
  "rate_limits",
];

const KEYED_BY_OWN_ID = ["organisations"];

/**
 * Statements that read across workspaces on purpose. Each one is a decision,
 * not an oversight, so it is named here rather than excluded by a pattern.
 */
const CROSS_ORG_BY_DESIGN: Record<string, string> = {
  "app/[org]/hr/settings/actions.ts::isSoleMembership":
    "Counts every workspace a user belongs to, which is the whole question it answers.",
  "app/workspace/page.tsx::WorkspacePage":
    "Finds the signed-in user's own first workspace, scoped by their user_id. The workspace is the answer, not the question.",
  "app/invite/[token]/accept.ts::acceptInvitation":
    "Looks an invitation up by its token hash, which is the only identifier the invitee holds. The workspace is the answer, not the question.",
  "app/invite/[token]/accept.ts::declineInvitation":
    "Same token lookup, and it verifies the signed-in address matches before writing.",
  "app/invite/[token]/page.tsx::InvitePage":
    "Renders an invitation found by token hash, before the visitor belongs to any workspace.",
  "app/invite/[token]/create-account.ts::createInvitedAccount":
    "Same token lookup, for somebody who has no account yet and so belongs to no workspace. It creates an account for the invited address only, and refuses if that address already has one.",
};

/**
 * Reads that sweep every workspace on purpose. Only scheduled jobs belong
 * here: they run under the service role with no signed-in user, so nothing
 * else is protecting these rows. Each is gated on CRON_SECRET and each
 * narrows to one organisation_id before touching any tenant data.
 */
const ALL_WORKSPACES_BY_DESIGN: Record<string, string> = {
  "app/api/cron/digest/route.ts::GET":
    "The weekly digest iterates every workspace by definition. Gated on CRON_SECRET; per-workspace reads below it all filter on organisation_id.",
  "app/api/cron/reconcile-seats/route.ts::GET":
    "Seat reconciliation iterates every active subscription. Gated on CRON_SECRET; the seat count filters on organisation_id.",
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (
      (full.endsWith(".ts") || full.endsWith(".tsx")) &&
      !full.endsWith(".test.ts")
    ) {
      out.push(full);
    }
  }
  return out;
}

type SourceFile = { path: string; source: string };

const FILES: SourceFile[] = walk(SRC).map((f) => ({
  path: relative(SRC, f).replace(/\\/g, "/"),
  source: readFileSync(f, "utf8"),
}));

function occurrences(source: string, needle: string): number[] {
  const found: number[] = [];
  let at = source.indexOf(needle);
  while (at !== -1) {
    found.push(at);
    at = source.indexOf(needle, at + needle.length);
  }
  return found;
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

type FunctionSpan = { name: string; start: number; end: number };

function functionSpans(source: string): FunctionSpan[] {
  const spans: FunctionSpan[] = [];
  const re = /function\s+(\w+)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    spans.push({ name: match[1], start: match.index, end: source.length });
  }
  for (let i = 0; i < spans.length - 1; i += 1) {
    spans[i].end = spans[i + 1].start;
  }
  return spans;
}

function enclosingFunction(spans: FunctionSpan[], index: number): FunctionSpan | null {
  for (const span of spans) {
    if (index >= span.start && index < span.end) return span;
  }
  return null;
}

/** One chained builder expression, from `.from("table")` to its terminator. */
function statementAt(source: string, index: number): string {
  const end = source.indexOf(";", index);
  return source.slice(index, end === -1 ? source.length : end);
}

type Hit = {
  file: string;
  line: number;
  table: string;
  statement: string;
  fnName: string;
  fnBody: string;
  key: string;
};

function tenantHits(): Hit[] {
  const hits: Hit[] = [];
  for (const file of FILES) {
    const spans = functionSpans(file.source);
    for (const table of TENANT_TABLES) {
      for (const at of occurrences(file.source, `.from("${table}")`)) {
        const span = enclosingFunction(spans, at);
        const fnName = span?.name ?? "<module scope>";
        hits.push({
          file: file.path,
          line: lineOf(file.source, at),
          table,
          statement: statementAt(file.source, at),
          fnName,
          fnBody: span
            ? file.source.slice(span.start, span.end)
            : file.source,
          key: `${file.path}::${fnName}`,
        });
      }
    }
  }
  return hits;
}

const HITS = tenantHits();

describe("tenant isolation", () => {
  it("finds enough statements to check, so the audit is not vacuous", () => {
    expect(HITS.length).toBeGreaterThan(40);
  });

  it("filters every read, update and delete by organisation_id", () => {
    const offenders = HITS.filter((hit) => {
      if (CROSS_ORG_BY_DESIGN[hit.key]) return false;
      if (/\.(insert|upsert)\(/.test(hit.statement)) return false;
      return !(
        hit.statement.includes('.eq("organisation_id"') ||
        hit.statement.includes('.in("organisation_id"')
      );
    }).map(
      (hit) =>
        `${hit.file}:${hit.line} ${hit.fnName} reads "${hit.table}" without an organisation_id filter`,
    );
    expect(offenders).toEqual([]);
  });

  it("stamps organisation_id on every insert and upsert", () => {
    const offenders = HITS.filter((hit) => {
      if (CROSS_ORG_BY_DESIGN[hit.key]) return false;
      if (!/\.(insert|upsert)\(/.test(hit.statement)) return false;
      return !/organisation_id:\s*orgId/.test(hit.fnBody);
    }).map(
      (hit) =>
        `${hit.file}:${hit.line} ${hit.fnName} writes "${hit.table}" without setting organisation_id to the passed orgId`,
    );
    expect(offenders).toEqual([]);
  });

  it("keeps the cross-workspace allowlist honest", () => {
    const live = new Set(HITS.map((hit) => hit.key));
    const stale = Object.keys(CROSS_ORG_BY_DESIGN).filter(
      (key) => !live.has(key),
    );
    expect(stale).toEqual([]);
  });

  it("never reads organisations without narrowing to one row", () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      const spans = functionSpans(file.source);
      for (const table of KEYED_BY_OWN_ID) {
        for (const at of occurrences(file.source, `.from("${table}")`)) {
          const fnName = enclosingFunction(spans, at)?.name ?? "<module scope>";
          if (ALL_WORKSPACES_BY_DESIGN[`${file.path}::${fnName}`]) continue;
          const statement = statementAt(file.source, at);
          const narrowed =
            statement.includes('.eq("id"') ||
            statement.includes('.eq("slug"') ||
            statement.includes('.in("id"') ||
            /\.(insert|upsert)\(/.test(statement);
          if (!narrowed) {
            offenders.push(
              `${file.path}:${lineOf(file.source, at)} ${fnName} reads organisations without an id or slug filter`,
            );
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the all-workspaces allowlist to scheduled jobs behind a secret", () => {
    for (const [key, reason] of Object.entries(ALL_WORKSPACES_BY_DESIGN)) {
      const path = key.split("::")[0];
      expect(path, `${key} is not a cron route`).toContain("api/cron/");
      expect(reason).toContain("CRON_SECRET");
      const file = FILES.find((f) => f.path === path);
      expect(file, `${path} no longer exists`).toBeDefined();

      // The check itself lives in one shared module rather than being copied
      // into each route, so this follows the import instead of looking for
      // the secret inline. Both halves are asserted: the route must refuse
      // before doing anything, and the helper must be the real check.
      expect(
        file!.source,
        `${path} must gate on the shared cron check before reading every workspace`,
      ).toMatch(/\b(checkCronAuth|authorisedCron)\(request\)/);
      expect(file!.source).toContain('from "@/lib/cron-auth"');
    }

    const helper = FILES.find((f) => f.path === "lib/cron-auth.ts");
    expect(helper, "lib/cron-auth.ts no longer exists").toBeDefined();
    expect(helper!.source).toContain("process.env.CRON_SECRET");
    expect(helper!.source).toContain("timingSafeEqual");

    // The secret must not be readable from the URL. It would be written to
    // the platform access log, and these routes read every workspace.
    for (const f of FILES) {
      if (!f.path.includes("api/cron/") && f.path !== "lib/cron-auth.ts") continue;
      expect(
        /searchParams\.get\(\s*["']key["']\s*\)/.test(f.source),
        `${f.path} accepts the cron secret in the query string`,
      ).toBe(false);
    }
  });
});

describe("tenant isolation: call shape", () => {
  it("gives every exported query orgId as its first parameter", () => {
    const source = readFileSync(join(SRC, "lib/hr/queries.ts"), "utf8");
    const offenders: string[] = [];
    const re = /export async function (\w+)\(\s*(\w+)/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(source)) !== null) {
      if (match[2] !== "orgId") {
        offenders.push(`${match[1]} takes "${match[2]}" first, not orgId`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("makes every exported mutation re-verify the caller against the passed orgId", () => {
    const source = readFileSync(join(SRC, "lib/hr/mutations.ts"), "utf8");
    const offenders: string[] = [];
    const starts = occurrences(source, "export async function");

    for (let i = 0; i < starts.length; i += 1) {
      const from = starts[i];
      const to = i + 1 < starts.length ? starts[i + 1] : source.length;
      const body = source.slice(from, to);
      const name = /export async function (\w+)/.exec(body)?.[1] ?? "unknown";
      const verifies = /await assert(Owner|Admin|AdminUser)\(\s*orgId/.test(body);
      if (!verifies) {
        offenders.push(`${name} does not re-verify the caller against orgId`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('"use server" modules', () => {
  it("export only async functions", () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      if (!/^\s*["']use server["']/.test(file.source.slice(0, 200))) continue;
      const re = /^export\s+(?!async function)(?!type\b)(?!interface\b)(\w+)/gm;
      let match: RegExpExecArray | null;
      while ((match = re.exec(file.source)) !== null) {
        offenders.push(
          `${file.path}:${lineOf(file.source, match.index)} exports a non-async "${match[1]}"`,
        );
      }
    }
    expect(offenders).toEqual([]);
  });
});

const CREATE_TABLE =
  /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/i;
const ADD_ORG_COLUMN =
  /alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?organisation_id/i;

const VIEWS = ["register_rows"];

describe("the tenant table list itself", () => {
  /**
   * TENANT_TABLES is hand written, and every audit in this file is scoped by
   * it, so a table added to the schema and forgotten here is not merely
   * unlisted, it is silently exempt from every isolation check. Reading the
   * migrations back makes that impossible to do quietly.
   */
  function tablesWithOrgColumn(): string[] {
    const dir = resolve(SRC, "..", "supabase", "migrations");
    const found = new Set<string>();
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

    for (const name of files) {
      const sql = readFileSync(resolve(dir, name), "utf8");
      for (const statement of sql.split(";")) {
        if (!statement.includes("organisation_id")) continue;

        const created = CREATE_TABLE.exec(statement);
        if (created) {
          found.add(created[1]);
          continue;
        }
        const altered = ADD_ORG_COLUMN.exec(statement);
        if (altered) found.add(altered[1]);
      }
    }
    return [...found].sort();
  }

  it("finds the organisation_id tables in the migrations at all", () => {
    const tables = tablesWithOrgColumn();
    expect(tables.length).toBeGreaterThan(8);
    expect(tables).toContain("employees");
    expect(tables).toContain("certifications");
  });

  it("lists every table that has an organisation_id column", () => {
    const missing = tablesWithOrgColumn().filter(
      (t) => !TENANT_TABLES.includes(t) && !KEYED_BY_OWN_ID.includes(t),
    );
    expect(missing).toEqual([]);
  });

  it("does not list a table that no longer exists in the schema", () => {
    const known = new Set([...tablesWithOrgColumn(), ...VIEWS]);
    const stale = TENANT_TABLES.filter((t) => !known.has(t));
    expect(stale).toEqual([]);
  });
});
