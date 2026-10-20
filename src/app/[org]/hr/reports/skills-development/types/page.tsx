import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { isAdmin } from "@/lib/auth/roles";
import { getTrainingTypesForReports } from "@/lib/reports/data";
import TrainingTypeDetails from "./TrainingTypeDetails";

export const metadata = { title: "Course details" };
export const dynamic = "force-dynamic";

export default async function TrainingTypesPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org: slug } = await params;
  const ctx = await requireTenant(slug);
  if (!isAdmin(ctx.role)) notFound();

  const types = await getTrainingTypesForReports(ctx.org.id);
  const ordered = [...types].sort(
    (a, b) =>
      Number(b.active) - Number(a.active) ||
      a.sort_order - b.sort_order ||
      a.name.localeCompare(b.name),
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${slug}/hr/reports/skills-development`}
          className="text-[var(--brand-red)] text-xs font-bold inline-flex items-center gap-1"
        >
          <ArrowLeft size={12} /> Back to report
        </Link>
      </div>

      <header>
        <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--brand-red)] font-bold">
          {ctx.org.name} · Skills development
        </p>
        <h1 className="mt-2 text-3xl md:text-4xl font-black">Course details</h1>
        <p className="mt-2 text-[var(--brand-slate)] max-w-2xl">
          What the SETA asks about each course: category, hours, cost per person, provider,
          NQF level and accreditation. Each change saves on its own as you make it. Untick
          counts for ATR on site inductions and anything else that is not training in the
          SETA sense, so it stays out of the Annual Training Report.
        </p>
      </header>

      <TrainingTypeDetails orgId={ctx.org.id} slug={slug} types={ordered} />
    </div>
  );
}
