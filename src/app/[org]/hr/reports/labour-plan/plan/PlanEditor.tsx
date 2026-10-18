"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import type { LabourPlan } from "@/lib/types/database";
import { deleteLabourPlan, upsertLabourPlan } from "@/lib/hr/mutations";
import { siteOf } from "@/lib/hr/operations";

const LABEL = "block uppercase tracking-widest text-[10px] font-bold text-[var(--brand-slate)] mb-1";
const INPUT = "w-full border border-[var(--brand-line)] rounded-md px-3 py-2 text-sm";
const PRIMARY =
  "bg-[var(--brand-red)] hover:bg-[var(--brand-red-deep)] disabled:opacity-60 text-white px-4 py-2 rounded-md text-sm font-bold transition inline-flex items-center gap-2";
const SECONDARY =
  "border border-[var(--brand-ink)] disabled:opacity-60 px-4 py-2 rounded-md text-sm font-bold transition";

function firstOfThisMonth(): string {
  const now = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
  return `${now}-01`;
}

interface SiteGroup {
  site: string;
  rows: LabourPlan[];
}

function groupBySite(plans: LabourPlan[]): SiteGroup[] {
  const map = new Map<string, LabourPlan[]>();
  for (const p of plans) {
    const s = siteOf(p.site);
    const list = map.get(s) ?? [];
    list.push(p);
    map.set(s, list);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([site, rows]) => ({
      site,
      rows: [...rows].sort(
        (a, b) =>
          b.effective_from.localeCompare(a.effective_from) ||
          a.designation.localeCompare(b.designation),
      ),
    }));
}

export default function PlanEditor({
  orgId,
  slug,
  plans,
  siteOptions,
  designationOptions,
}: {
  orgId: string;
  slug: string;
  plans: LabourPlan[];
  siteOptions: string[];
  designationOptions: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [field, setField] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const groups = groupBySite(plans);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setField(null);
    setSaved(false);
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await upsertLabourPlan(orgId, slug, form);
      if (!result.ok) {
        setError(result.error);
        setField(result.field ?? null);
        return;
      }
      formRef.current?.reset();
      setSaved(true);
      router.refresh();
    });
  }

  function onRemove(id: string) {
    setRowError(null);
    startTransition(async () => {
      const result = await deleteLabourPlan(orgId, slug, id);
      if (!result.ok) {
        setRowError(result.error);
        return;
      }
      setConfirmId(null);
      router.refresh();
    });
  }

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
      <section className="border border-[var(--brand-line)] rounded-2xl bg-white p-6">
        <h2 className="text-lg font-black">Plan rows</h2>
        <p className="text-sm text-[var(--brand-slate)] mt-1">
          Every row ever captured, newest first within each site. The row with the
          latest effective date on or before the month being reported is the one that
          counts.
        </p>
        {rowError ? <p className="mt-3 text-sm text-red-700">{rowError}</p> : null}

        {groups.length === 0 ? (
          <div className="mt-4 bg-[var(--brand-cream)] border border-[var(--brand-line)] rounded-xl p-4 text-sm text-[var(--brand-slate)]">
            No plan rows yet. Add the first position on the right, one row per site and
            designation.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--brand-cream)]">
                <tr>
                  <th className="px-3 py-2 text-left font-bold uppercase tracking-widest text-[10px] text-[var(--brand-slate)]">Site</th>
                  <th className="px-3 py-2 text-left font-bold uppercase tracking-widest text-[10px] text-[var(--brand-slate)]">Designation</th>
                  <th className="px-3 py-2 text-right font-bold uppercase tracking-widest text-[10px] text-[var(--brand-slate)]">Planned</th>
                  <th className="px-3 py-2 text-left font-bold uppercase tracking-widest text-[10px] text-[var(--brand-slate)]">Effective from</th>
                  <th className="px-3 py-2 text-left font-bold uppercase tracking-widest text-[10px] text-[var(--brand-slate)]">Notes</th>
                  <th className="px-3 py-2 text-right font-bold uppercase tracking-widest text-[10px] text-[var(--brand-slate)]">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--brand-line)]">
                {groups.map((g) => (
                  <GroupRows
                    key={g.site}
                    group={g}
                    confirmId={confirmId}
                    pending={pending}
                    onAsk={(id) => {
                      setRowError(null);
                      setConfirmId(id);
                    }}
                    onCancel={() => setConfirmId(null)}
                    onRemove={onRemove}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <form
        ref={formRef}
        onSubmit={onSubmit}
        className="border border-[var(--brand-line)] rounded-2xl bg-white p-6 space-y-4"
      >
        <div>
          <h2 className="text-lg font-black">Add or update a position</h2>
          <p className="text-sm text-[var(--brand-slate)] mt-1">
            Saving the same site, designation and effective date again replaces the
            number. A later effective date adds a new row that takes over from that date.
          </p>
        </div>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {saved && !error ? <p className="text-sm text-emerald-700 font-bold">Saved.</p> : null}

        <div>
          <label htmlFor="plan-site" className={LABEL}>
            Site
          </label>
          <input
            id="plan-site"
            name="site"
            list="plan-site-options"
            required
            maxLength={120}
            placeholder="Shaft A"
            className={`${INPUT} ${field === "site" ? "border-red-700" : ""}`}
          />
          <datalist id="plan-site-options">
            {siteOptions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>

        <div>
          <label htmlFor="plan-designation" className={LABEL}>
            Designation
          </label>
          <input
            id="plan-designation"
            name="designation"
            list="plan-designation-options"
            required
            maxLength={120}
            placeholder="Rock drill operator"
            className={`${INPUT} ${field === "designation" ? "border-red-700" : ""}`}
          />
          <datalist id="plan-designation-options">
            {designationOptions.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="plan-planned" className={LABEL}>
              Planned positions
            </label>
            <input
              id="plan-planned"
              name="planned"
              type="number"
              min={0}
              max={99999}
              step={1}
              required
              defaultValue={0}
              className={`${INPUT} ${field === "planned" ? "border-red-700" : ""}`}
            />
          </div>
          <div>
            <label htmlFor="plan-effective" className={LABEL}>
              Effective from
            </label>
            <input
              id="plan-effective"
              name="effective_from"
              type="date"
              required
              defaultValue={firstOfThisMonth()}
              className={`${INPUT} ${field === "effective_from" ? "border-red-700" : ""}`}
            />
          </div>
        </div>

        <div>
          <label htmlFor="plan-notes" className={LABEL}>
            Notes
          </label>
          <input
            id="plan-notes"
            name="notes"
            maxLength={300}
            placeholder="Optional, for example the client instruction number"
            className={INPUT}
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button type="submit" disabled={pending} className={PRIMARY}>
            <Plus size={14} />
            {pending ? "Saving..." : "Save position"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              formRef.current?.reset();
              setError(null);
              setField(null);
              setSaved(false);
            }}
            className={SECONDARY}
          >
            Clear
          </button>
        </div>
      </form>
    </div>
  );
}

function GroupRows({
  group,
  confirmId,
  pending,
  onAsk,
  onCancel,
  onRemove,
}: {
  group: SiteGroup;
  confirmId: string | null;
  pending: boolean;
  onAsk: (id: string) => void;
  onCancel: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={6}
          className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-widest font-bold text-[var(--brand-red)]"
        >
          {group.site}
        </td>
      </tr>
      {group.rows.map((p) => (
        <tr key={p.id}>
          <td className="px-3 py-2 whitespace-nowrap">{siteOf(p.site)}</td>
          <td className="px-3 py-2 whitespace-nowrap font-bold">{p.designation}</td>
          <td className="px-3 py-2 whitespace-nowrap text-right">{p.planned}</td>
          <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">{p.effective_from}</td>
          <td className="px-3 py-2 text-xs text-[var(--brand-slate)]">{p.notes ?? ""}</td>
          <td className="px-3 py-2 whitespace-nowrap text-right">
            {confirmId === p.id ? (
              <span className="inline-flex items-center gap-2">
                <span className="text-xs text-[var(--brand-slate)]">Remove this row?</span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onRemove(p.id)}
                  className="text-xs font-bold text-red-700 hover:underline disabled:opacity-50"
                >
                  {pending ? "Removing..." : "Yes, remove"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={onCancel}
                  className="text-xs font-bold text-[var(--brand-slate)] hover:underline disabled:opacity-50"
                >
                  Keep
                </button>
              </span>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => onAsk(p.id)}
                className="inline-flex items-center gap-1 text-xs font-bold text-[var(--brand-slate)] hover:text-red-700 disabled:opacity-50"
              >
                <Trash2 size={12} />
                Remove
              </button>
            )}
          </td>
        </tr>
      ))}
    </>
  );
}
