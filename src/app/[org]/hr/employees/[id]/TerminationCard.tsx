"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserMinus, Undo2, AlertTriangle } from "lucide-react";
import type { Employee } from "@/lib/types/database";
import { terminateEmployee, reinstateEmployee } from "@/lib/hr/mutations";
import { TERMINATION_REASONS, terminationLabel } from "@/lib/hr/operations";

export default function TerminationCard({
  orgId,
  slug,
  employee,
  canWrite,
}: {
  orgId: string;
  slug: string;
  employee: Employee;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  function onTerminate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await terminateEmployee(orgId, slug, employee.id, form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  function onReinstate() {
    if (!confirm("Reinstate this person? They will count on the register and as a seat again.")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await reinstateEmployee(orgId, slug, employee.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (employee.terminated_at) {
    return (
      <div className="bg-[var(--brand-cream)] border border-[var(--brand-line)] rounded-xl p-4">
        <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--brand-slate)] flex items-center gap-1.5">
          <UserMinus size={11} />
          Left the register
        </p>
        <p className="mt-2 text-sm">
          <span className="font-bold">{terminationLabel(employee.termination_reason)}</span>
          <span className="text-[var(--brand-slate)]"> on {employee.terminated_at}</span>
        </p>
        {employee.termination_notes ? (
          <p className="mt-1 text-xs text-[var(--brand-slate)]">{employee.termination_notes}</p>
        ) : null}
        <p className="mt-2 text-xs text-[var(--brand-slate)]">
          Not counted as a seat, not on the live register, not in safety file
          packs. Certificate history is kept.
        </p>
        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
        {canWrite ? (
          <button
            type="button"
            onClick={onReinstate}
            disabled={pending}
            className="mt-3 inline-flex items-center gap-1 text-[var(--brand-red)] font-bold text-xs hover:underline disabled:opacity-50"
          >
            <Undo2 size={12} />
            {pending ? "Working..." : "Recorded in error, reinstate"}
          </button>
        ) : null}
      </div>
    );
  }

  if (!canWrite) return null;

  if (!open) {
    return (
      <div className="bg-white border border-[var(--brand-line)] rounded-xl p-4">
        <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--brand-slate)] flex items-center gap-1.5">
          <UserMinus size={11} />
          Leaving
        </p>
        <p className="mt-2 text-xs text-[var(--brand-slate)]">
          When someone leaves, record it here rather than deleting them. The
          monthly Staff Movement report is built from these records.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 inline-flex items-center gap-1 text-[var(--brand-red)] font-bold text-xs hover:underline"
        >
          <UserMinus size={12} />
          Record a termination
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onTerminate}
      className="bg-white border border-amber-300 rounded-xl p-4 space-y-3"
    >
      <p className="text-sm font-bold flex items-center gap-2">
        <AlertTriangle size={14} className="text-amber-700" />
        Record that {employee.names} {employee.surname} has left
      </p>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div>
        <label className="text-xs uppercase tracking-widest font-bold text-[var(--brand-slate)]">
          Last day of service
        </label>
        <input
          type="date"
          name="terminated_at"
          required
          max={today}
          defaultValue={today}
          className="mt-1 w-full border border-[var(--brand-line)] rounded-md p-2.5 text-sm"
        />
      </div>
      <div>
        <label className="text-xs uppercase tracking-widest font-bold text-[var(--brand-slate)]">
          Reason
        </label>
        <select
          name="termination_reason"
          required
          defaultValue=""
          className="mt-1 w-full border border-[var(--brand-line)] rounded-md p-2.5 text-sm bg-white"
        >
          <option value="" disabled>
            Choose a reason
          </option>
          <optgroup label="No fault">
            {TERMINATION_REASONS.filter((r) => r.cls === "no_fault").map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Fault">
            {TERMINATION_REASONS.filter((r) => r.cls === "fault").map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </optgroup>
        </select>
      </div>
      <div>
        <label className="text-xs uppercase tracking-widest font-bold text-[var(--brand-slate)]">
          Note
        </label>
        <input
          type="text"
          name="termination_notes"
          maxLength={500}
          placeholder="Optional"
          className="mt-1 w-full border border-[var(--brand-line)] rounded-md p-2.5 text-sm"
        />
      </div>
      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 bg-[var(--brand-ink)] hover:bg-[var(--brand-charcoal)] disabled:opacity-60 text-white px-4 py-2 rounded-md text-sm font-bold transition"
        >
          <UserMinus size={14} />
          {pending ? "Saving..." : "Record termination"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm font-bold text-[var(--brand-slate)]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
