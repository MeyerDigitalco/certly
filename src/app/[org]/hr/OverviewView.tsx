import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Download,
  FileBadge,
  MessageSquarePlus,
  MinusCircle,
  Scale,
  ShieldCheck,
} from "lucide-react";
import type { Overview, Deadline, Trend } from "@/lib/hr/overview";
import type { SectorProfile } from "@/lib/sector";
import { GUIDES } from "@/lib/guides";
import PageHeader from "@/components/app/PageHeader";

/**
 * The overview, rendered from an already computed Overview. Kept apart from
 * the page that fetches so it can be rendered with fixture data in a browser
 * without a database, which is how its layout gets checked.
 */

const REPORT_TITLES: Record<string, string> = {
  "staff-movement": "Staff movement",
  "fault-terminations": "Fault terminations",
  retirement: "Overdue retirement",
  "labour-plan": "Labour plan and onboarding",
  "labour-unavailability": "Labour unavailability",
  "employment-equity": "Employment equity",
  "skills-development": "Skills development",
};

export default function OverviewView({
  o,
  trend,
  slug,
  profile,
  canWrite,
  today,
}: {
  o: Overview;
  trend: Trend;
  slug: string;
  profile: SectorProfile;
  canWrite: boolean;
  today: string;
}) {
  const scoreTone = o.score.pct >= 90 ? "green" : o.score.pct >= 70 ? "amber" : "red";
  const weakest = [...o.score.components]
    .filter((c) => c.pct !== null)
    .sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0))[0];

  return (
    <div className="space-y-8">
      <PageHeader
        kicker={`${profile.label} · ${today}`}
        title="What would be missing if someone asked today"
        lede={
          o.headcount === 0
            ? "Load your people and their certificates and this page starts answering for you."
            : `${o.headcount} ${o.headcount === 1 ? "person" : "people"} in service across ${o.gate.sites.length} ${o.gate.sites.length === 1 ? "site" : "sites"}. ${
                o.gate.cannotPass === 0
                  ? o.headcount === 1
                    ? `They can pass a ${profile.gateNoun} check.`
                    : `Everyone can pass a ${profile.gateNoun} check.`
                  : `${o.gate.cannotPass} cannot pass a ${profile.gateNoun} check right now.`
              }`
        }
        actions={
          canWrite ? (
            <a
              href={`/${slug}/hr/evidence`}
              className="inline-flex items-center gap-2 bg-[var(--brand-ink)] hover:bg-[var(--brand-charcoal)] text-white px-4 py-2 rounded-md text-sm font-bold transition"
            >
              <Download size={14} />
              Inspection evidence pack
            </a>
          ) : null
        }
      />

      <section className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-6">
        <div className="space-y-4">
          <SectionLabel icon={CalendarClock}>What is due, and what is still missing</SectionLabel>
          {o.deadlines.map((d) => (
            <DeadlineCard key={d.key} d={d} />
          ))}
        </div>

        <div className="space-y-4">
          <SectionLabel icon={ShieldCheck}>Compliance score</SectionLabel>
          <div className="bg-white border border-[var(--brand-line)] rounded-2xl p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--brand-slate)]">
                  Weighted across what matters
                </p>
                <p
                  className={`mt-1 text-6xl font-black leading-none ${
                    scoreTone === "green"
                      ? "text-emerald-700"
                      : scoreTone === "amber"
                        ? "text-amber-700"
                        : "text-red-700"
                  }`}
                >
                  {o.score.pct}
                  <span className="text-2xl">%</span>
                </p>
              </div>
              <div className="text-right">
                <TrendBadge trend={trend} />
                <p className="mt-2 text-xs text-[var(--brand-slate)] max-w-[14rem]">
                  {!weakest
                    ? "Nothing to score yet. Load people and certificates."
                    : (weakest.pct ?? 0) >= 90
                      ? "Nothing is dragging it. Keep the renewals list empty and this stays green."
                      : `Pulling it down: ${weakest.label.toLowerCase()} at ${weakest.pct}%.`}
                </p>
              </div>
            </div>
            {trend.points.length > 1 ? <Sparkline points={trend.points} /> : null}
            <ul className="mt-5 divide-y divide-[var(--brand-line)]">
              {o.score.components.map((c) => (
                <li key={c.key} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={c.href}
                      className="text-sm font-bold hover:text-[var(--brand-red)]"
                    >
                      {c.label}
                    </Link>
                    <span className="font-mono text-sm font-bold">
                      {c.pct === null ? "n/a" : `${c.pct}%`}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 bg-[var(--brand-cream)] rounded-sm overflow-hidden">
                    <div
                      className={`h-full ${
                        c.pct === null
                          ? "bg-[var(--brand-line)]"
                          : c.pct >= 90
                            ? "bg-emerald-600"
                            : c.pct >= 70
                              ? "bg-amber-600"
                              : "bg-red-600"
                      }`}
                      style={{ width: `${c.pct ?? 0}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-[var(--brand-slate)]">
                    {c.detail}
                    <span className="ml-2 text-[var(--brand-line)]">·</span>
                    <span className="ml-2">weight {c.weight}</span>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section>
        <SectionLabel icon={ShieldCheck}>
          {profile.gateNoun === "gate" ? "Gate readiness by site" : "Site access readiness"}
        </SectionLabel>
        {o.gate.sites.length === 0 ? (
          <Empty>
            No sites yet. Put a site on each person and this shows who can pass a check
            where.
          </Empty>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {o.gate.sites.map((s) => (
              <Link
                key={s.site}
                href={`/${slug}/hr/register?site=${encodeURIComponent(s.site)}&status=expired`}
                className="bg-white border border-[var(--brand-line)] hover:border-[var(--brand-ink)] rounded-2xl p-5 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-black">{s.site}</p>
                  <p
                    className={`font-mono text-sm font-bold ${
                      s.cannotPass === 0 ? "text-emerald-700" : "text-red-700"
                    }`}
                  >
                    {s.canPass}/{s.people}
                  </p>
                </div>
                <div className="mt-3 h-2 bg-[var(--brand-cream)] rounded-sm overflow-hidden flex">
                  <div
                    className="h-full bg-emerald-600"
                    style={{ width: `${s.people === 0 ? 0 : (s.canPass / s.people) * 100}%` }}
                  />
                  <div
                    className="h-full bg-red-600"
                    style={{ width: `${s.people === 0 ? 0 : (s.cannotPass / s.people) * 100}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-[var(--brand-slate)]">
                  {s.cannotPass === 0
                    ? `All ${s.people} can pass`
                    : `${s.cannotPass} ${s.cannotPass === 1 ? "person" : "people"} with an expired ticket`}
                  {s.dueSoonRecords > 0 ? ` · ${s.dueSoonRecords} due soon` : ""}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        {/* The statutory reports are admin only, so a viewer is not shown
            links that would answer with a 404. */}
        {canWrite ? (
        <div>
          <SectionLabel icon={ClipboardList}>Reports for a {profile.short.toLowerCase()} contractor</SectionLabel>
          <ul className="bg-white border border-[var(--brand-line)] rounded-2xl divide-y divide-[var(--brand-line)]">
            {o.pinnedReports.map((key) => (
              <li key={key}>
                <Link
                  href={`/${slug}/hr/reports/${key}`}
                  className="flex items-center justify-between px-5 py-3 text-sm font-bold hover:text-[var(--brand-red)]"
                >
                  {REPORT_TITLES[key] ?? key}
                  <ArrowRight size={14} />
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={`/${slug}/hr/reports`}
                className="flex items-center justify-between px-5 py-3 text-xs font-bold text-[var(--brand-slate)] hover:text-[var(--brand-red)]"
              >
                All seven reports
                <ArrowRight size={12} />
              </Link>
            </li>
          </ul>
        </div>
        ) : null}
        <div>
          <SectionLabel icon={FileBadge}>Guides</SectionLabel>
          <ul className="bg-white border border-[var(--brand-line)] rounded-2xl divide-y divide-[var(--brand-line)]">
            {o.guides.map((slugKey) => {
              const g = GUIDES.find((x) => x.slug === slugKey);
              if (!g) return null;
              return (
                <li key={g.slug}>
                  <a
                    href={`/guides/${g.slug}`}
                    target="_blank"
                    rel="noopener"
                    className="block px-5 py-3 hover:text-[var(--brand-red)]"
                  >
                    <span className="text-sm font-bold">{g.heading}</span>
                    {g.deadline ? (
                      <span className="block text-[10px] uppercase tracking-widest text-[var(--brand-slate)] mt-0.5">
                        {g.deadline}
                      </span>
                    ) : null}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <aside className="bg-white border border-[var(--brand-line)] rounded-2xl px-6 py-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-bold">Something here slower than it should be?</p>
          <p className="text-sm text-[var(--brand-slate)] mt-0.5">
            Tell the person who builds it. Every role can, viewers included.
          </p>
        </div>
        <Link
          href={`/${slug}/hr/suggest`}
          className="inline-flex items-center gap-2 border border-[var(--brand-ink)] hover:bg-[var(--brand-ink)] hover:text-white px-4 py-2 rounded-md font-bold text-sm transition shrink-0"
        >
          <MessageSquarePlus size={14} />
          Suggest an improvement
        </Link>
      </aside>
    </div>
  );
}

function DeadlineCard({ d }: { d: Deadline }) {
  const tone =
    d.status === "late" || d.status === "missing"
      ? "red"
      : d.status === "urgent"
        ? "red"
        : d.status === "behind"
          ? "amber"
          : d.status === "voluntary"
            ? "slate"
            : "green";
  const Icon =
    tone === "red" ? AlertTriangle : tone === "amber" ? CalendarClock : tone === "slate" ? MinusCircle : CheckCircle2;
  const border =
    tone === "red"
      ? "border-red-300"
      : tone === "amber"
        ? "border-amber-300"
        : "border-[var(--brand-line)]";
  const colour =
    tone === "red"
      ? "text-red-700"
      : tone === "amber"
        ? "text-amber-700"
        : tone === "green"
          ? "text-emerald-700"
          : "text-[var(--brand-slate)]";

  return (
    <Link
      href={d.href}
      className={`block bg-white border ${border} rounded-2xl p-5 hover:border-[var(--brand-ink)] transition`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--brand-slate)]">
            {d.title}
          </p>
          <p className={`mt-1 text-lg font-black leading-snug ${colour}`}>
            <Icon size={16} className="inline -mt-0.5 mr-1.5" />
            {d.headline}
          </p>
          <p className="mt-1.5 text-xs text-[var(--brand-slate)]">{d.detail}</p>
        </div>
        <div className="text-right shrink-0">
          {d.due ? (
            <>
              <p className={`font-mono text-2xl font-black leading-none ${colour}`}>
                {d.daysLeft < 0 ? Math.abs(d.daysLeft) : d.daysLeft}
              </p>
              <p className="text-[10px] uppercase tracking-widest text-[var(--brand-slate)] mt-1">
                {d.daysLeft < 0 ? "days over" : "days left"}
              </p>
              <p className="font-mono text-[10px] text-[var(--brand-slate)] mt-1">{d.due}</p>
            </>
          ) : (
            <Scale size={20} className="text-[var(--brand-slate)]" />
          )}
        </div>
      </div>
      {d.readinessPct !== null ? (
        <div className="mt-4 h-1.5 bg-[var(--brand-cream)] rounded-sm overflow-hidden">
          <div
            className={`h-full ${
              tone === "green" ? "bg-emerald-600" : tone === "amber" ? "bg-amber-600" : tone === "red" ? "bg-red-600" : "bg-[var(--brand-slate)]"
            }`}
            style={{ width: `${d.readinessPct}%` }}
          />
        </div>
      ) : null}
    </Link>
  );
}

function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: typeof CalendarClock;
  children: React.ReactNode;
}) {
  return (
    <p className="text-[11px] uppercase tracking-[0.22em] font-bold text-[var(--brand-red)] flex items-center gap-2 mb-3">
      <Icon size={13} />
      {children}
    </p>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[var(--brand-cream)] border border-[var(--brand-line)] rounded-2xl p-5 text-sm text-[var(--brand-slate)]">
      {children}
    </div>
  );
}

function TrendBadge({ trend }: { trend: Trend }) {
  if (trend.delta === null) {
    return (
      <p className="inline-block font-mono text-[10px] uppercase tracking-widest text-[var(--brand-slate)] border border-[var(--brand-line)] rounded-sm px-2 py-1">
        {trend.daysOfHistory === 0
          ? "First reading today"
          : `${trend.daysOfHistory} days of history, trend from day 30`}
      </p>
    );
  }
  const up = trend.delta > 0;
  const flat = trend.delta === 0;
  return (
    <p
      className={`inline-block font-mono text-xs font-bold rounded-sm px-2 py-1 ${
        flat
          ? "bg-[var(--brand-cream)] text-[var(--brand-slate)]"
          : up
            ? "bg-emerald-50 text-emerald-700"
            : "bg-red-50 text-red-700"
      }`}
    >
      {flat ? "No change" : `${up ? "Up" : "Down"} ${Math.abs(trend.delta)}`} since last month
      <span className="font-normal text-[var(--brand-slate)]"> ({trend.monthAgo}%)</span>
    </p>
  );
}

function Sparkline({ points }: { points: Array<{ date: string; score: number }> }) {
  const w = 320;
  const h = 48;
  const pad = 4;
  const xs = points.map((_, i) => pad + (i / Math.max(1, points.length - 1)) * (w - pad * 2));
  const ys = points.map((p) => pad + (1 - p.score / 100) * (h - pad * 2));
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  return (
    <figure className="mt-4 m-0">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label="Compliance score over time">
        <line x1={pad} x2={w - pad} y1={pad + (1 - 0.9) * (h - pad * 2)} y2={pad + (1 - 0.9) * (h - pad * 2)} stroke="#E5E0D8" strokeDasharray="3 3" />
        <path d={d} fill="none" stroke="#161616" strokeWidth={1.5} />
        {xs.map((x, i) => (
          <circle key={points[i].date} cx={x} cy={ys[i]} r={i === xs.length - 1 ? 3 : 1.5} fill={i === xs.length - 1 ? "#B91C1C" : "#161616"} />
        ))}
      </svg>
      <figcaption className="flex justify-between font-mono text-[10px] text-[var(--brand-slate)] mt-1">
        <span>{points[0].date}</span>
        <span>dotted line is 90</span>
        <span>{last.date}</span>
      </figcaption>
    </figure>
  );
}
