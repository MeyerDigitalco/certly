import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import PrintButton from "./PrintButton";
import type { Period } from "@/lib/hr/operations";
import { periodKey, periodFor } from "@/lib/hr/operations";

/**
 * The frame every monthly report sits in: title, period picker, site filter,
 * export and print. Reports are server components that take the same three
 * search params (period, site) so a user can switch month on any of them
 * and get the same control in the same place.
 */

export interface ReportShellProps {
  slug: string;
  orgName: string;
  reportKey: string;
  title: string;
  description: string;
  period: Period;
  site?: string;
  sites: string[];
  exportHref: string;
  children: React.ReactNode;
}

export default function ReportShell({
  slug,
  orgName,
  reportKey,
  title,
  description,
  period,
  site,
  sites,
  exportHref,
  children,
}: ReportShellProps) {
  const base = `/${slug}/hr/reports/${reportKey}`;
  const months = recentPeriods(period, 18);

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="print:hidden">
        <Link
          href={`/${slug}/hr/reports`}
          className="text-[var(--brand-red)] text-xs font-bold inline-flex items-center gap-1"
        >
          <ArrowLeft size={12} /> All reports
        </Link>
      </div>

      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--brand-red)] font-bold">
            {orgName} · Monthly report
          </p>
          <h1 className="mt-2 text-3xl md:text-4xl font-black">{title}</h1>
          <p className="mt-2 text-[var(--brand-slate)] max-w-2xl">{description}</p>
        </div>

        <form
          method="get"
          action={base}
          className="print:hidden flex flex-wrap items-end gap-2"
        >
          <label className="text-xs">
            <span className="block uppercase tracking-widest font-bold text-[var(--brand-slate)] mb-1">
              Month
            </span>
            <select
              name="period"
              defaultValue={periodKey(period)}
              className="border border-[var(--brand-line)] rounded-md px-3 py-2 bg-white text-sm"
            >
              {months.map((p) => (
                <option key={periodKey(p)} value={periodKey(p)}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          {sites.length > 0 ? (
            <label className="text-xs">
              <span className="block uppercase tracking-widest font-bold text-[var(--brand-slate)] mb-1">
                Site
              </span>
              <select
                name="site"
                defaultValue={site ?? ""}
                className="border border-[var(--brand-line)] rounded-md px-3 py-2 bg-white text-sm"
              >
                <option value="">All sites</option>
                {sites.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            type="submit"
            className="border border-[var(--brand-ink)] hover:bg-[var(--brand-ink)] hover:text-white px-4 py-2 rounded-md text-sm font-bold transition"
          >
            Show
          </button>
          <a
            href={exportHref}
            className="inline-flex items-center gap-2 bg-[var(--brand-red)] hover:bg-[var(--brand-red-deep)] text-white px-4 py-2 rounded-md text-sm font-bold transition"
          >
            <Download size={14} />
            Excel
          </a>
          <PrintButton />
        </form>
      </header>

      <div className="hidden print:block text-xs text-[var(--brand-slate)]">
        {orgName} · {period.label}
        {site ? ` · ${site}` : ""}
      </div>

      {children}

      <p className="text-xs text-[var(--brand-slate)] print:mt-6">
        Figures are taken from the Certly register on the day this page is viewed.
        Record terminations, start dates and the labour plan in Certly and the
        report updates itself. Period: {period.start} to {period.end}.
      </p>
    </div>
  );
}

function recentPeriods(current: Period, count: number): Period[] {
  const out: Period[] = [];
  let y = current.year;
  let m = current.month;
  for (let i = 0; i < count; i += 1) {
    out.push(periodFor(y, m));
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  const nextY = current.month === 12 ? current.year + 1 : current.year;
  const nextM = current.month === 12 ? 1 : current.month + 1;
  out.unshift(periodFor(nextY, nextM));
  return out;
}

export function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-[var(--brand-line)] rounded-2xl p-6 print:border-0 print:p-0 print:rounded-none print:break-inside-avoid">
      <header className="mb-4">
        <h2 className="text-lg font-black">{title}</h2>
        {subtitle ? <p className="text-sm text-[var(--brand-slate)] mt-1">{subtitle}</p> : null}
      </header>
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string | number;
  tone?: "red" | "amber" | "green";
  hint?: string;
}) {
  const colour =
    tone === "red"
      ? "text-red-700"
      : tone === "amber"
        ? "text-amber-700"
        : tone === "green"
          ? "text-emerald-700"
          : "";
  return (
    <div className="border border-[var(--brand-line)] rounded-xl p-4 bg-white">
      <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--brand-slate)]">{label}</p>
      <p className={`text-3xl font-black mt-1 ${colour}`}>{value}</p>
      {hint ? <p className="text-xs text-[var(--brand-slate)] mt-1">{hint}</p> : null}
    </div>
  );
}

export function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`px-3 py-2 font-bold uppercase tracking-widest text-[10px] text-[var(--brand-slate)] ${right ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  right,
  bold,
  mono,
  className = "",
}: {
  children: React.ReactNode;
  right?: boolean;
  bold?: boolean;
  mono?: boolean;
  className?: string;
}) {
  return (
    <td
      className={`px-3 py-2 whitespace-nowrap ${right ? "text-right" : ""} ${bold ? "font-bold" : ""} ${mono ? "font-mono text-xs" : ""} ${className}`}
    >
      {children}
    </td>
  );
}
