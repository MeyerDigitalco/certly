import Link from "next/link";
import { MapPin, FileText } from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { getSiteSummaries, type SiteSummary } from "@/lib/hr/queries";
import PageHeader from "@/components/app/PageHeader";

export const metadata = { title: "Sites" };
export const dynamic = "force-dynamic";

export default async function SitesPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org: slug } = await params;
  const ctx = await requireTenant(slug);
  const sites = await getSiteSummaries(ctx.org.id, ctx.org.due_soon_days);

  const totals = sites.reduce(
    (acc, s) => ({
      people: acc.people + s.people,
      expired: acc.expired + s.expired,
      dueSoon: acc.dueSoon + s.dueSoon,
    }),
    { people: 0, expired: 0, dueSoon: 0 },
  );

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="Sites"
        title="Where the risk sits"
        lede="One row per site, worst first. Readiness is the share of dated certifications on that site that are neither expired nor due soon. Records with no expiry date are left out of it, because they cannot lapse."
      />

      {sites.length === 0 ? (
        <div className="bg-white border border-[var(--brand-line)] rounded-2xl p-12 text-center">
          <p className="text-xl font-black">No employees yet.</p>
          <p className="mt-2 text-[var(--brand-slate)]">
            Sites appear here as soon as you load people with a site against
            their name.
          </p>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-4">
            <Kpi label="Sites" value={String(sites.length)} />
            <Kpi label="People" value={String(totals.people)} />
            <Kpi
              label="Expired records"
              value={String(totals.expired)}
              tone={totals.expired > 0 ? "red" : "plain"}
            />
          </div>

          <div className="space-y-4">
            {sites.map((s) => (
              <SiteCard key={s.site} slug={slug} summary={s} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SiteCard({ slug, summary }: { slug: string; summary: SiteSummary }) {
  const bar =
    summary.readiness >= 90
      ? "bg-emerald-600"
      : summary.readiness >= 70
        ? "bg-amber-500"
        : "bg-red-600";

  return (
    <section className="bg-white border border-[var(--brand-line)] rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black inline-flex items-center gap-2">
            <MapPin size={16} className="text-[var(--brand-red)]" />
            {summary.site}
          </h2>
          <p className="mt-1 text-sm text-[var(--brand-slate)]">
            {summary.people} {summary.people === 1 ? "person" : "people"},{" "}
            {summary.records} certification{summary.records === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/${slug}/hr?site=${encodeURIComponent(summary.site)}`}
            className="border border-[var(--brand-line)] hover:border-[var(--brand-ink)] px-3 py-2 rounded-md text-xs font-bold transition"
          >
            Open in register
          </Link>
          <Link
            href={`/${slug}/hr/safety-file?site=${encodeURIComponent(summary.site)}`}
            className="inline-flex items-center gap-1.5 bg-[var(--brand-ink)] hover:bg-[var(--brand-charcoal)] text-white px-3 py-2 rounded-md text-xs font-bold transition"
          >
            <FileText size={12} />
            Safety file
          </Link>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-xs mb-1.5">
          <span className="uppercase tracking-widest font-bold text-[var(--brand-slate)]">
            Readiness
          </span>
          <span className="font-mono font-bold">{summary.readiness}%</span>
        </div>
        <div className="h-2 bg-[var(--brand-line)] rounded-full overflow-hidden">
          <div
            className={`h-full ${bar}`}
            style={{ width: `${summary.readiness}%` }}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <Stat label="Expired" value={summary.expired} tone="red" />
        <Stat label="Due soon" value={summary.dueSoon} tone="amber" />
        <Stat label="Valid" value={summary.valid} tone="green" />
        <Stat label="No expiry" value={summary.noExpiry} tone="plain" />
      </div>
    </section>
  );
}

function Kpi({
  label,
  value,
  tone = "plain",
}: {
  label: string;
  value: string;
  tone?: "plain" | "red";
}) {
  return (
    <div className="bg-white border border-[var(--brand-line)] rounded-xl p-5">
      <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--brand-slate)]">
        {label}
      </p>
      <p
        className={`mt-1 text-3xl font-black ${
          tone === "red" ? "text-red-700" : "text-[var(--brand-ink)]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "red" | "amber" | "green" | "plain";
}) {
  const colour =
    tone === "red"
      ? "text-red-700"
      : tone === "amber"
        ? "text-amber-700"
        : tone === "green"
          ? "text-emerald-700"
          : "text-[var(--brand-slate)]";
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--brand-slate)]">
        {label}
      </p>
      <p className={`mt-0.5 font-mono font-bold ${colour}`}>{value}</p>
    </div>
  );
}
