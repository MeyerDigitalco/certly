import Link from "next/link";
import { CertlyMark } from "@/components/CertlyMark";
import { requireSuperadmin } from "@/lib/admin/access";
import { getAdminMetrics, type WorkspaceRow } from "@/lib/admin/metrics";

export const metadata = {
  title: "Operator console",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function day(iso: string | null): string {
  if (!iso) return "never";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function sinceDays(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
}

function rands(value: number): string {
  return `R${value.toLocaleString("en-ZA")}`;
}

export default async function AdminPage() {
  const { email } = await requireSuperadmin();
  const m = await getAdminMetrics();
  const f = m.funnel;

  return (
    <main className="min-h-screen bg-[var(--brand-paper)] px-6 py-10">
      <div className="max-w-6xl mx-auto space-y-10">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-[var(--brand-ink)] pb-4">
          <div>
            <Link href="/" className="flex items-center gap-2">
              <CertlyMark size={22} />
              <span className="font-black text-lg tracking-tight">Certly</span>
            </Link>
            <h1 className="mt-3 text-3xl font-black">Operator console</h1>
            <p className="text-sm text-[var(--brand-slate)]">
              Signed in as {email}. Counts only: no employee record, name or
              identity number is readable from this page.
            </p>
          </div>
          <p className="font-mono text-xs text-[var(--brand-slate)]">
            {day(m.generatedAt)}
          </p>
        </header>

        <section>
          <SectionLabel>Where people stop</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Accounts" value={f.accounts} note={`${m.newAccounts7} in the last 7 days`} />
            <Stat
              label="Signed up, no workspace"
              value={f.accountsWithoutWorkspace}
              note="Created an account and stopped"
              warn={f.accountsWithoutWorkspace > 0}
            />
            <Stat label="Workspaces" value={f.workspaces} note={`${m.newWorkspaces30} in the last 30 days`} />
            <Stat label="Used in last 7 days" value={m.activeWorkspaces7} note="Wrote something to the register" />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Trials running" value={f.trialsLive} note="Not yet subscribed, still in the 14 days" />
            <Stat
              label="Trials lapsed unpaid"
              value={f.trialsLapsedUnpaid}
              note="Tried it and did not subscribe"
              warn={f.trialsLapsedUnpaid > 0}
            />
            <Stat label="Paying" value={f.paying} note={`${rands(m.mrrRands)} a month at today's headcounts`} good />
            <Stat label="Cancelled" value={f.cancelled} note="Subscribed, then stopped" warn={f.cancelled > 0} />
          </div>
        </section>

        <section>
          <SectionLabel>What is in the product</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="People on registers" value={m.totals.people} note="In service, across every workspace" />
            <Stat label="Certificates held" value={m.totals.certifications} note="Across every workspace" />
            <Stat label="Suggestions received" value={m.totals.suggestions} note="Sent from inside a workspace" />
          </div>
        </section>

        <section>
          <SectionLabel>Workspaces</SectionLabel>
          <div className="bg-white border border-[var(--brand-line)] rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--brand-cream)] text-left text-[10px] uppercase tracking-widest text-[var(--brand-slate)]">
                  <th className="px-4 py-2.5 font-bold">Workspace</th>
                  <th className="px-4 py-2.5 font-bold">Owner</th>
                  <th className="px-4 py-2.5 font-bold">State</th>
                  <th className="px-4 py-2.5 font-bold text-right">Team</th>
                  <th className="px-4 py-2.5 font-bold text-right">People</th>
                  <th className="px-4 py-2.5 font-bold text-right">Certs</th>
                  <th className="px-4 py-2.5 font-bold">Started</th>
                  <th className="px-4 py-2.5 font-bold">Last used</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--brand-line)]">
                {m.workspaces.map((w) => (
                  <Row key={w.id} w={w} now={m.generatedAt} />
                ))}
              </tbody>
            </table>
          </div>
          {m.workspaces.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--brand-slate)]">
              No workspaces yet.
            </p>
          ) : null}
        </section>

        <section className="bg-white border border-[var(--brand-line)] rounded-2xl p-6 max-w-3xl">
          <h2 className="font-black text-lg">What this page cannot tell you</h2>
          <p className="mt-2 text-sm text-[var(--brand-slate)]">
            How many people read the front page and left. Nobody who leaves
            writes a row, so the database has no record of them at all. That
            number lives in your analytics provider, alongside which page they
            landed on and where they came from. This page starts at the point
            somebody creates an account, which is the first thing Certly
            itself ever sees.
          </p>
        </section>
      </div>
    </main>
  );
}

function Row({ w, now }: { w: WorkspaceRow; now: string }) {
  const idle = sinceDays(w.lastActivity);
  const state =
    w.subscriptionStatus === "active"
      ? { label: "Paying", tone: "bg-emerald-50 text-emerald-800" }
      : w.subscriptionStatus === "cancelled"
        ? { label: "Cancelled", tone: "bg-red-50 text-red-700" }
        : w.subscriptionStatus === "past_due"
          ? { label: "Past due", tone: "bg-amber-50 text-amber-800" }
          : w.trialEndsAt > now
            ? { label: "Trial", tone: "bg-sky-50 text-sky-800" }
            : { label: "Trial lapsed", tone: "bg-[var(--brand-cream)] text-[var(--brand-slate)]" };

  return (
    <tr>
      <td className="px-4 py-2.5">
        <span className="font-bold">{w.name}</span>
        <span className="block font-mono text-[11px] text-[var(--brand-slate)]">
          /{w.slug}
        </span>
      </td>
      <td className="px-4 py-2.5 break-all text-[13px]">{w.owner}</td>
      <td className="px-4 py-2.5">
        <span className={`inline-block rounded-sm px-2 py-0.5 text-[11px] font-bold ${state.tone}`}>
          {state.label}
        </span>
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums">{w.members}</td>
      <td className="px-4 py-2.5 text-right tabular-nums">{w.people}</td>
      <td className="px-4 py-2.5 text-right tabular-nums">{w.certifications}</td>
      <td className="px-4 py-2.5 whitespace-nowrap">{day(w.createdAt)}</td>
      <td className="px-4 py-2.5 whitespace-nowrap">
        {idle === null ? (
          <span className="text-[var(--brand-slate)]">never</span>
        ) : idle === 0 ? (
          "today"
        ) : (
          `${idle} ${idle === 1 ? "day" : "days"} ago`
        )}
      </td>
    </tr>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[10px] uppercase tracking-widest font-bold text-[var(--brand-red)]">
      {children}
    </p>
  );
}

function Stat({
  label,
  value,
  note,
  good,
  warn,
}: {
  label: string;
  value: number;
  note: string;
  good?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="bg-white border border-[var(--brand-line)] rounded-xl px-5 py-4">
      <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--brand-slate)]">
        {label}
      </p>
      <p
        className={`mt-1 text-3xl font-black tabular-nums ${
          good ? "text-emerald-700" : warn ? "text-[var(--brand-red)]" : ""
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-[var(--brand-slate)]">{note}</p>
    </div>
  );
}
