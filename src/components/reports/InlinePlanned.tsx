"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSyncedDraft } from "@/components/useSyncedDraft";
import { Check, AlertCircle } from "lucide-react";
import { upsertLabourPlan } from "@/lib/hr/mutations";

/**
 * The planned headcount cell on the labour plan report. Typing a number
 * writes a plan row effective from the first day of the month being viewed,
 * so earlier months keep the figure they were reported against.
 */
export default function InlinePlanned({
  orgId,
  slug,
  site,
  designation,
  planned,
  effectiveFrom,
}: {
  orgId: string;
  slug: string;
  site: string;
  designation: string;
  planned: number;
  effectiveFrom: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useSyncedDraft(String(planned));
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    if (state !== "saved") return;
    const t = setTimeout(() => setState("idle"), 1800);
    return () => clearTimeout(t);
  }, [state]);

  function save(next: string) {
    const n = Number(next.trim());
    if (next.trim() === "" || !Number.isInteger(n) || n < 0) {
      setDraft(String(planned));
      return;
    }
    if (n === planned) return;
    setError(null);
    const fd = new FormData();
    fd.set("site", site);
    fd.set("designation", designation);
    fd.set("planned", String(n));
    fd.set("effective_from", effectiveFrom);
    fd.set("notes", "");
    startTransition(async () => {
      const result = await upsertLabourPlan(orgId, slug, fd);
      if (!result.ok) {
        setState("error");
        setError(result.error);
        setDraft(String(planned));
        return;
      }
      setState("saved");
      router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-1.5 justify-end print:hidden">
      <input
        type="number"
        min={0}
        step={1}
        value={draft}
        disabled={pending}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => save(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setDraft(String(planned));
        }}
        aria-label={`Planned ${designation} at ${site}`}
        className={`w-20 text-right border rounded-md px-2 py-1 text-sm bg-white ${
          state === "error" ? "border-red-500" : "border-[var(--brand-line)]"
        } ${pending ? "opacity-60" : ""}`}
      />
      {state === "saved" ? <Check size={14} className="text-emerald-700" /> : null}
      {state === "error" ? (
        <span className="inline-flex items-center gap-1 text-xs text-red-700" title={error ?? ""}>
          <AlertCircle size={14} />
        </span>
      ) : null}
    </span>
  );
}
