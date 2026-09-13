"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, Download, Eye, Paperclip, Pencil, Plus } from "lucide-react";
import type { EmployeeCertificationRow } from "@/lib/types/database";
import { certStatus } from "@/lib/certifications/status";
import StatusChip from "@/components/hr/StatusChip";
import { bulkDeleteCertifications } from "@/lib/hr/mutations";

export default function EmployeeCertsClient({
  certs,
  orgId,
  slug,
  employeeId,
  canWrite,
  dueSoonDays,
}: {
  certs: EmployeeCertificationRow[];
  orgId: string;
  slug: string;
  employeeId: string;
  canWrite: boolean;
  dueSoonDays: number;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const allSelected = certs.length > 0 && selected.size === certs.length;
  const noExpiryIds = certs.filter((c) => !c.expiry_date).map((c) => c.id);

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
    else setSelected(new Set(certs.map((c) => c.id)));
  }

  function selectNoExpiry() {
    setSelected(new Set(noExpiryIds));
  }

  function bulkDelete() {
    setError(null);
    if (selected.size === 0) return;
    const count = selected.size;
    if (
      !confirm(
        `Delete ${count} certification${count === 1 ? "" : "s"} and any attached files? This cannot be undone.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await bulkDeleteCertifications(orgId, slug, [...selected]);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSelected(new Set());
      router.refresh();
    });
  }

  const addHref = `/${slug}/hr/certifications/scan?employee=${employeeId}`;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-black">Certifications</h2>
        <div className="flex flex-wrap items-center gap-2">
          {canWrite && noExpiryIds.length > 0 ? (
            <button
              onClick={selectNoExpiry}
              className="border border-[var(--brand-line)] hover:border-[var(--brand-ink)] px-3 py-2 rounded-md text-xs font-bold transition"
            >
              Select all no-expiry ({noExpiryIds.length})
            </button>
          ) : null}
          {canWrite ? (
            <Link
              href={addHref}
              className="inline-flex items-center gap-2 bg-[var(--brand-red)] hover:bg-[var(--brand-red-deep)] text-white px-4 py-2 rounded-md font-bold text-sm transition"
            >
              <Plus size={14} />
              Add certification
            </Link>
          ) : null}
        </div>
      </div>

      {canWrite && selected.size > 0 ? (
        <div className="mb-3 bg-[var(--brand-ink)] text-white rounded-md px-4 py-3 flex items-center justify-between shadow-lg">
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

      {certs.length === 0 ? (
        <div className="bg-white border border-[var(--brand-line)] rounded-2xl p-10 text-center text-[var(--brand-slate)]">
          No certifications on record yet.{" "}
          {canWrite ? (
            <Link href={addHref} className="text-[var(--brand-red)] font-bold">
              Add the first one
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="bg-white border border-[var(--brand-line)] rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--brand-cream)] text-left">
              <tr>
                {canWrite ? (
                  <th className="px-3 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Select all certifications"
                    />
                  </th>
                ) : null}
                <Th>Training type</Th>
                <Th>Trained</Th>
                <Th>Expires</Th>
                <Th>Status</Th>
                <Th>Attachment</Th>
                <Th>&nbsp;</Th>
              </tr>
            </thead>
            <tbody>
              {certs.map((c) => {
                const { status, daysLeft } = certStatus(
                  c.expiry_date,
                  dueSoonDays,
                );
                return (
                  <tr
                    key={c.id}
                    className={`border-t border-[var(--brand-line)] hover:bg-[var(--brand-cream)]/50 ${
                      selected.has(c.id) ? "bg-[var(--brand-red)]/5" : ""
                    }`}
                  >
                    {canWrite ? (
                      <td className="px-3 py-3 w-8">
                        <input
                          type="checkbox"
                          checked={selected.has(c.id)}
                          onChange={() => toggle(c.id)}
                          aria-label={`Select ${c.training_type_name}`}
                        />
                      </td>
                    ) : null}
                    <Td className="font-bold">{c.training_type_name}</Td>
                    <Td>{c.training_date ?? "-"}</Td>
                    <Td>{c.expiry_date ?? "-"}</Td>
                    <Td>
                      <StatusChip status={status} daysLeft={daysLeft} />
                    </Td>
                    <Td>
                      {c.cert_file_path ? (
                        <span className="inline-flex items-center gap-3">
                          <a
                            href={`/${slug}/hr/certifications/${c.id}/file`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[var(--brand-red)] font-bold text-xs hover:underline"
                          >
                            <Eye size={12} />
                            View
                          </a>
                          <a
                            href={`/${slug}/hr/certifications/${c.id}/file?download=1`}
                            className="inline-flex items-center gap-1 text-[var(--brand-ink)] font-bold text-xs hover:underline"
                          >
                            <Download size={12} />
                            Download
                          </a>
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-[var(--brand-slate)] opacity-40"
                          title="No file attached"
                        >
                          <Paperclip size={12} />
                          <span className="text-xs">None</span>
                        </span>
                      )}
                    </Td>
                    <Td>
                      {canWrite ? (
                        <Link
                          href={`/${slug}/hr/certifications/${c.id}/edit`}
                          className="inline-flex items-center gap-1 text-[var(--brand-red)] font-bold text-xs hover:underline"
                        >
                          <Pencil size={12} />
                          Edit
                        </Link>
                      ) : null}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
