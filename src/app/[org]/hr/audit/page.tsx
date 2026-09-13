import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  ScrollText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { isOwner } from "@/lib/auth/roles";
import {
  getAuditLog,
  auditTableLabel,
  type AuditAction,
  type AuditEntry,
} from "@/lib/hr/audit";

export const metadata = { title: "Activity" };
export const dynamic = "force-dynamic";

const TABLES = ["employees", "certifications", "extraction_drafts"];
const ACTIONS: AuditAction[] = ["INSERT", "UPDATE", "DELETE"];

function isAction(value: string | undefined): value is AuditAction {
  return value === "INSERT" || value === "UPDATE" || value === "DELETE";
}

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{
    table?: string;
    action?: string;
    actor?: string;
    page?: string;
  }>;
}) {
  const { org: slug } = await params;
  const sp = await searchParams;
  const ctx = await requireTenant(slug);

  // The audit trail records who touched whose record. An admin seeing it
  // would be reading a log of their colleagues, so it stays with the owner,
  // which is also what the RLS policy on the table enforces.
  if (!isOwner(ctx.role)) notFound();

  const page = Math.max(0, Number(sp.page ?? "0") || 0);
  const log = await getAuditLog(
    ctx.org.id,
    {
      table: TABLES.includes(sp.table ?? "") ? sp.table : undefined,
      action: isAction(sp.action) ? sp.action : undefined,
      actor: sp.actor || undefined,
    },
    page,
  );

  const query = (over: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams();
    const merged = {
      table: sp.table,
      action: sp.action,
      actor: sp.actor,
      page: String(page),
      ...over,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value !== undefined && value !== "" && value !== "0") {
        next.set(key, String(value));
      }
    }
    const qs = next.toString();
    return `/${slug}/hr/audit${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${slug}/hr`}
          className="text-[var(--brand-red)] text-xs font-bold inline-flex items-center gap-1"
        >
          <ArrowLeft size={12} /> Back to register
        </Link>
        <h1 className="mt-2 text-3xl font-black">Activity</h1>
        <p className="mt-2 text-[var(--brand-slate)] max-w-2xl">
          Every change to an employee record, a certification or a scanned
          document, who made it and when. Written by the database itself, not by
          the application, so it records what actually happened rather than what
          a screen intended. It cannot be edited or deleted from here.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Filter href={query({ table: undefined, page: 0 })} active={!sp.table}>
          All records
        </Filter>
        {TABLES.map((t) => (
          <Filter
            key={t}
            href={query({ table: t, page: 0 })}
            active={sp.table === t}
          >
            {auditTableLabel(t)}
          </Filter>
        ))}
        <span className="w-px bg-[var(--brand-line)] mx-1" />
        <Filter href={query({ action: undefined, page: 0 })} active={!sp.action}>
          Any change
        </Filter>
        {ACTIONS.map((a) => (
          <Filter
            key={a}
            href={query({ action: a, page: 0 })}
            active={sp.action === a}
          >
            {a === "INSERT" ? "Added" : a === "UPDATE" ? "Changed" : "Deleted"}
          </Filter>
        ))}
      </div>

      {log.actors.length > 1 ? (
        <div className="flex flex-wrap gap-2 text-xs">
          <Filter href={query({ actor: undefined, page: 0 })} active={!sp.actor}>
            Anyone
          </Filter>
          {log.actors.map((a) => (
            <Filter
              key={a.id}
              href={query({ actor: a.id, page: 0 })}
              active={sp.actor === a.id}
            >
              {a.email}
            </Filter>
          ))}
        </div>
      ) : null}

      {log.entries.length === 0 ? (
        <div className="bg-white border border-[var(--brand-line)] rounded-2xl p-12 text-center">
          <ScrollText
            size={24}
            className="mx-auto text-[var(--brand-slate)] opacity-40"
          />
          <p className="mt-3 font-black">Nothing recorded yet</p>
          <p className="mt-1 text-sm text-[var(--brand-slate)]">
            {sp.table || sp.action || sp.actor
              ? "No changes match these filters."
              : "Changes appear here as soon as anyone edits the register."}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-[var(--brand-line)] rounded-2xl divide-y divide-[var(--brand-line)]">
          {log.entries.map((entry) => (
            <Row key={entry.id} entry={entry} />
          ))}
        </div>
      )}

      {page > 0 || log.hasMore ? (
        <div className="flex items-center justify-between">
          {page > 0 ? (
            <Link
              href={query({ page: page - 1 })}
              className="inline-flex items-center gap-1 text-sm font-bold text-[var(--brand-ink)] hover:text-[var(--brand-red)]"
            >
              <ChevronLeft size={14} /> Newer
            </Link>
          ) : (
            <span />
          )}
          {log.hasMore ? (
            <Link
              href={query({ page: page + 1 })}
              className="inline-flex items-center gap-1 text-sm font-bold text-[var(--brand-ink)] hover:text-[var(--brand-red)]"
            >
              Older <ChevronRight size={14} />
            </Link>
          ) : (
            <span />
          )}
        </div>
      ) : null}
    </div>
  );
}

function Row({ entry }: { entry: AuditEntry }) {
  const Icon =
    entry.action === "INSERT"
      ? Plus
      : entry.action === "DELETE"
        ? Trash2
        : Pencil;
  const tone =
    entry.action === "INSERT"
      ? "text-emerald-700"
      : entry.action === "DELETE"
        ? "text-red-700"
        : "text-[var(--brand-slate)]";

  const when = new Date(entry.at);

  return (
    <div className="px-4 py-3 flex items-start gap-3">
      <Icon size={14} className={`mt-0.5 shrink-0 ${tone}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold">{entry.summary}</p>
        {entry.changed.length > 0 ? (
          <ul className="mt-1 space-y-0.5">
            {entry.changed.map((c) => (
              <li key={c.field} className="text-xs text-[var(--brand-slate)]">
                {c.field}:{" "}
                <span className="line-through opacity-70">{c.from}</span>{" "}
                <span className="font-bold text-[var(--brand-ink)]">
                  {c.to}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs font-mono text-[var(--brand-slate)]">
          {when.toLocaleDateString("en-ZA")}
        </p>
        <p className="text-[10px] font-mono text-[var(--brand-slate)] opacity-70">
          {when.toLocaleTimeString("en-ZA", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
        <p className="mt-0.5 text-[10px] text-[var(--brand-slate)] max-w-[160px] truncate">
          {entry.actorEmail}
        </p>
      </div>
    </div>
  );
}

function Filter({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-md font-bold border transition ${
        active
          ? "bg-[var(--brand-ink)] text-white border-[var(--brand-ink)]"
          : "border-[var(--brand-line)] text-[var(--brand-slate)] hover:border-[var(--brand-ink)] hover:text-[var(--brand-ink)]"
      }`}
    >
      {children}
    </Link>
  );
}
