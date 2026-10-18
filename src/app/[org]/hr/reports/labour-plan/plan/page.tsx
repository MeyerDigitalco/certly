import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { isAdmin } from "@/lib/auth/roles";
import { getEmployeesForReports, getLabourPlans } from "@/lib/reports/data";
import PlanEditor from "./PlanEditor";

export const metadata = { title: "Labour plan" };
export const dynamic = "force-dynamic";

function distinct(values: Array<string | null | undefined>): string[] {
  const set = new Set<string>();
  for (const v of values) {
    const t = (v ?? "").trim();
    if (t.length > 0) set.add(t);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export default async function LabourPlanEditorPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org: slug } = await params;
  const ctx = await requireTenant(slug);
  if (!isAdmin(ctx.role)) notFound();

  const [plans, employees] = await Promise.all([
    getLabourPlans(ctx.org.id),
    getEmployeesForReports(ctx.org.id),
  ]);

  const siteOptions = distinct([...employees.map((e) => e.site), ...plans.map((p) => p.site)]);
  const designationOptions = distinct([
    ...employees.map((e) => e.designation),
    ...plans.map((p) => p.designation),
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
          {ctx.org.name} · Labour plan
        </p>
        <h1 className="mt-2 text-3xl md:text-4xl font-black">Approved positions</h1>
        <p className="mt-2 text-[var(--brand-slate)] max-w-2xl">
          The number of people each site should carry per designation. The monthly
          Labour plan and Staff movement reports measure the register against these
          numbers. A new row with a later effective date supersedes the old one from
          that date, so history is kept and an earlier month still reports against the
          plan that applied then.
        </p>
      </header>

      <PlanEditor
        orgId={ctx.org.id}
        slug={slug}
        plans={plans}
        siteOptions={siteOptions}
        designationOptions={designationOptions}
      />
    </div>
  );
}
