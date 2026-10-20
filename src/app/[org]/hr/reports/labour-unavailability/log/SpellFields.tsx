"use client";

import { useId, useState } from "react";
import type { AbsenceReason } from "@/lib/types/database";
import { ABSENCE_REASONS } from "@/lib/hr/operations";

export const LABEL = "block uppercase tracking-widest text-[10px] font-bold text-[var(--brand-slate)] mb-1";
export const INPUT = "w-full border border-[var(--brand-line)] rounded-md px-3 py-2 text-sm";
export const PRIMARY =
  "bg-[var(--brand-red)] hover:bg-[var(--brand-red-deep)] disabled:opacity-60 text-white px-4 py-2 rounded-md text-sm font-bold transition inline-flex items-center gap-2";
export const SECONDARY =
  "border border-[var(--brand-ink)] disabled:opacity-60 px-4 py-2 rounded-md text-sm font-bold transition";

export function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export interface SpellInitial {
  startsOn: string;
  endsOn: string;
  halfDay: boolean;
  reason: AbsenceReason | "";
  notes: string;
}

/**
 * The date, reason and note fields shared by the record form and the edit
 * form. Field names match what createAbsence and updateAbsence read. A half
 * day disables the last day, and the server then takes the first day as the
 * last day as well.
 */
export default function SpellFields({
  initial,
  field,
}: {
  initial?: SpellInitial;
  field: string | null;
}) {
  const uid = useId();
  const [first, setFirst] = useState(initial?.startsOn ?? todayIso());
  const [last, setLast] = useState(initial?.endsOn ?? initial?.startsOn ?? todayIso());
  const [lastTouched, setLastTouched] = useState(Boolean(initial && initial.endsOn !== initial.startsOn));
  const [halfDay, setHalfDay] = useState(initial?.halfDay ?? false);

  const planned = ABSENCE_REASONS.filter((r) => r.planned);
  const unplanned = ABSENCE_REASONS.filter((r) => !r.planned);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${uid}-first`} className={LABEL}>
            First day
          </label>
          <input
            id={`${uid}-first`}
            name="starts_on"
            type="date"
            required
            value={first}
            onChange={(e) => {
              const v = e.target.value;
              setFirst(v);
              if (!lastTouched || last < v) setLast(v);
            }}
            className={`${INPUT} ${field === "starts_on" ? "border-red-700" : ""}`}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-last`} className={LABEL}>
            Last day
          </label>
          <input
            id={`${uid}-last`}
            name="ends_on"
            type="date"
            required={!halfDay}
            disabled={halfDay}
            min={first}
            value={halfDay ? first : last}
            onChange={(e) => {
              setLast(e.target.value);
              setLastTouched(true);
            }}
            className={`${INPUT} disabled:opacity-50 disabled:bg-[var(--brand-cream)] ${field === "ends_on" ? "border-red-700" : ""}`}
          />
        </div>
      </div>

      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="half_day"
          checked={halfDay}
          onChange={(e) => setHalfDay(e.target.checked)}
          className="h-4 w-4 accent-[var(--brand-red)]"
        />
        Half day
        <span className="text-xs text-[var(--brand-slate)]">(counts 0.5 of the first day)</span>
      </label>

      <div>
        <label htmlFor={`${uid}-reason`} className={LABEL}>
          Reason
        </label>
        <select
          id={`${uid}-reason`}
          name="reason"
          required
          defaultValue={initial?.reason ?? ""}
          className={`${INPUT} bg-white ${field === "reason" ? "border-red-700" : ""}`}
        >
          <option value="" disabled>
            Choose a reason
          </option>
          <optgroup label="Planned">
            {planned.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Unplanned">
            {unplanned.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      <div>
        <label htmlFor={`${uid}-notes`} className={LABEL}>
          Notes
        </label>
        <input
          id={`${uid}-notes`}
          name="notes"
          maxLength={300}
          defaultValue={initial?.notes ?? ""}
          placeholder="Optional. Day count only for sick leave, no medical detail."
          className={`${INPUT} ${field === "notes" ? "border-red-700" : ""}`}
        />
      </div>
    </div>
  );
}
