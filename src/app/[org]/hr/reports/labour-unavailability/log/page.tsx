import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { isAdmin } from "@/lib/auth/roles";
import { siteOf } from "@/lib/hr/operations";
import { getAbsences, getEmployeesForReports } from "@/lib/reports/data";
import AbsenceLog, { type LogPerson, type LogSpell } from "./AbsenceLog";

export const metadata = { title: "Absence log" };
export const dynamic = "force-dynamic";

export default async function AbsenceLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ focus?: string }>;
}) {
  const { org: slug } = await params;
  const sp = await searchParams;
  const ctx = await requireTenant(slug);
  if (!isAdmin(ctx.role)) notFound();

  const [absences, employees] = await Promise.all([
    getAbsences(ctx.org.id),
    getEmployeesForReports(ctx.org.id),
  ]);

  const people: LogPerson[] = employees
    .filter((e) => e.terminated_at === null)
    .map((e) => ({
      id: e.id,
      name: `${e.surname}, ${e.names}`,
      site: siteOf(e.site),
      designation: e.designation ?? "",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const byId = new Map(employees.map((e) => [e.id, e]));
  const spells: LogSpell[] = absences.map((a) => {
    const e = byId.get(a.employee_id);
    return {
      id: a.id,
      employeeId: a.employee_id,
      name: e ? `${e.surname}, ${e.names}` : "Unknown person",
      site: e ? siteOf(e.site) : siteOf(null),
      designation: e?.designation ?? "",
      left: e ? e.terminated_at !== null : false,
      startsOn: a.starts_on,
      endsOn: a.ends_on,
      halfDay: a.half_day,
      reason: a.reason,
      notes: a.notes ?? "",
      createdAt: a.created_at,
    };
  });

  const focus = (sp.focus ?? "").trim() || null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${slug}/hr/reports/labour-unavailability`}
          className="text-[var(--brand-red)] text-xs font-bold inline-flex items-center gap-1"
        >
          <ArrowLeft size={12} /> Back to report
        </Link>
      </div>

      <header>
        <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--brand-red)] font-bold">
          {ctx.org.name} · Labour unavailability
        </p>
        <h1 className="mt-2 text-3xl md:text-4xl font-black">Absence log</h1>
        <p className="mt-2 text-[var(--brand-slate)] max-w-2xl">
          Every spell of absence on the register: leave, sick days, injury and no shows.
          Record a spell for one person or a whole crew in one go. The monthly Labour
          unavailability report counts the days inside each month from this log.
        </p>
      </header>

      <AbsenceLog orgId={ctx.org.id} slug={slug} people={people} spells={spells} focus={focus} />
    </div>
  );
}
