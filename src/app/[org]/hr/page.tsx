import { requireTenant } from "@/lib/tenant";
import { isAdmin } from "@/lib/auth/roles";
import {
  getCompanyDocuments,
  getComplianceSnapshots,
  getExpiredBySite,
  getRegisterKpis,
  getSiteSummaries,
  recordComplianceSnapshot,
} from "@/lib/hr/queries";
import {
  getEmployeesForReports,
  getTrainingPlans,
  getTrainingTypesForReports,
} from "@/lib/reports/data";
import { todayIso } from "@/lib/certifications/status";
import { buildOverview, buildTrend } from "@/lib/hr/overview";
import { sectorProfile } from "@/lib/sector";
import OverviewView from "./OverviewView";

export const metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org: slug } = await params;
  const ctx = await requireTenant(slug);
  const canWrite = isAdmin(ctx.role);
  const today = todayIso();

  const since = new Date(Date.parse(today) - 120 * 86_400_000).toISOString().slice(0, 10);
  const [employees, kpis, sites, expiredBySite, companyDocs, trainingTypes, trainingPlans, history] =
    await Promise.all([
      getEmployeesForReports(ctx.org.id),
      getRegisterKpis(ctx.org.id),
      getSiteSummaries(ctx.org.id, ctx.org.due_soon_days),
      getExpiredBySite(ctx.org.id),
      getCompanyDocuments(ctx.org.id),
      getTrainingTypesForReports(ctx.org.id),
      getTrainingPlans(ctx.org.id),
      getComplianceSnapshots(ctx.org.id, since),
    ]);

  const o = buildOverview(
    {
      today,
      sector: ctx.org.sector,
      seta: ctx.org.seta,
      dueSoonDays: ctx.org.due_soon_days,
      employees,
      kpis,
      sites,
      expiredBySite,
      companyDocs,
      trainingTypes,
      trainingPlans,
    },
    slug,
  );

  const trend = buildTrend(history, today, o.score.pct);
  const todaySaved = history.some((h) => h.taken_on === today && h.score === o.score.pct);
  if (canWrite && !todaySaved) {
    const part = (key: string) => o.score.components.find((c) => c.key === key)?.pct ?? null;
    await recordComplianceSnapshot(ctx.org.id, {
      taken_on: today,
      score: o.score.pct,
      certificates_pct: part("certificates"),
      declarations_pct: part("declarations"),
      company_docs_pct: part("company_documents"),
      training_pct: part("training_details"),
      headcount: o.headcount,
      cannot_pass: o.gate.cannotPass,
    });
  }

  return (
    <OverviewView
      o={o}
      trend={trend}
      slug={slug}
      profile={sectorProfile(ctx.org.sector)}
      canWrite={canWrite}
      today={today}
    />
  );
}
