import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { isAdmin } from "@/lib/auth/roles";
import { parsePeriod, setaYearFor, setaYearRange } from "@/lib/hr/operations";
import {
  getEmployeesForReports,
  getTrainingPlans,
  getTrainingTypesForReports,
  sitesFrom,
} from "@/lib/reports/data";
import SkillsPlanEditor from "./SkillsPlanEditor";

export const metadata = { title: "Workplace Skills Plan" };
export const dynamic = "force-dynamic";

export default async function SkillsPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { org: slug } = await params;
  const sp = await searchParams;
  const ctx = await requireTenant(slug);
  if (!isAdmin(ctx.role)) notFound();

  const currentYear = setaYearFor(parsePeriod(null).end);
  const years = [currentYear, currentYear + 1, currentYear + 2];
  const requested = Number(sp.year ?? "");
  const year = years.includes(requested) ? requested : currentYear + 1;

  const [plans, types, employees] = await Promise.all([
    getTrainingPlans(ctx.org.id),
    getTrainingTypesForReports(ctx.org.id),
    getEmployeesForReports(ctx.org.id),
  ]);

  const siteOptions = sitesFrom(employees).filter((s) => s !== "Unassigned");
  for (const p of plans) {
    const s = p.site.trim();
    if (s && !siteOptions.includes(s)) siteOptions.push(s);
  }
  siteOptions.sort((a, b) => a.localeCompare(b));

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

      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--brand-red)] font-bold">
            {ctx.org.name} · Skills development
          </p>
          <h1 className="mt-2 text-3xl md:text-4xl font-black">Workplace Skills Plan</h1>
          <p className="mt-2 text-[var(--brand-slate)] max-w-2xl">
            How many people each site will put through each course in a SETA year. The unit
            is one row per course per site per year. Saving the same course and site again
            for the same year replaces the number rather than adding to it.
          </p>
        </div>
        <form method="get" action={`/${slug}/hr/reports/skills-development/plan`} className="flex items-end gap-2">
          <label className="text-xs">
            <span className="block uppercase tracking-widest font-bold text-[var(--brand-slate)] mb-1">
              SETA year
            </span>
            <select
              name="year"
              defaultValue={String(year)}
              className="border border-[var(--brand-line)] rounded-md px-3 py-2 bg-white text-sm"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y} ({setaYearRange(y).label})
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="border border-[var(--brand-ink)] hover:bg-[var(--brand-ink)] hover:text-white px-4 py-2 rounded-md text-sm font-bold transition"
          >
            Show
          </button>
        </form>
      </header>

      <SkillsPlanEditor
        orgId={ctx.org.id}
        slug={slug}
        year={year}
        yearLabel={setaYearRange(year).label}
        plans={plans.filter((p) => p.seta_year === year)}
        types={types}
        siteOptions={siteOptions}
      />
    </div>
  );
}
