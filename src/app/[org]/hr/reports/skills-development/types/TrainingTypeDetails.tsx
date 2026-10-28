"use client";

import { useEffect, useState, useTransition } from "react";
import { useSyncedDraft } from "@/components/useSyncedDraft";
import { useRouter } from "next/navigation";
import { AlertCircle, Check } from "lucide-react";
import type { TrainingType } from "@/lib/types/database";
import { updateTrainingTypeDetails } from "@/lib/hr/mutations";
import { TRAINING_CATEGORIES } from "@/lib/hr/operations";

const TH = "px-3 py-2 font-bold uppercase tracking-widest text-[10px] text-[var(--brand-slate)] text-left";
const NQF_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

type DetailField =
  | "category"
  | "hours"
  | "cost"
  | "provider"
  | "nqf_level"
  | "accredited"
  | "counts_for_atr";

export default function TrainingTypeDetails({
  orgId,
  slug,
  types,
}: {
  orgId: string;
  slug: string;
  types: TrainingType[];
}) {
  if (types.length === 0) {
    return (
      <div className="bg-[var(--brand-cream)] border border-[var(--brand-line)] rounded-xl p-4 text-sm text-[var(--brand-slate)]">
        No courses yet. Add training types under Training before filling in their details here.
      </div>
    );
  }

  return (
    <section className="border border-[var(--brand-line)] rounded-2xl bg-white p-6">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--brand-cream)]">
            <tr>
              <th className={TH}>Course</th>
              <th className={TH}>Category</th>
              <th className={TH}>Hours</th>
              <th className={TH}>Cost per person (R)</th>
              <th className={TH}>Provider</th>
              <th className={TH}>NQF</th>
              <th className={TH}>Accredited</th>
              <th className={TH}>Counts for ATR</th>
              <th className={TH}>
                <span className="sr-only">Status</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--brand-line)]">
            {types.map((t) => (
              <TypeRow key={t.id} orgId={orgId} slug={slug} type={t} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-[var(--brand-slate)]">
        Cost is per person in rands and is stored to the cent. Hours are per person for one
        delivery of the course. Inactive courses are listed last and keep their history.
      </p>
    </section>
  );
}

function TypeRow({ orgId, slug, type }: { orgId: string; slug: string; type: TrainingType }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state !== "saved") return;
    const t = setTimeout(() => setState("idle"), 1800);
    return () => clearTimeout(t);
  }, [state]);

  function save(name: DetailField, value: string): Promise<boolean> {
    setError(null);
    const fd = new FormData();
    fd.set(name, value);
    return new Promise((resolve) => {
      startTransition(async () => {
        const result = await updateTrainingTypeDetails(orgId, slug, type.id, fd);
        if (!result.ok) {
          setState("error");
          setError(result.error);
          resolve(false);
          return;
        }
        setState("saved");
        router.refresh();
        resolve(true);
      });
    });
  }

  const cell = "px-3 py-2 whitespace-nowrap align-top";
  const dim = type.active ? "" : "opacity-60";

  return (
    <tr className={dim}>
      <td className={`${cell} font-bold`}>
        {type.name}
        {!type.active ? (
          <span className="ml-2 text-[10px] uppercase tracking-widest text-[var(--brand-slate)]">
            Inactive
          </span>
        ) : null}
      </td>
      <td className={cell}>
        <SelectCell
          label="category"
          value={type.category}
          options={TRAINING_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
          pending={pending}
          onSave={(v) => save("category", v)}
        />
      </td>
      <td className={cell}>
        <InputCell
          label="hours"
          kind="number"
          value={type.hours === null ? "" : String(type.hours)}
          min={0}
          max={9999}
          step={0.5}
          width="w-20"
          pending={pending}
          onSave={(v) => save("hours", v)}
        />
      </td>
      <td className={cell}>
        <InputCell
          label="cost"
          kind="number"
          value={type.cost_cents === null ? "" : (type.cost_cents / 100).toFixed(2)}
          min={0}
          step={0.01}
          width="w-28"
          pending={pending}
          onSave={(v) => save("cost", v)}
        />
      </td>
      <td className={cell}>
        <InputCell
          label="provider"
          kind="text"
          value={type.provider ?? ""}
          maxLength={160}
          width="w-44"
          pending={pending}
          onSave={(v) => save("provider", v)}
        />
      </td>
      <td className={cell}>
        <SelectCell
          label="nqf level"
          value={type.nqf_level === null ? "" : String(type.nqf_level)}
          options={NQF_LEVELS.map((n) => ({ value: String(n), label: `NQF ${n}` }))}
          placeholder="None"
          width="w-24"
          pending={pending}
          onSave={(v) => save("nqf_level", v)}
        />
      </td>
      <td className={cell}>
        <CheckCell
          label="accredited"
          checked={type.accredited}
          pending={pending}
          onSave={(v) => save("accredited", v)}
        />
      </td>
      <td className={cell}>
        <CheckCell
          label="counts for ATR"
          checked={type.counts_for_atr}
          pending={pending}
          onSave={(v) => save("counts_for_atr", v)}
        />
      </td>
      <td className={cell}>
        {pending ? <span className="text-xs text-[var(--brand-slate)]">Saving...</span> : null}
        {!pending && state === "saved" ? <Check size={14} className="text-emerald-700" /> : null}
        {!pending && state === "error" ? (
          <span className="inline-flex items-center gap-1 text-xs text-red-700">
            <AlertCircle size={14} />
            {error}
          </span>
        ) : null}
      </td>
    </tr>
  );
}

function inputClass(width: string, pending: boolean): string {
  return `border border-[var(--brand-line)] rounded-md px-2 py-1 text-sm bg-white ${width} ${pending ? "opacity-60" : ""}`;
}

function SelectCell({
  label,
  value,
  options,
  placeholder,
  width = "w-40",
  pending,
  onSave,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  width?: string;
  pending: boolean;
  onSave: (value: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useSyncedDraft(value);

  return (
    <select
      value={draft}
      disabled={pending}
      aria-label={label}
      className={inputClass(width, pending)}
      onChange={async (e) => {
        const next = e.target.value;
        setDraft(next);
        if (next === value) return;
        const ok = await onSave(next);
        if (!ok) setDraft(value);
      }}
    >
      {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function InputCell({
  label,
  kind,
  value,
  min,
  max,
  step,
  maxLength,
  width = "w-36",
  pending,
  onSave,
}: {
  label: string;
  kind: "number" | "text";
  value: string;
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  width?: string;
  pending: boolean;
  onSave: (value: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useSyncedDraft(value);

  async function commit(next: string) {
    if (next.trim() === value.trim()) return;
    const ok = await onSave(next);
    if (!ok) setDraft(value);
  }

  return (
    <input
      type={kind}
      value={draft}
      disabled={pending}
      min={min}
      max={max}
      step={step}
      maxLength={maxLength}
      aria-label={label}
      className={inputClass(width, pending)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setDraft(value);
      }}
    />
  );
}

function CheckCell({
  label,
  checked,
  pending,
  onSave,
}: {
  label: string;
  checked: boolean;
  pending: boolean;
  onSave: (value: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useSyncedDraft(checked);

  return (
    <input
      type="checkbox"
      checked={draft}
      disabled={pending}
      aria-label={label}
      className="h-4 w-4 accent-[var(--brand-red)]"
      onChange={async (e) => {
        const next = e.target.checked;
        setDraft(next);
        const ok = await onSave(next ? "yes" : "no");
        if (!ok) setDraft(checked);
      }}
    />
  );
}
