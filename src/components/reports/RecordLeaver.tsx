"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserMinus, AlertTriangle } from "lucide-react";
import { terminateEmployee } from "@/lib/hr/mutations";
import { TERMINATION_REASONS } from "@/lib/hr/operations";

/**
 * Record a leaver without leaving the report. The person doing the monthly
 * pack is the one who knows who left; this puts the form where they are
 * looking instead of three clicks away on the employee page.
 */

export interface LeaverCandidate {
  id: string;
  name: string;
  site: string;
  designation: string;
}

export default function RecordLeaver({
  orgId,
  slug,
  employees,
  defaultDate,
  maxDate,
  faultOnly = false,
}: {
  orgId: string;
  slug: string;
  employees: LeaverCandidate[];
  defaultDate: string;
  maxDate: string;
  faultOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.site.toLowerCase().includes(q) ||
        e.designation.toLowerCase().includes(q),
    );
  }, [employees, filter]);

  const reasons = faultOnly
    ? TERMINATION_REASONS.filter((r) => r.cls === "fault")
    : TERMINATION_REASONS;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setDone(null);
    const form = new FormData(e.currentTarget);
    const id = String(form.get("employee_id") ?? "");
    if (!id) {
      setError("Choose the person who left");
      return;
    }
    const chosen = employees.find((x) => x.id === id);
    const target = e.currentTarget;
    startTransition(async () => {
      const result = await terminateEmployee(orgId, slug, id, form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(chosen ? `${chosen.name} recorded as left.` : "Recorded.");
      target.reset();
      setFilter("");
      router.refresh();
    });
  }

  if (!open) {
    return (
      <div className="print:hidden flex flex-wrap items-center gap-3 bg-white border border-[var(--brand-line)] rounded-2xl px-5 py-4">
        <UserMinus size={16} className="text-[var(--brand-red)]" />
        <p className="text-sm text-[var(--brand-slate)] flex-1 min-w-[16rem]">
          Someone missing from this month? Record them here and the figures
          above update at once.
        </p>
        {done ? <p className="text-sm text-emerald-700 font-bold">{done}</p> : null}
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={employees.length === 0}
          className="border border-[var(--brand-ink)] hover:bg-[var(--brand-ink)] hover:text-white px-4 py-2 rounded-md text-sm font-bold transition disabled:opacity-50"
        >
          Record a leaver
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="print:hidden bg-white border border-amber-300 rounded-2xl p-5 space-y-3"
    >
      <p className="text-sm font-bold flex items-center gap-2">
        <AlertTriangle size={14} className="text-amber-700" />
        Record that someone has left
      </p>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}

      <div className="grid md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <label className="text-[10px] uppercase tracking-widest font-bold text-[var(--brand-slate)]">
            Find the person
          </label>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Type a surname, site or designation to narrow the list"
            className="mt-1 w-full border border-[var(--brand-line)] rounded-md px-3 py-2 text-sm"
          />
          <select
            name="employee_id"
            required
            defaultValue=""
            size={Math.min(8, Math.max(3, visible.length + 1))}
            className="mt-2 w-full border border-[var(--brand-line)] rounded-md px-2 py-1 text-sm bg-white"
          >
            <option value="" disabled>
              {visible.length === 0 ? "Nobody matches" : `Choose from ${visible.length} people in service`}
            </option>
            {visible.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} · {e.designation} · {e.site}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest font-bold text-[var(--brand-slate)]">
            Last day of service
          </label>
          <input
            type="date"
            name="terminated_at"
            required
            max={maxDate}
            defaultValue={defaultDate}
            className="mt-1 w-full border border-[var(--brand-line)] rounded-md px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest font-bold text-[var(--brand-slate)]">
            Reason
          </label>
          <select
            name="termination_reason"
            required
            defaultValue=""
            className="mt-1 w-full border border-[var(--brand-line)] rounded-md px-3 py-2 text-sm bg-white"
          >
            <option value="" disabled>
              Choose a reason
            </option>
            {!faultOnly ? (
              <optgroup label="No fault">
                {reasons
                  .filter((r) => r.cls === "no_fault")
                  .map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
              </optgroup>
            ) : null}
            <optgroup label="Fault">
              {reasons
                .filter((r) => r.cls === "fault")
                .map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
            </optgroup>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="text-[10px] uppercase tracking-widest font-bold text-[var(--brand-slate)]">
            Note
          </label>
          <input
            type="text"
            name="termination_notes"
            maxLength={500}
            placeholder="Optional"
            className="mt-1 w-full border border-[var(--brand-line)] rounded-md px-3 py-2 text-sm"
          />
        </div>
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
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="text-sm font-bold text-[var(--brand-slate)]"
        >
          Close
        </button>
      </div>
    </form>
  );
}
