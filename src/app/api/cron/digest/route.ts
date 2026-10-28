/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { certStatus } from "@/lib/certifications/status";
import { certifiedCopyStatus, recertifyBy } from "@/lib/hr/certified-copy";
import {
  companyDocumentRenewals,
  type RenewalBuckets,
  type RenewalRow,
} from "@/lib/hr/queries";
import { buildDigest, digestIsWorthSending } from "@/lib/email/digest";
import { sendEmail, emailIsConfigured } from "@/lib/email/send";
import { accessFor, isPlan, isSubscriptionStatus } from "@/lib/billing/plan";
import { authorisedCron } from "@/lib/cron-auth";



export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Weekly expiry digest.
 *
 * Runs under the service role across every workspace, which is exactly the
 * kind of endpoint that must never be reachable by a stranger: it reads every
 * tenant's register. It is gated on a shared secret compared in constant time,
 * and refuses outright when no secret is configured rather than defaulting to
 * open.
 *
 * The per-workspace queries below filter on organisation_id like everything
 * else. The service role bypasses RLS, so that filter is not defence in depth
 * here, it is the only thing separating one customer's people from another's.
 *
 * A read-only workspace still gets its digest. They are behind on an invoice,
 * not on their obligations, and telling them their crew has lapsed is the
 * thing most likely to get them to pay.
 */


export async function GET(request: NextRequest) {
  if (!authorisedCron(request)) {
    return new Response("Not found", { status: 404 });
  }

  if (!emailIsConfigured()) {
    return Response.json({
      ok: true,
      skipped: "No sending domain configured. Nothing was sent.",
    });
  }

  const origin = process.env.CERTLY_PUBLIC_ORIGIN ?? "https://certly.co.za";
  const admin: any = createAdminClient();

  const { data: orgs } = await admin
    .from("organisations")
    .select(
      "id, slug, name, due_soon_days, plan, subscription_status, trial_ends_at, current_period_end",
    );

  const report: Array<{
    slug: string;
    recipients: number;
    sent: number;
    skipped: number;
    failed: number;
  }> = [];

  for (const org of (orgs ?? []) as Array<{
    id: string;
    slug: string;
    name: string;
    due_soon_days: number;
    plan: string;
    subscription_status: string;
    trial_ends_at: string;
    current_period_end: string | null;
  }>) {
    const access = accessFor({
      plan: isPlan(org.plan) ? org.plan : "trial",
      subscriptionStatus: isSubscriptionStatus(org.subscription_status)
        ? org.subscription_status
        : "none",
      trialEndsAt: org.trial_ends_at,
      currentPeriodEnd: org.current_period_end,
    });
    // A workspace that cancelled and let its period run out has left. Emailing
    // it is unsolicited mail about people who are no longer our business.
    if (access.state === "cancelled" && !access.canWrite) continue;

    const buckets = await renewalsFor(admin, org.id, org.due_soon_days);
    if (!digestIsWorthSending(buckets)) continue;

    const recipients = await adminEmailsFor(admin, org.id);
    const digest = buildDigest({
      orgName: org.name,
      slug: org.slug,
      origin,
      buckets,
    });

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    for (const to of recipients) {
      const outcome = await sendEmail({
        to,
        subject: digest.subject,
        text: digest.text,
        html: digest.html,
      });
      if (outcome.status === "sent") sent += 1;
      else if (outcome.status === "skipped") skipped += 1;
      else failed += 1;
    }

    report.push({
      slug: org.slug,
      recipients: recipients.length,
      sent,
      skipped,
      failed,
    });
  }

  return Response.json({ ok: true, workspaces: report.length, report });
}

/**
 * The same buckets getRenewals produces, built with the service role because
 * a cron run has no signed-in user. Kept deliberately close to that function;
 * if one changes the other has to follow.
 */
async function renewalsFor(
  admin: any,
  orgId: string,
  dueSoonDays: number,
): Promise<RenewalBuckets> {
  const [certResult, employeeResult, companyResult] = await Promise.all([
    admin
      .from("certifications")
      .select(
        "id, employee_id, expiry_date, " +
          "employees!inner(surname, names, id_number, site, superior), " +
          "training_types!inner(name)",
      )
      .eq("organisation_id", orgId)
      .not("expiry_date", "is", null),
    admin
      .from("employees")
      .select(
        "id, surname, names, id_number, id_type, id_expiry, site, superior, id_file_path, id_certified_at",
      )
      .eq("organisation_id", orgId)
      .is("terminated_at", null),
    admin
      .from("company_documents")
      .select("id, title, category, expires_at")
      .eq("organisation_id", orgId)
      .not("expires_at", "is", null),
  ]);

  const horizon = Math.max(dueSoonDays, 30);
  const rows: RenewalRow[] = [];

  for (const c of (certResult.data ?? []) as any[]) {
    const { daysLeft } = certStatus(c.expiry_date, dueSoonDays);
    if (daysLeft === null || daysLeft > horizon) continue;
    rows.push({
      key: `cert:${c.id}`,
      kind: "certification",
      employee_id: c.employee_id,
      surname: c.employees?.surname ?? "",
      names: c.employees?.names ?? "",
      id_number: c.employees?.id_number ?? "",
      site: c.employees?.site ?? null,
      superior: c.employees?.superior ?? null,
      label: c.training_types?.name ?? "",
      expiry_date: c.expiry_date,
      days_left: daysLeft,
      certification_id: c.id,
      document_id: null,
    });
  }

  for (const p of (employeeResult.data ?? []) as any[]) {
    if (p.id_expiry) {
      const { daysLeft } = certStatus(p.id_expiry, dueSoonDays);
      if (daysLeft !== null && daysLeft <= horizon) {
        rows.push({
          key: `doc:${p.id}`,
          kind: "document",
          employee_id: p.id,
          surname: p.surname,
          names: p.names,
          id_number: p.id_number,
          site: p.site,
          superior: p.superior,
          label: "Identity document",
          expiry_date: p.id_expiry,
          days_left: daysLeft,
          certification_id: null,
          document_id: null,
        });
      }
    }
    if (p.id_file_path) {
      const copy = certifiedCopyStatus(p.id_certified_at, true);
      if (
        (copy.state === "stale" || copy.state === "expiring") &&
        copy.daysLeft !== null
      ) {
        rows.push({
          key: `copy:${p.id}`,
          kind: "certified_copy",
          employee_id: p.id,
          surname: p.surname,
          names: p.names,
          id_number: p.id_number,
          site: p.site,
          superior: p.superior,
          label: "Certified copy of identity document",
          expiry_date: recertifyBy(p.id_certified_at) ?? "",
          days_left: copy.daysLeft,
          certification_id: null,
          document_id: null,
        });
      }
    }
  }

  for (const row of companyDocumentRenewals(
    (companyResult.data ?? []) as any[],
    dueSoonDays,
    horizon,
  )) {
    rows.push(row);
  }

  rows.sort(
    (a, b) => a.days_left - b.days_left || a.surname.localeCompare(b.surname),
  );

  return {
    expired: rows.filter((r) => r.days_left < 0),
    dueSeven: rows.filter((r) => r.days_left >= 0 && r.days_left <= 7),
    dueThirty: rows.filter((r) => r.days_left > 7 && r.days_left <= horizon),
    horizonDays: horizon,
  };
}

async function adminEmailsFor(admin: any, orgId: string): Promise<string[]> {
  const { data: members } = await admin
    .from("org_members")
    .select("user_id, role")
    .eq("organisation_id", orgId)
    .in("role", ["owner", "admin"]);

  const ids = new Set(
    ((members ?? []) as Array<{ user_id: string }>).map((m) => m.user_id),
  );
  if (ids.size === 0) return [];

  const { data: users } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  return ((users?.users ?? []) as Array<{ id: string; email: string | null }>)
    .filter((u) => ids.has(u.id) && u.email)
    .map((u) => u.email as string);
}
