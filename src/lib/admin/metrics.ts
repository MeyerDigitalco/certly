/* eslint-disable @typescript-eslint/no-explicit-any */

import { createAdminClient } from "@/lib/supabase/admin";
import { monthlyRands } from "./pricing";

/**
 * Numbers about the business, not about anybody's people.
 *
 * Deliberately counts and dates only. This module runs under the service
 * role and therefore sees every workspace, which is exactly the access the
 * rest of the product spends its effort preventing, so the rule here is that
 * nothing identifying an employee leaves it: no names, no identification
 * numbers, no documents, no register rows. Workspace names and owner
 * addresses are the customer relationship and stay.
 *
 * It answers what the database knows. It cannot answer how many people
 * looked at the marketing site and left, because nobody who leaves writes a
 * row. That question belongs to the analytics provider.
 */

export interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  subscriptionStatus: string;
  trialEndsAt: string;
  createdAt: string;
  billingExempt: boolean;
  owner: string;
  members: number;
  people: number;
  certifications: number;
  lastActivity: string | null;
}

export interface Funnel {
  accounts: number;
  accountsWithoutWorkspace: number;
  workspaces: number;
  trialsLive: number;
  trialsLapsedUnpaid: number;
  paying: number;
  cancelled: number;
  exempt: number;
}

export interface AdminMetrics {
  funnel: Funnel;
  newAccounts7: number;
  newWorkspaces7: number;
  newWorkspaces30: number;
  activeWorkspaces7: number;
  totals: { people: number; certifications: number; suggestions: number };
  mrrRands: number;
  workspaces: WorkspaceRow[];
  generatedAt: string;
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function tally<T extends string>(values: T[]): Map<T, number> {
  const out = new Map<T, number>();
  for (const v of values) out.set(v, (out.get(v) ?? 0) + 1);
  return out;
}

export async function getAdminMetrics(): Promise<AdminMetrics> {
  const admin: any = createAdminClient();
  const now = new Date().toISOString();

  const [orgsRes, membersRes, employeesRes, certsRes, auditRes, suggestionsRes] =
    await Promise.all([
      admin
        .from("organisations")
        .select(
          "id, name, slug, plan, subscription_status, trial_ends_at, created_at, billing_exempt",
        )
        .order("created_at", { ascending: false }),
      admin.from("org_members").select("organisation_id, user_id, role"),
      // Only the keys needed to count. Selecting * here would pull every
      // employee record in the product into this process for no reason.
      admin.from("employees").select("organisation_id, terminated_at"),
      admin.from("certifications").select("organisation_id"),
      admin.from("audit_log").select("organisation_id, at"),
      admin.from("suggestions").select("id"),
    ]);

  const orgs = (orgsRes.data ?? []) as any[];
  const members = (membersRes.data ?? []) as any[];
  const employees = (employeesRes.data ?? []) as any[];
  const certs = (certsRes.data ?? []) as any[];
  const audit = (auditRes.data ?? []) as any[];

  const memberCount = tally(members.map((m) => String(m.organisation_id)));
  const certCount = tally(certs.map((c) => String(c.organisation_id)));
  const peopleCount = tally(
    employees
      .filter((e) => !e.terminated_at)
      .map((e) => String(e.organisation_id)),
  );

  const lastActivity = new Map<string, string>();
  for (const row of audit) {
    const key = String(row.organisation_id);
    const at = String(row.at);
    const held = lastActivity.get(key);
    if (!held || at > held) lastActivity.set(key, at);
  }

  // Accounts come from the auth schema, which has no foreign key into
  // org_members, so an account with no membership is the only signal the
  // database holds for somebody who signed up and then stopped.
  const { data: userList } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const users = (userList?.users ?? []) as Array<{
    id: string;
    email: string | null;
    created_at: string;
  }>;
  const memberUserIds = new Set(members.map((m) => String(m.user_id)));

  const ownerByOrg = new Map<string, string>();
  const emailById = new Map(users.map((u) => [u.id, u.email ?? ""]));
  for (const m of members) {
    if (m.role === "owner") {
      ownerByOrg.set(
        String(m.organisation_id),
        emailById.get(String(m.user_id)) ?? "unknown",
      );
    }
  }

  const workspaces: WorkspaceRow[] = orgs.map((o) => ({
    id: String(o.id),
    name: String(o.name),
    slug: String(o.slug),
    plan: String(o.plan),
    subscriptionStatus: String(o.subscription_status),
    trialEndsAt: String(o.trial_ends_at),
    createdAt: String(o.created_at),
    billingExempt: Boolean(o.billing_exempt),
    owner: ownerByOrg.get(String(o.id)) ?? "no owner",
    members: memberCount.get(String(o.id)) ?? 0,
    people: peopleCount.get(String(o.id)) ?? 0,
    certifications: certCount.get(String(o.id)) ?? 0,
    lastActivity: lastActivity.get(String(o.id)) ?? null,
  }));

  // Our own and comped workspaces are not prospects, not customers and not
  // lost trials. Counting them anywhere else makes every conversion number
  // wrong, which is the whole reason to look at this page.
  const exempt = workspaces.filter((w) => w.billingExempt);
  const commercial = workspaces.filter((w) => !w.billingExempt);

  const paying = commercial.filter((w) => w.subscriptionStatus === "active");
  const cancelled = commercial.filter(
    (w) => w.subscriptionStatus === "cancelled",
  );
  const trialsLive = commercial.filter(
    (w) => w.subscriptionStatus !== "active" && w.trialEndsAt > now,
  );
  // The number that matters most: they took the trial and did not convert.
  const trialsLapsedUnpaid = commercial.filter(
    (w) =>
      w.subscriptionStatus !== "active" &&
      w.subscriptionStatus !== "cancelled" &&
      w.trialEndsAt <= now,
  );

  const seven = daysAgo(7);
  const thirty = daysAgo(30);

  return {
    funnel: {
      accounts: users.length,
      accountsWithoutWorkspace: users.filter((u) => !memberUserIds.has(u.id))
        .length,
      workspaces: workspaces.length,
      trialsLive: trialsLive.length,
      trialsLapsedUnpaid: trialsLapsedUnpaid.length,
      paying: paying.length,
      cancelled: cancelled.length,
      exempt: exempt.length,
    },
    newAccounts7: users.filter((u) => u.created_at > seven).length,
    newWorkspaces7: workspaces.filter((w) => w.createdAt > seven).length,
    newWorkspaces30: workspaces.filter((w) => w.createdAt > thirty).length,
    activeWorkspaces7: workspaces.filter(
      (w) => w.lastActivity !== null && w.lastActivity > seven,
    ).length,
    totals: {
      people: employees.filter((e) => !e.terminated_at).length,
      certifications: certs.length,
      suggestions: (suggestionsRes.data ?? []).length,
    },
    mrrRands: paying.reduce((sum, w) => sum + monthlyRands(w.people), 0),
    workspaces,
    generatedAt: now,
  };
}
