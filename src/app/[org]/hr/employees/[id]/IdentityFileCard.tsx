"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BookUser,
  Eye,
  Download,
  X,
  ScanLine,
  Stamp,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { removeIdentityFile, setIdentityCertifiedAt } from "@/lib/hr/mutations";
import {
  certifiedCopyStatus,
  CERTIFIED_COPY_MAX_DAYS,
} from "@/lib/hr/certified-copy";

export default function IdentityFileCard({
  orgId,
  slug,
  employeeId,
  hasFile,
  documentLabel,
  certifiedAt,
  canWrite,
}: {
  orgId: string;
  slug: string;
  employeeId: string;
  hasFile: boolean;
  documentLabel: string;
  certifiedAt: string | null;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const copy = certifiedCopyStatus(certifiedAt, hasFile);
  const today = new Date().toISOString().slice(0, 10);

  function onSaveCertifiedAt(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const value = String(
      new FormData(e.currentTarget).get("certified_at") ?? "",
    );
    startTransition(async () => {
      const result = await setIdentityCertifiedAt(
        orgId,
        slug,
        employeeId,
        value || null,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function onRemove() {
    if (
      !confirm(
        "Remove the stored copy of this identity document? The identification details stay on the record.",
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await removeIdentityFile(orgId, slug, employeeId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="bg-white border border-[var(--brand-line)] rounded-xl p-4">
      <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--brand-slate)] flex items-center gap-1.5">
        <BookUser size={11} />
        {documentLabel} copy
      </p>

      {error ? (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      ) : null}

      {hasFile ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <a
            href={`/${slug}/hr/employees/${employeeId}/identity-file`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[var(--brand-red)] font-bold text-xs hover:underline"
          >
            <Eye size={12} />
            View
          </a>
          <a
            href={`/${slug}/hr/employees/${employeeId}/identity-file?download=1`}
            className="inline-flex items-center gap-1 text-[var(--brand-ink)] font-bold text-xs hover:underline"
          >
            <Download size={12} />
            Download
          </a>
          {canWrite ? (
            <button
              type="button"
              onClick={onRemove}
              disabled={pending}
              className="inline-flex items-center gap-1 text-[var(--brand-slate)] hover:text-red-700 font-bold text-xs transition disabled:opacity-50"
            >
              <X size={12} />
              {pending ? "Removing..." : "Remove"}
            </button>
          ) : null}
        </div>
      ) : null}

      {hasFile ? (
        <div
          className={`mt-3 pt-3 border-t border-[var(--brand-line)] ${
            copy.state === "stale" || copy.state === "missing"
              ? "text-red-800"
              : copy.state === "expiring"
                ? "text-amber-800"
                : "text-[var(--brand-slate)]"
          }`}
        >
          <p className="text-xs flex items-start gap-1.5">
            {copy.state === "stale" || copy.state === "missing" ? (
              <AlertTriangle size={11} className="mt-0.5 shrink-0" />
            ) : (
              <Stamp size={11} className="mt-0.5 shrink-0" />
            )}
            <span>{copy.label}</span>
          </p>

          {copy.state === "stale" || copy.state === "missing" ? (
            <p className="mt-1 text-xs">
              Most clients reject a certified copy older than{" "}
              {CERTIFIED_COPY_MAX_DAYS} days. Get it recertified before the next
              pack goes out.
            </p>
          ) : null}

          {canWrite ? (
            editing ? (
              <form
                onSubmit={onSaveCertifiedAt}
                className="mt-2 flex flex-wrap items-center gap-2"
              >
                <input
                  type="date"
                  name="certified_at"
                  max={today}
                  defaultValue={certifiedAt ?? ""}
                  className="border border-[var(--brand-line)] rounded-md p-1.5 text-xs"
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="bg-[var(--brand-ink)] text-white px-3 py-1.5 rounded text-xs font-bold disabled:opacity-50"
                >
                  {pending ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="text-xs font-bold text-[var(--brand-slate)]"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="mt-1.5 inline-flex items-center gap-1 text-[var(--brand-red)] font-bold text-xs hover:underline"
              >
                <Stamp size={12} />
                {certifiedAt ? "Change the date" : "Record when it was certified"}
              </button>
            )
          ) : null}
        </div>
      ) : null}

      {!hasFile ? (
        <div className="mt-2">
          <p className="text-xs text-[var(--brand-slate)]">
            No copy on file. Safety file packs usually want one.
          </p>
          {canWrite ? (
            <Link
              href={`/${slug}/hr/certifications/scan?employee=${employeeId}`}
              className="mt-1.5 inline-flex items-center gap-1 text-[var(--brand-red)] font-bold text-xs hover:underline"
            >
              <ScanLine size={12} />
              Upload the document
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
