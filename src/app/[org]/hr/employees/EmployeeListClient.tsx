"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, MapPin } from "lucide-react";
import type { Employee } from "@/lib/types/database";
import { bulkDeleteEmployees } from "@/lib/hr/mutations";
import { idTypeLabel } from "@/lib/validation/identification";

export default function EmployeeListClient({
  employees,
  orgId,
  slug,
  canWrite,
}: {
  employees: Employee[];
  orgId: string;
  slug: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const allSelected =
    employees.length > 0 && selected.size === employees.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(employees.map((e) => e.id)));
  }

  function bulkDelete() {
    setError(null);
    if (selected.size === 0) return;
    const count = selected.size;
    if (
      !confirm(
        `Delete ${count} employee${count === 1 ? "" : "s"} and all their certifications? This cannot be undone.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await bulkDeleteEmployees(orgId, slug, [...selected]);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSelected(new Set());
      router.refresh();
    });
  }

  if (employees.length === 0) {
    return (
      <div className="bg-white border border-[var(--brand-line)] rounded-2xl p-10 text-center text-[var(--brand-slate)]">
        No employees yet.{" "}
        {canWrite ? (
          <Link
            href={`/${slug}/hr/employees/new`}
            className="text-[var(--brand-red)] font-bold"
          >
            Add the first one
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <>
      {canWrite && selected.size > 0 ? (
        <div className="sticky top-[68px] z-10 mb-3 bg-[var(--brand-ink)] text-white rounded-md px-4 py-3 flex items-center justify-between shadow-lg">
          <span className="text-sm font-bold">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-white/70 hover:text-white transition"
            >
              Clear
            </button>
            <button
              onClick={bulkDelete}
              disabled={pending}
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white px-3 py-1.5 rounded-md text-xs font-bold transition"
            >
              <Trash2 size={12} />
              {pending ? "Deleting..." : "Delete selected"}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mb-3 bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      <div className="bg-white border border-[var(--brand-line)] rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--brand-cream)] text-left">
            <tr>
              {canWrite ? (
                <th className="px-3 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all"
                  />
                </th>
              ) : null}
              <Th>Surname</Th>
              <Th>Names</Th>
              <Th>ID number</Th>
              <Th>Site</Th>
              <Th>Superior</Th>
              <Th>Designation</Th>
              <Th>&nbsp;</Th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr
                key={e.id}
                className={`border-t border-[var(--brand-line)] hover:bg-[var(--brand-cream)]/50 ${
                  selected.has(e.id) ? "bg-[var(--brand-red)]/5" : ""
                }`}
              >
                {canWrite ? (
                  <td className="px-3 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={selected.has(e.id)}
                      onChange={() => toggle(e.id)}
                      aria-label={`Select ${e.surname} ${e.names}`}
                    />
                  </td>
                ) : null}
                <Td>
                  <Link
                    href={`/${slug}/hr/employees/${e.id}`}
                    className="font-bold text-[var(--brand-ink)] hover:text-[var(--brand-red)]"
                  >
                    {e.surname}
                  </Link>
                </Td>
                <Td>{e.names}</Td>
                <Td className="font-mono text-xs">
                  {e.id_number}
                  {e.id_type !== "sa_id" ? (
                    <span className="ml-2 font-sans not-italic text-[9px] uppercase tracking-wider font-bold text-[var(--brand-slate)] border border-[var(--brand-line)] rounded px-1 py-0.5">
                      {idTypeLabel(e.id_type)}
                    </span>
                  ) : null}
                </Td>
                <Td>
                  {e.site ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={10} className="text-[var(--brand-red)]" />
                      {e.site}
                    </span>
                  ) : (
                    "-"
                  )}
                </Td>
                <Td>{e.superior ?? "-"}</Td>
                <Td>{e.designation ?? "-"}</Td>
                <Td>
                  <Link
                    href={`/${slug}/hr/employees/${e.id}`}
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
    </>
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
