"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSyncedDraft } from "@/components/useSyncedDraft";
import { Check, AlertCircle } from "lucide-react";
import { updateEmployeeLifecycle } from "@/lib/hr/mutations";

/**
 * One editable cell on a report table. It writes the single field it owns
 * straight to the employee record the moment it changes, then refreshes the
 * page so every total above it recomputes. The same row feeds the employee
 * page, so an edit here shows there and an edit there shows here.
 */

export interface InlineOption {
  value: string;
  label: string;
  group?: string;
}

export interface InlineFieldProps {
  orgId: string;
  slug: string;
  employeeId: string;
  name:
    | "date_of_birth"
    | "engaged_at"
    | "retirement_age"
    | "approved_retirement_date"
    | "terminated_at"
    | "termination_reason"
    | "site"
    | "designation"
    | "gender"
    | "population_group"
    | "disability"
    | "occupational_level"
    | "ofo_code"
    | "ee_declared_at";
  value: string | number | null;
  kind: "date" | "select" | "number" | "text";
  options?: InlineOption[];
  placeholder?: string;
  min?: number | string;
  max?: number | string;
  list?: string;
  width?: string;
}

export default function InlineField({
  orgId,
  slug,
  employeeId,
  name,
  value,
  kind,
  options = [],
  placeholder,
  min,
  max,
  list,
  width = "w-36",
}: InlineFieldProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useSyncedDraft(value == null ? "" : String(value));
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    if (state !== "saved") return;
    const t = setTimeout(() => setState("idle"), 1800);
    return () => clearTimeout(t);
  }, [state]);

  function save(next: string) {
    const current = value == null ? "" : String(value);
    if (next === current) return;
    setError(null);
    const fd = new FormData();
    fd.set(name, next);
    startTransition(async () => {
      const result = await updateEmployeeLifecycle(orgId, slug, employeeId, fd);
      if (!result.ok) {
        setState("error");
        setError(result.error);
        setDraft(current);
        return;
      }
      setState("saved");
      router.refresh();
    });
  }

  const base = `border rounded-md px-2 py-1 text-sm bg-white ${width} ${
    state === "error" ? "border-red-500" : "border-[var(--brand-line)]"
  } ${pending ? "opacity-60" : ""}`;

  const groups = new Map<string, InlineOption[]>();
  for (const o of options) {
    const g = o.group ?? "";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(o);
  }

  return (
    <span className="inline-flex items-center gap-1.5 print:hidden">
      {kind === "select" ? (
        <select
          value={draft}
          disabled={pending}
          onChange={(e) => {
            setDraft(e.target.value);
            save(e.target.value);
          }}
          className={base}
          aria-label={name.replace(/_/g, " ")}
        >
          {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
          {[...groups.entries()].map(([g, items]) =>
            g ? (
              <optgroup key={g} label={g}>
                {items.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ) : (
              items.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))
            ),
          )}
        </select>
      ) : (
        <input
          type={kind}
          value={draft}
          disabled={pending}
          min={min}
          max={max}
          list={list}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => save(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") setDraft(value == null ? "" : String(value));
          }}
          className={base}
          aria-label={name.replace(/_/g, " ")}
        />
      )}
      {state === "saved" ? <Check size={14} className="text-emerald-700" /> : null}
      {state === "error" ? (
        <span className="inline-flex items-center gap-1 text-xs text-red-700" title={error ?? ""}>
          <AlertCircle size={14} />
          {error}
        </span>
      ) : null}
    </span>
  );
}
