import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { RegisterRow } from "@/lib/types/database";
import type { RegisterSortKey, SortDirection } from "@/lib/hr/queries";
import StatusChip from "./StatusChip";

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

interface Props {
  slug: string;
  rows: RegisterRow[];
  sort?: RegisterSortKey;
  dir: SortDirection;
  currentParams: Record<string, string | undefined>;
}

export default function RegisterTable({
  slug,
  rows,
  sort,
  dir,
  currentParams,
}: Props) {
  if (rows.length === 0) {
    return (
      <div className="bg-white border border-[var(--brand-line)] rounded-2xl p-10 text-center">
        <p className="text-[var(--brand-slate)]">
          No certifications match those filters.
        </p>
      </div>
    );
  }

  const columns: Array<{ key: RegisterSortKey | null; label: string }> = [
    { key: "surname", label: "Surname" },
    { key: "names", label: "Names" },
    { key: "sa_id", label: "SA ID" },
    { key: "site", label: "Site" },
    { key: "training_type", label: "Training" },
    { key: "training_date", label: "Training date" },
    { key: "expiry_date", label: "Expiry date" },
    { key: "status", label: "Status" },
    { key: null, label: "" },
  ];

  function buildSortHref(colKey: RegisterSortKey): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(currentParams)) {
      if (v) params.set(k, v);
    }
    // Toggle direction if clicking the current column, otherwise start asc.
    const nextDir: SortDirection =
      sort === colKey && dir === "asc" ? "desc" : "asc";
    params.set("sort", colKey);
    params.set("dir", nextDir);
    return `/${slug}/hr?${params.toString()}`;
  }

  return (
    <div className="bg-white border border-[var(--brand-line)] rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--brand-cream)] text-left">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.label + (col.key ?? "spacer")}
                  className="px-4 py-3 font-bold uppercase tracking-widest text-[10px] text-[var(--brand-slate)]"
                >
                  {col.key ? (
                    <Link
                      href={buildSortHref(col.key)}
                      className="inline-flex items-center gap-1 hover:text-[var(--brand-red)] transition"
                    >
                      {col.label}
                      {sort === col.key ? (
                        dir === "asc" ? (
                          <ArrowUp
                            size={10}
                            className="text-[var(--brand-red)]"
                          />
                        ) : (
                          <ArrowDown
                            size={10}
                            className="text-[var(--brand-red)]"
                          />
                        )
                      ) : (
                        <ArrowUpDown size={10} className="opacity-40" />
                      )}
                    </Link>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.certification_id}
                className="border-t border-[var(--brand-line)] hover:bg-[var(--brand-cream)]/50 transition"
              >
                <Td>
                  <span className="font-bold text-[var(--brand-ink)]">
                    {r.surname}
                  </span>
                </Td>
                <Td>{r.names}</Td>
                <Td className="font-mono text-xs">{r.sa_id}</Td>
                <Td>{r.site ?? "-"}</Td>
                <Td className="whitespace-normal">{r.training_type}</Td>
                <Td>{fmtDate(r.training_date)}</Td>
                <Td>{fmtDate(r.expiry_date)}</Td>
                <Td>
                  <StatusChip status={r.status} daysLeft={r.days_left} />
                </Td>
                <Td>
                  <Link
                    href={`/${slug}/hr/employees/${r.employee_id}`}
                    className="text-[var(--brand-red)] font-bold text-xs hover:underline"
                  >
                    View
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-[var(--brand-line)] px-4 py-2 text-xs text-[var(--brand-slate)]">
        {rows.length} row{rows.length === 1 ? "" : "s"}
      </div>
    </div>
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
