import Link from "next/link";
import { AlertTriangle, Clock, CalendarDays, BookUser, FileBadge, Stamp } from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { getRenewals, type RenewalRow } from "@/lib/hr/queries";

export const metadata = { title: "Renewals" };
export const dynamic = "force-dynamic";

export default async function RenewalsPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org: slug } = await params;
  const ctx = await requireTenant(slug);
  const buckets = await getRenewals(ctx.org.id, ctx.org.due_soon_days);

  const total =
    buckets.expired.length + buckets.dueSeven.length + buckets.dueThirty.length;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--brand-red)] font-bold">
          {ctx.org.name} - Renewals
        </p>
        <h1 className="mt-2 text-4xl md:text-5xl font-black">What lapses next</h1>
        <p className="mt-2 text-[var(--brand-slate)] max-w-2xl">
          Certifications, identity documents and certified copies together,
          because a work permit running out stops a person at the gate exactly
          like a lapsed induction does, and a certified copy older than three
          months gets the whole pack sent back. Sorted by how little time is
          left.
        </p>
      </header>

      {total === 0 ? (
        <div className="bg-white border border-[var(--brand-line)] rounded-2xl p-12 text-center">
          <p className="text-xl font-black">Nothing lapses in the next {buckets.horizonDays} days.</p>
          <p className="mt-2 text-[var(--brand-slate)]">
            Either your register is genuinely current, or there are expiry dates
            you have not captured yet.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          <Group
            slug={slug}
            title="Expired"
            subtitle="These people cannot pass a gate check today."
            icon={AlertTriangle}
            tone="red"
            rows={buckets.expired}
          />
          <Group
            slug={slug}
            title="Due within 7 days"
            subtitle="Book the refresher this week."
            icon={Clock}
            tone="amber"
            rows={buckets.dueSeven}
          />
          <Group
            slug={slug}
            title={`Due within ${buckets.horizonDays} days`}
            subtitle="Far enough out to plan around."
            icon={CalendarDays}
            tone="slate"
            rows={buckets.dueThirty}
          />
        </div>
      )}
    </div>
  );
}

function Group({
  slug,
  title,
  subtitle,
  icon: Icon,
  tone,
  rows,
}: {
  slug: string;
  title: string;
  subtitle: string;
  icon: typeof Clock;
  tone: "red" | "amber" | "slate";
  rows: RenewalRow[];
}) {
  const toneClass =
    tone === "red"
      ? "text-red-700"
      : tone === "amber"
        ? "text-amber-700"
        : "text-[var(--brand-slate)]";

  return (
    <section>
      <header className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h2 className={`text-xl font-black inline-flex items-center gap-2 ${toneClass}`}>
          <Icon size={18} />
          {title}
        </h2>
        <span className="text-xs text-[var(--brand-slate)]">{subtitle}</span>
      </header>

      {rows.length === 0 ? (
        <div className="bg-white border border-[var(--brand-line)] rounded-xl px-5 py-4 text-sm text-[var(--brand-slate)]">
          Nothing in this group.
        </div>
      ) : (
        <div className="bg-white border border-[var(--brand-line)] rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--brand-cream)] text-left">
              <tr>
                <Th>Person</Th>
                <Th>What</Th>
                <Th>Site</Th>
                <Th>Superior</Th>
                <Th>Expires</Th>
                <Th>Days</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.key}
                  className="border-t border-[var(--brand-line)] hover:bg-[var(--brand-cream)]/50"
                >
                  <Td>
                    <Link
                      href={`/${slug}/hr/employees/${r.employee_id}`}
                      className="font-bold text-[var(--brand-ink)] hover:text-[var(--brand-red)]"
                    >
                      {r.surname}, {r.names}
                    </Link>
                    <span className="block font-mono text-[10px] text-[var(--brand-slate)]">
                      {r.id_number}
                    </span>
                  </Td>
                  <Td>
                    <span className="inline-flex items-center gap-1.5">
                      {r.kind === "document" ? (
                        <BookUser size={12} className="text-[var(--brand-red)]" />
                      ) : r.kind === "certified_copy" ? (
                        <Stamp size={12} className="text-amber-700" />
                      ) : (
                        <FileBadge size={12} className="text-[var(--brand-slate)]" />
                      )}
                      {r.label}
                    </span>
                  </Td>
                  <Td>{r.site ?? "-"}</Td>
                  <Td>{r.superior ?? "-"}</Td>
                  <Td className="font-mono text-xs">{r.expiry_date}</Td>
                  <Td>
                    <span
                      className={`font-mono text-xs font-bold ${
                        r.days_left < 0
                          ? "text-red-700"
                          : r.days_left <= 7
                            ? "text-amber-700"
                            : "text-[var(--brand-slate)]"
                      }`}
                    >
                      {r.days_left < 0
                        ? `${Math.abs(r.days_left)} over`
                        : `${r.days_left} left`}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-[var(--brand-line)] px-4 py-2 text-xs text-[var(--brand-slate)]">
            {rows.length} item{rows.length === 1 ? "" : "s"}
          </div>
        </div>
      )}
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 font-bold uppercase tracking-widest text-[10px] text-[var(--brand-slate)]">
      {children}
    </th>
  );
}
function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 whitespace-nowrap ${className}`}>{children}</td>
  );
}
