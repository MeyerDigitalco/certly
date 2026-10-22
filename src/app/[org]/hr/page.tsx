import { requireTenant } from "@/lib/tenant";
import { isAdmin } from "@/lib/auth/roles";
import {
  getCompanyDocuments,
  getExpiredBySite,
  getRegisterKpis,
  getSiteSummaries,
} from "@/lib/hr/queries";
import {
  getEmployeesForReports,
  getTrainingPlans,
  getTrainingTypesForReports,
} from "@/lib/reports/data";
import { todayIso } from "@/lib/certifications/status";
import { buildOverview } from "@/lib/hr/overview";
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

  const [employees, kpis, sites, expiredBySite, companyDocs, trainingTypes, trainingPlans] =
    await Promise.all([
      getEmployeesForReports(ctx.org.id),
      getRegisterKpis(ctx.org.id),
      getSiteSummaries(ctx.org.id, ctx.org.due_soon_days),
      getExpiredBySite(ctx.org.id),
      getCompanyDocuments(ctx.org.id),
      getTrainingTypesForReports(ctx.org.id),
      getTrainingPlans(ctx.org.id),
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

  return (
    <OverviewView
      o={o}
      slug={slug}
      profile={sectorProfile(ctx.org.sector)}
      canWrite={canWrite}
      today={today}
    />
  );
}
