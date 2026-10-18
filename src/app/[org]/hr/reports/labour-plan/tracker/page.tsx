import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { isAdmin } from "@/lib/auth/roles";
import { getEmployeesForReports, getOnboardingCandidates } from "@/lib/reports/data";
import TrackerBoard from "./TrackerBoard";

export const metadata = { title: "Onboarding tracker" };
export const dynamic = "force-dynamic";

function distinct(values: Array<string | null | undefined>): string[] {
  const set = new Set<string>();
  for (const v of values) {
    const t = (v ?? "").trim();
    if (t.length > 0) set.add(t);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export default async function OnboardingTrackerPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org: slug } = await params;
  const ctx = await requireTenant(slug);
  if (!isAdmin(ctx.role)) notFound();

  const [candidates, employees] = await Promise.all([
    getOnboardingCandidates(ctx.org.id),
    getEmployeesForReports(ctx.org.id),
  ]);

  const siteOptions = distinct([...employees.map((e) => e.site), ...candidates.map((c) => c.site)]);
  const designationOptions = distinct([
    ...employees.map((e) => e.designation),
    ...candidates.map((c) => c.designation),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${slug}/hr/reports/labour-plan`}
          className="text-[var(--brand-red)] text-xs font-bold inline-flex items-center gap-1"
        >
          <ArrowLeft size={12} /> Back to report
        </Link>
      </div>

      <header>
        <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--brand-red)] font-bold">
          {ctx.org.name} · Onboarding
        </p>
        <h1 className="mt-2 text-3xl md:text-4xl font-black">Onboarding tracker</h1>
        <p className="mt-2 text-[var(--brand-slate)] max-w-2xl">
          Every candidate from first screening to first shift. Keep the stage and dates
          current and the monthly Labour plan report shows the pipeline behind each
          gap. When someone passes out, engage them here and Certly adds them to the
          register.
        </p>
      </header>

      <TrackerBoard
        orgId={ctx.org.id}
        slug={slug}
        candidates={candidates}
        siteOptions={siteOptions}
        designationOptions={designationOptions}
      />
    </div>
  );
}
