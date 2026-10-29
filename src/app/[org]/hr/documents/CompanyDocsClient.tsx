"use client";

import { useState } from "react";
import { useGuardedTransition } from "@/components/useGuardedTransition";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Eye,
  Download,
  Pencil,
  X,
  Paperclip,
  AlertTriangle,
} from "lucide-react";
import type { CompanyDocument } from "@/lib/types/database";
import {
  COMPANY_DOCUMENT_CATEGORIES,
  companyCategoryLabel,
} from "@/lib/hr/company-documents";
import {
  upsertCompanyDocument,
  deleteCompanyDocument,
} from "@/lib/hr/mutations";

export default function CompanyDocsClient({
  orgId,
  slug,
  canWrite,
  documents,
}: {
  orgId: string;
  slug: string;
  canWrite: boolean;
  documents: CompanyDocument[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useGuardedTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyDocument | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    if (editing) form.set("id", editing.id);
    startTransition(async () => {
      const result = await upsertCompanyDocument(orgId, slug, form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setEditing(null);
      router.refresh();
    });
  }

  function onDelete(doc: CompanyDocument) {
    if (!confirm(`Delete "${doc.title}" and its file? This cannot be undone.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteCompanyDocument(orgId, slug, doc.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function startEdit(doc: CompanyDocument) {
    setEditing(doc);
    setOpen(true);
    setError(null);
  }

  function startNew() {
    setEditing(null);
    setOpen(true);
    setError(null);
  }

  const expired = documents.filter(
    (d) => d.expires_at !== null && d.expires_at < today,
  );

  return (
    <div className="space-y-4">
      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      {expired.length > 0 ? (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800 flex items-start gap-2">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            {expired.length} company document
            {expired.length === 1 ? " has" : "s have"} expired. A letter of good
            standing or a lapsed public liability schedule will fail a pack on
            its own, before anyone looks at your crew.
          </span>
        </div>
      ) : null}

      {canWrite && !open ? (
        <button
          onClick={startNew}
          className="inline-flex items-center gap-2 bg-[var(--brand-red)] hover:bg-[var(--brand-red-deep)] text-white px-4 py-2.5 rounded-md font-bold text-sm transition"
        >
          <Plus size={14} />
          Add a document
        </button>
      ) : null}

      {open ? (
        <form
          onSubmit={onSubmit}
          className="bg-white border border-[var(--brand-line)] rounded-2xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <p className="font-black">
              {editing ? "Edit document" : "Add a document"}
            </p>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setEditing(null);
              }}
              className="text-[var(--brand-slate)] hover:text-[var(--brand-ink)]"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label required>Category</Label>
              <select
                name="category"
                defaultValue={editing?.category ?? "policy"}
                className="mt-1 w-full border border-[var(--brand-line)] rounded-md p-3 bg-white text-sm"
              >
                {COMPANY_DOCUMENT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label required>Title</Label>
              <input
                type="text"
                name="title"
                defaultValue={editing?.title ?? ""}
                required
                maxLength={160}
                className="mt-1 w-full border border-[var(--brand-line)] rounded-md p-3 text-sm"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Issued</Label>
              <input
                type="date"
                name="issued_at"
                defaultValue={editing?.issued_at ?? ""}
                className="mt-1 w-full border border-[var(--brand-line)] rounded-md p-3 text-sm"
              />
            </div>
            <div>
              <Label>Expires</Label>
              <input
                type="date"
                name="expires_at"
                defaultValue={editing?.expires_at ?? ""}
                className="mt-1 w-full border border-[var(--brand-line)] rounded-md p-3 text-sm"
              />
              <p className="mt-1 text-xs text-[var(--brand-slate)]">
                Letters of good standing and insurance schedules expire. Record
                it and they show up in renewals.
              </p>
            </div>
          </div>

          <div>
            <Label>File</Label>
            <input
              type="file"
              name="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx"
              className="mt-1 w-full border border-[var(--brand-line)] rounded-md p-3 text-sm file:mr-3 file:rounded file:border-0 file:bg-[var(--brand-ink)] file:px-3 file:py-1.5 file:text-white file:font-bold"
            />
            <p className="mt-1 text-xs text-[var(--brand-slate)]">
              PDF binds into the safety file pack. Images bind as a page. Word
              documents are stored but cannot be bound, so convert them to PDF.
              {editing?.file_path
                ? " Choosing a new file replaces the one on record."
                : ""}
            </p>
          </div>

          <div className="flex items-center gap-3 pt-3 border-t border-[var(--brand-line)]">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 bg-[var(--brand-red)] hover:bg-[var(--brand-red-deep)] disabled:opacity-60 text-white px-5 py-2.5 rounded-md font-bold text-sm transition"
            >
              {pending ? "Saving..." : editing ? "Save changes" : "Add document"}
            </button>
          </div>
        </form>
      ) : null}

      {documents.length === 0 ? (
        <div className="bg-white border border-[var(--brand-line)] rounded-2xl p-10 text-center text-[var(--brand-slate)]">
          No company documents yet. These are the sections of a safety file that
          do not come off your register.
        </div>
      ) : (
        <div className="bg-white border border-[var(--brand-line)] rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--brand-cream)] text-left">
              <tr>
                <Th>Category</Th>
                <Th>Title</Th>
                <Th>Issued</Th>
                <Th>Expires</Th>
                <Th>File</Th>
                <Th>&nbsp;</Th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => {
                const lapsed = doc.expires_at !== null && doc.expires_at < today;
                return (
                  <tr
                    key={doc.id}
                    className="border-t border-[var(--brand-line)] hover:bg-[var(--brand-cream)]/50"
                  >
                    <Td className="text-[var(--brand-slate)]">
                      {companyCategoryLabel(doc.category)}
                    </Td>
                    <Td className="font-bold">{doc.title}</Td>
                    <Td className="font-mono text-xs">{doc.issued_at ?? "-"}</Td>
                    <Td
                      className={`font-mono text-xs ${lapsed ? "text-red-700 font-bold" : ""}`}
                    >
                      {doc.expires_at ?? "-"}
                    </Td>
                    <Td>
                      {doc.file_path ? (
                        <span className="inline-flex items-center gap-3">
                          <a
                            href={`/${slug}/hr/documents/${doc.id}/file`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[var(--brand-red)] font-bold text-xs hover:underline"
                          >
                            <Eye size={12} />
                            View
                          </a>
                          <a
                            href={`/${slug}/hr/documents/${doc.id}/file?download=1`}
                            className="inline-flex items-center gap-1 text-[var(--brand-ink)] font-bold text-xs hover:underline"
                          >
                            <Download size={12} />
                            Download
                          </a>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[var(--brand-slate)] opacity-40 text-xs">
                          <Paperclip size={12} />
                          None
                        </span>
                      )}
                    </Td>
                    <Td>
                      {canWrite ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => startEdit(doc)}
                            disabled={pending}
                            className="p-1.5 rounded text-[var(--brand-slate)] hover:text-[var(--brand-ink)] hover:bg-[var(--brand-cream)] transition"
                            aria-label="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => onDelete(doc)}
                            disabled={pending}
                            className="p-1.5 rounded text-red-600 hover:bg-red-50 transition"
                            aria-label="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ) : null}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Label({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="text-xs uppercase tracking-widest font-bold text-[var(--brand-slate)]">
      {children}{" "}
      {required ? <span className="text-[var(--brand-red)]">*</span> : null}
    </label>
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
