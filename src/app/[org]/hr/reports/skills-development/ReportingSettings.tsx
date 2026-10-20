"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { updateReportingSettings } from "@/lib/hr/mutations";
import { SETAS } from "@/lib/hr/operations";

const LABEL = "block uppercase tracking-widest text-[10px] font-bold text-[var(--brand-slate)] mb-1";
const INPUT = "w-full border border-[var(--brand-line)] rounded-md px-3 py-2 text-sm bg-white";
const PRIMARY =
  "bg-[var(--brand-red)] hover:bg-[var(--brand-red-deep)] disabled:opacity-60 text-white px-4 py-2 rounded-md text-sm font-bold transition inline-flex items-center gap-2";

export default function ReportingSettings({
  orgId,
  slug,
  seta,
  sdlNumber,
  eeReference,
  defaultRetirementAge,
}: {
  orgId: string;
  slug: string;
  seta: string | null;
  sdlNumber: string | null;
  eeReference: string | null;
  defaultRetirementAge: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [field, setField] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setField(null);
    setSaved(false);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateReportingSettings(orgId, slug, fd);
      if (!result.ok) {
        setError(result.error);
        setField(result.field ?? null);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  const cls = (name: string) => `${INPUT} ${field === name ? "border-red-700" : ""}`;

  return (
    <form
      onSubmit={onSubmit}
      className="border border-[var(--brand-line)] rounded-xl bg-white p-4 space-y-3 print:hidden"
    >
      <div>
        <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--brand-slate)]">
          Reporting settings
        </p>
        <p className="text-xs text-[var(--brand-slate)] mt-1">
          These print on the workbooks the organisation submits. Admins only.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label htmlFor="rs-seta" className={LABEL}>
            SETA
          </label>
          <select id="rs-seta" name="seta" defaultValue={seta ?? ""} className={cls("seta")}>
            <option value="">Not set</option>
            {SETAS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="rs-sdl" className={LABEL}>
            SDL number
          </label>
          <input
            id="rs-sdl"
            name="sdl_number"
            defaultValue={sdlNumber ?? ""}
            maxLength={20}
            placeholder="L123456789"
            className={cls("sdl_number")}
          />
        </div>
        <div>
          <label htmlFor="rs-ee" className={LABEL}>
            EE reference
          </label>
          <input
            id="rs-ee"
            name="ee_reference"
            defaultValue={eeReference ?? ""}
            maxLength={40}
            className={cls("ee_reference")}
          />
        </div>
        <div>
          <label htmlFor="rs-age" className={LABEL}>
            Default retirement age
          </label>
          <input
            id="rs-age"
            name="default_retirement_age"
            type="number"
            min={50}
            max={75}
            step={1}
            defaultValue={defaultRetirementAge}
            className={cls("default_retirement_age")}
          />
        </div>
      </div>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={PRIMARY}>
          {pending ? "Saving..." : "Save settings"}
        </button>
        {saved && !error ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-bold">
            <Check size={14} /> Saved
          </span>
        ) : null}
      </div>
    </form>
  );
}
