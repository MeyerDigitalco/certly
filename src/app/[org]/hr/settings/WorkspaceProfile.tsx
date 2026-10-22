"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pickaxe, Building2, Check } from "lucide-react";
import { updateReportingSettings } from "@/lib/hr/mutations";
import { SECTORS } from "@/lib/sector";
import { SETAS } from "@/lib/hr/operations";
import type { Sector } from "@/lib/types/database";

/**
 * The sector and the reporting identifiers, editable by an admin. Changing
 * the sector changes defaults and emphasis only; nothing already on the
 * register moves or disappears.
 */
export default function WorkspaceProfile({
  orgId,
  slug,
  sector,
  seta,
  sdlNumber,
  eeReference,
  defaultRetirementAge,
  canWrite,
}: {
  orgId: string;
  slug: string;
  sector: Sector;
  seta: string | null;
  sdlNumber: string | null;
  eeReference: string | null;
  defaultRetirementAge: number;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [chosen, setChosen] = useState<Sector>(sector);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const fd = new FormData(e.currentTarget);
    fd.set("sector", chosen);
    startTransition(async () => {
      const result = await updateReportingSettings(orgId, slug, fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--brand-slate)]">
          Sector
        </p>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SECTORS.map((s) => {
            const Icon = s.value === "mining" ? Pickaxe : Building2;
            const active = chosen === s.value;
            return (
              <button
                key={s.value}
                type="button"
                disabled={!canWrite}
                onClick={() => setChosen(s.value)}
                aria-pressed={active}
                className={`relative text-left border rounded-xl p-4 transition disabled:cursor-default ${
                  active
                    ? "border-[var(--brand-ink)] bg-[var(--brand-cream)]"
                    : "border-[var(--brand-line)] hover:border-[var(--brand-ink)]"
                }`}
              >
                {active ? (
                  <span className="absolute top-3 right-3 inline-flex items-center justify-center w-5 h-5 rounded-full bg-[var(--brand-red)] text-white">
                    <Check size={12} />
                  </span>
                ) : null}
                <Icon size={18} className="text-[var(--brand-red)]" />
                <p className="mt-2 font-black">{s.label}</p>
                <p className="mt-1 text-xs text-[var(--brand-slate)]">{s.blurb}</p>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-[var(--brand-slate)]">
          Sets which reports are pinned on the overview and which training types
          are suggested. Nothing already on the register changes.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 pt-3 border-t border-[var(--brand-line)]">
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest font-bold text-[var(--brand-slate)]">
            SETA
          </span>
          <select
            name="seta"
            defaultValue={seta ?? ""}
            disabled={!canWrite}
            className="mt-1 w-full border border-[var(--brand-line)] rounded-md px-3 py-2 text-sm bg-white"
          >
            <option value="">Not set</option>
            {SETAS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest font-bold text-[var(--brand-slate)]">
            SDL number
          </span>
          <input
            type="text"
            name="sdl_number"
            defaultValue={sdlNumber ?? ""}
            disabled={!canWrite}
            maxLength={20}
            placeholder="L..."
            className="mt-1 w-full border border-[var(--brand-line)] rounded-md px-3 py-2 text-sm font-mono"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest font-bold text-[var(--brand-slate)]">
            EE reference number
          </span>
          <input
            type="text"
            name="ee_reference"
            defaultValue={eeReference ?? ""}
            disabled={!canWrite}
            maxLength={40}
            className="mt-1 w-full border border-[var(--brand-line)] rounded-md px-3 py-2 text-sm font-mono"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest font-bold text-[var(--brand-slate)]">
            Default retirement age
          </span>
          <input
            type="number"
            name="default_retirement_age"
            defaultValue={defaultRetirementAge}
            min={50}
            max={75}
            disabled={!canWrite}
            className="mt-1 w-full border border-[var(--brand-line)] rounded-md px-3 py-2 text-sm"
          />
        </label>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {canWrite ? (
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="bg-[var(--brand-ink)] hover:bg-[var(--brand-charcoal)] disabled:opacity-60 text-white px-4 py-2 rounded-md text-sm font-bold transition"
          >
            {pending ? "Saving..." : "Save workspace profile"}
          </button>
          {saved ? <span className="text-sm text-emerald-700 font-bold">Saved.</span> : null}
        </div>
      ) : null}
    </form>
  );
}
