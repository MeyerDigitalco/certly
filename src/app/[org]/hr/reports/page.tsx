import Link from "next/link";
import {
  ArrowRightLeft,
  BarChart3,
  CalendarClock,
  ClipboardList,
  Users,
} from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { isAdmin } from "@/lib/auth/roles";
import { parsePeriod, periodKey } from "@/lib/hr/operations";

export const metadata = { title: "Monthly reports" };
export const dynamic = "force-dynamic";

const REPORTS = [
  {
    key: "staff-movement",
    icon: ArrowRightLeft,
    title: "Staff movement",
    blurb:
      "Who left and why, split by site and by fault or no fault. Joiners, turnover, approved plan against actual headcount, variance.",
    needs: "Terminations and start dates on the register, plus a labour plan.",
  },
  {
    key: "fault-terminations",
    icon: BarChart3,
    title: "Fault terminations, year on year",
    blurb:
      "Resignations and dismissals by month, this year against last. The chart a client uses to ask why March was bad.",
    needs: "Terminations on the register.",
  },
  {
    key: "retirement",
    icon: CalendarClock,
    title: "Overdue retirement",
    blurb:
      "Everyone past their contractual retirement age, with the official date and any approved extension.",
    needs: "Date of birth and retirement age on each person.",
  },
  {
    key: "labour-plan",
    icon: ClipboardList,
    title: "Labour plan and onboarding",
    blurb:
      "Approved positions against people in service by designation, and the screening, medical, TEBA and training pipeline behind the gap.",
    needs: "A labour plan and the onboarding tracker.",
  },
] as const;

export default async function ReportsIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { org: slug } = await params;
  const sp = await searchParams;
  const ctx = await requireTenant(slug);
  const period = parsePeriod(sp.period);
  const canWrite = isAdmin(ctx.role);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--brand-red)] font-bold">
          {ctx.org.name} · Reports
        </p>
        <h1 className="mt-2 text-4xl md:text-5xl font-black">Monthly reporting</h1>
        <p className="mt-2 text-[var(--brand-slate)] max-w-2xl">
          The pack a mine or a head office asks a contractor for every month,
          built from the register rather than retyped into a slide. Pick a
          report, pick a month, download the workbook.
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-4">
        {REPORTS.map((r) => (
          <Link
            key={r.key}
            href={`/${slug}/hr/reports/${r.key}?period=${periodKey(period)}`}
            className="group bg-white border border-[var(--brand-line)] hover:border-[var(--brand-ink)] rounded-2xl p-6 transition"
          >
            <r.icon size={22} className="text-[var(--brand-red)]" />
            <h2 className="mt-3 text-xl font-black group-hover:text-[var(--brand-red)] transition">
              {r.title}
            </h2>
            <p className="mt-2 text-sm text-[var(--brand-slate)]">{r.blurb}</p>
            <p className="mt-3 text-xs text-[var(--brand-slate)]">
              <span className="font-bold text-[var(--brand-ink)]">Needs:</span> {r.needs}
            </p>
          </Link>
        ))}
      </div>

      {canWrite ? (
        <section className="bg-[var(--brand-cream)] border border-[var(--brand-line)] rounded-2xl p-6">
          <h2 className="font-black flex items-center gap-2">
            <Users size={16} className="text-[var(--brand-red)]" />
            What the reports are built from
          </h2>
          <ul className="mt-3 text-sm text-[var(--brand-slate)] space-y-2">
            <li>
              <span className="font-bold text-[var(--brand-ink)]">Terminations.</span> On an
              employee&rsquo;s page, under Leaving, record the last day and the reason
              instead of deleting them.
            </li>
            <li>
              <span className="font-bold text-[var(--brand-ink)]">Start dates, dates of birth, retirement ages.</span>{" "}
              On the employee form, under Service and retirement.
            </li>
            <li>
              <span className="font-bold text-[var(--brand-ink)]">Labour plan.</span>{" "}
              <Link href={`/${slug}/hr/reports/labour-plan/plan`} className="text-[var(--brand-red)] font-bold hover:underline">
                Set the approved positions per site and designation
              </Link>
              .
            </li>
            <li>
              <span className="font-bold text-[var(--brand-ink)]">Onboarding.</span>{" "}
              <Link href={`/${slug}/hr/reports/labour-plan/tracker`} className="text-[var(--brand-red)] font-bold hover:underline">
                Track candidates from screening to first shift
              </Link>
              .
            </li>
          </ul>
        </section>
      ) : null}
    </div>
  );
}
