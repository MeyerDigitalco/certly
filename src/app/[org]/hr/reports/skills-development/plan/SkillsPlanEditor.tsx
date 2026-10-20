"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import type { TrainingPlan, TrainingType } from "@/lib/types/database";
import { deleteTrainingPlan, upsertTrainingPlan } from "@/lib/hr/mutations";
import { siteOf, trainingCategoryLabel } from "@/lib/hr/operations";
import { formatRands } from "@/lib/reports/skills-development";

const LABEL = "block uppercase tracking-widest text-[10px] font-bold text-[var(--brand-slate)] mb-1";
const INPUT = "w-full border border-[var(--brand-line)] rounded-md px-3 py-2 text-sm bg-white";
const PRIMARY =
  "bg-[var(--brand-red)] hover:bg-[var(--brand-red-deep)] disabled:opacity-60 text-white px-4 py-2 rounded-md text-sm font-bold transition inline-flex items-center gap-2";
const SECONDARY =
  "border border-[var(--brand-ink)] disabled:opacity-60 px-4 py-2 rounded-md text-sm font-bold transition";
const TH = "px-3 py-2 font-bold uppercase tracking-widest text-[10px] text-[var(--brand-slate)]";

interface TypeGroup {
  type: TrainingType;
  rows: TrainingPlan[];
  people: number;
  cost: number;
}

function groupByType(plans: TrainingPlan[], types: TrainingType[]): TypeGroup[] {
  const typeById = new Map(types.map((t) => [t.id, t]));
  const map = new Map<string, TrainingPlan[]>();
  for (const p of plans) {
    if (!typeById.has(p.training_type_id)) continue;
    const list = map.get(p.training_type_id) ?? [];
    list.push(p);
    map.set(p.training_type_id, list);
  }
  return [...map.entries()]
    .map(([id, rows]) => {
      const type = typeById.get(id)!;
      const sorted = [...rows].sort((a, b) => siteOf(a.site).localeCompare(siteOf(b.site)));
      return {
        type,
        rows: sorted,
        people: sorted.reduce((a, r) => a + r.planned_count, 0),
        cost: sorted.reduce((a, r) => a + rowCost(r, type), 0),
      };
    })
    .sort((a, b) => a.type.name.localeCompare(b.type.name));
}

function rowCost(p: TrainingPlan, t: TrainingType): number {
  if (p.planned_cost_cents !== null) return p.planned_cost_cents / 100;
  if (t.cost_cents !== null) return (p.planned_count * t.cost_cents) / 100;
  return 0;
}

export default function SkillsPlanEditor({
  orgId,
  slug,
  year,
  yearLabel,
  plans,
  types,
  siteOptions,
}: {
  orgId: string;
  slug: string;
  year: number;
  yearLabel: string;
  plans: TrainingPlan[];
  types: TrainingType[];
  siteOptions: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [field, setField] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const groups = groupByType(plans, types);
  const activeTypes = types.filter((t) => t.active);
  const totalPeople = groups.reduce((a, g) => a + g.people, 0);
  const totalCost = groups.reduce((a, g) => a + g.cost, 0);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setField(null);
    setSaved(false);
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await upsertTrainingPlan(orgId, slug, form);
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
      const result = await deleteTrainingPlan(orgId, slug, id);
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
        <h2 className="text-lg font-black">Plan rows for {year}</h2>
        <p className="text-sm text-[var(--brand-slate)] mt-1">
          {yearLabel}. Grouped by course. Cost is the row&apos;s own figure, or the course cost
          times the planned people when the row has none.
        </p>
        {rowError ? <p className="mt-3 text-sm text-red-700">{rowError}</p> : null}

        {groups.length === 0 ? (
          <div className="mt-4 bg-[var(--brand-cream)] border border-[var(--brand-line)] rounded-xl p-4 text-sm text-[var(--brand-slate)]">
            No plan rows for SETA year {year} yet. Add the first course on the right, one row
            per course and site.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--brand-cream)]">
                <tr>
                  <th className={`${TH} text-left`}>Site</th>
                  <th className={`${TH} text-right`}>Planned people</th>
                  <th className={`${TH} text-right`}>Planned cost</th>
                  <th className={`${TH} text-left`}>Notes</th>
                  <th className={`${TH} text-right`}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--brand-line)]">
                {groups.map((g) => (
                  <GroupRows
                    key={g.type.id}
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
                <tr className="font-bold bg-[var(--brand-cream)]">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right">{totalPeople}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{formatRands(totalCost)}</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                </tr>
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
          <h2 className="text-lg font-black">Add or update a row</h2>
          <p className="text-sm text-[var(--brand-slate)] mt-1">
            One row per course per site for SETA year {year}. Saving the same course and
            site again replaces the number. Leave site blank for training not tied to a site.
          </p>
        </div>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {saved && !error ? <p className="text-sm text-emerald-700 font-bold">Saved.</p> : null}

        <input type="hidden" name="seta_year" value={String(year)} />

        <div>
          <label htmlFor="wsp-type" className={LABEL}>
            Course
          </label>
          <select
            id="wsp-type"
            name="training_type_id"
            required
            defaultValue=""
            className={`${INPUT} ${field === "training_type_id" ? "border-red-700" : ""}`}
          >
            <option value="" disabled>
              Choose a course
            </option>
            {activeTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({trainingCategoryLabel(t.category)})
              </option>
            ))}
          </select>
          {activeTypes.length === 0 ? (
            <p className="mt-1 text-xs text-amber-700">No active courses. Add training types first.</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="wsp-site" className={LABEL}>
            Site
          </label>
          <input
            id="wsp-site"
            name="site"
            list="wsp-site-options"
            maxLength={120}
            placeholder="Shaft A"
            className={`${INPUT} ${field === "site" ? "border-red-700" : ""}`}
          />
          <datalist id="wsp-site-options">
            {siteOptions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="wsp-count" className={LABEL}>
              Planned people
            </label>
            <input
              id="wsp-count"
              name="planned_count"
              type="number"
              min={0}
              max={99999}
              step={1}
              required
              defaultValue={0}
              className={`${INPUT} ${field === "planned_count" ? "border-red-700" : ""}`}
            />
          </div>
          <div>
            <label htmlFor="wsp-cost" className={LABEL}>
              Planned cost (R)
            </label>
            <input
              id="wsp-cost"
              name="planned_cost"
              type="number"
              min={0}
              step={0.01}
              placeholder="Course cost if blank"
              className={`${INPUT} ${field === "planned_cost" ? "border-red-700" : ""}`}
            />
          </div>
        </div>

        <div>
          <label htmlFor="wsp-notes" className={LABEL}>
            Notes
          </label>
          <input
            id="wsp-notes"
            name="notes"
            maxLength={300}
            placeholder="Optional, for example the provider quote number"
            className={INPUT}
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button type="submit" disabled={pending || activeTypes.length === 0} className={PRIMARY}>
            <Plus size={14} />
            {pending ? "Saving..." : "Save row"}
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
  group: TypeGroup;
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
          colSpan={5}
          className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-widest font-bold text-[var(--brand-red)]"
        >
          {group.type.name}
          <span className="ml-2 text-[var(--brand-slate)] normal-case tracking-normal font-normal">
            {trainingCategoryLabel(group.type.category)}
            {group.rows.length > 1 ? ` · ${group.people} people · ${formatRands(group.cost)}` : ""}
          </span>
        </td>
      </tr>
      {group.rows.map((p) => (
        <tr key={p.id}>
          <td className="px-3 py-2 whitespace-nowrap">{siteOf(p.site)}</td>
          <td className="px-3 py-2 whitespace-nowrap text-right">{p.planned_count}</td>
          <td className="px-3 py-2 whitespace-nowrap text-right font-mono text-xs">
            {formatRands(rowCost(p, group.type))}
            {p.planned_cost_cents === null ? (
              <span className="ml-1 font-sans text-[var(--brand-slate)]">
                {group.type.cost_cents === null ? "(no cost)" : "(course cost)"}
              </span>
            ) : null}
          </td>
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
