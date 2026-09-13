"use client";

import { useState, useTransition } from "react";
import {
  Plus,
  Check,
  X,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import type { TrainingTypeWithUsage } from "@/lib/types/database";
import {
  createTrainingType,
  renameTrainingType,
  setTrainingTypeActive,
  deleteTrainingType,
  moveTrainingType,
} from "@/lib/hr/mutations";

export default function TrainingTypesManager({
  orgId,
  slug,
  canWrite,
  types,
}: {
  orgId: string;
  slug: string;
  canWrite: boolean;
  types: TrainingTypeWithUsage[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [showHidden, setShowHidden] = useState(false);

  const visible = showHidden ? types : types.filter((t) => t.active);
  const hiddenCount = types.filter((t) => !t.active).length;

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "Something went wrong.");
    });
  }

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setError(null);
    startTransition(async () => {
      const result = await createTrainingType(orgId, slug, name);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNewName("");
    });
  }

  function onRename(id: string) {
    const name = editingName.trim();
    if (!name) return;
    setError(null);
    startTransition(async () => {
      const result = await renameTrainingType(orgId, slug, id, name);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditingId(null);
    });
  }

  function onDelete(t: TrainingTypeWithUsage) {
    if (!confirm(`Delete "${t.name}"? This cannot be undone.`)) return;
    run(() => deleteTrainingType(orgId, slug, t.id));
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      {canWrite ? (
        <form onSubmit={onAdd} className="flex flex-wrap gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Add a training type, for example Rigging Level 2"
            maxLength={120}
            className="flex-1 min-w-[240px] border border-[var(--brand-line)] rounded-md p-3 text-sm focus:outline-none focus:border-[var(--brand-red)]"
          />
          <button
            type="submit"
            disabled={pending || newName.trim().length < 2}
            className="inline-flex items-center gap-2 bg-[var(--brand-red)] hover:bg-[var(--brand-red-deep)] disabled:opacity-50 text-white px-4 py-2.5 rounded-md font-bold text-sm transition"
          >
            <Plus size={14} />
            Add
          </button>
        </form>
      ) : null}

      <div className="border border-[var(--brand-line)] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--brand-cream)] text-left">
            <tr>
              <Th>Training type</Th>
              <Th>In use</Th>
              <Th>State</Th>
              <Th>&nbsp;</Th>
            </tr>
          </thead>
          <tbody>
            {visible.map((t, index) => (
              <tr
                key={t.id}
                className={`border-t border-[var(--brand-line)] ${
                  t.active ? "" : "bg-[var(--brand-cream)]/60"
                }`}
              >
                <td className="px-4 py-2.5">
                  {editingId === t.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        maxLength={120}
                        autoFocus
                        className="flex-1 border border-[var(--brand-line)] rounded-md p-2 text-sm focus:outline-none focus:border-[var(--brand-red)]"
                      />
                      <button
                        onClick={() => onRename(t.id)}
                        disabled={pending}
                        className="text-emerald-700 hover:text-emerald-900"
                        aria-label="Save name"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-[var(--brand-slate)] hover:text-[var(--brand-ink)]"
                        aria-label="Cancel rename"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`font-bold ${
                        t.active
                          ? "text-[var(--brand-ink)]"
                          : "text-[var(--brand-slate)] line-through"
                      }`}
                    >
                      {t.name}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-[var(--brand-slate)]">
                  {t.certification_count}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full border ${
                      t.active
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-slate-100 border-slate-200 text-slate-600"
                    }`}
                  >
                    {t.active ? "Active" : "Hidden"}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  {canWrite ? (
                    <div className="flex items-center justify-end gap-1">
                      <IconBtn
                        label="Move up"
                        disabled={pending || index === 0}
                        onClick={() =>
                          run(() => moveTrainingType(orgId, slug, t.id, "up"))
                        }
                      >
                        <ChevronUp size={14} />
                      </IconBtn>
                      <IconBtn
                        label="Move down"
                        disabled={pending || index === visible.length - 1}
                        onClick={() =>
                          run(() => moveTrainingType(orgId, slug, t.id, "down"))
                        }
                      >
                        <ChevronDown size={14} />
                      </IconBtn>
                      <IconBtn
                        label="Rename"
                        disabled={pending}
                        onClick={() => {
                          setEditingId(t.id);
                          setEditingName(t.name);
                        }}
                      >
                        <Pencil size={14} />
                      </IconBtn>
                      <IconBtn
                        label={t.active ? "Hide" : "Restore"}
                        disabled={pending}
                        onClick={() =>
                          run(() =>
                            setTrainingTypeActive(orgId, slug, t.id, !t.active),
                          )
                        }
                      >
                        {t.active ? <EyeOff size={14} /> : <Eye size={14} />}
                      </IconBtn>
                      <IconBtn
                        label={
                          t.certification_count > 0
                            ? "In use, hide it instead"
                            : "Delete"
                        }
                        disabled={pending || t.certification_count > 0}
                        danger
                        onClick={() => onDelete(t)}
                      >
                        <Trash2 size={14} />
                      </IconBtn>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--brand-slate)]">
        <span>
          {types.filter((t) => t.active).length} active
          {hiddenCount > 0 ? `, ${hiddenCount} hidden` : ""}
        </span>
        {hiddenCount > 0 ? (
          <button
            onClick={() => setShowHidden((v) => !v)}
            className="font-bold text-[var(--brand-red)] hover:underline"
          >
            {showHidden ? "Hide the hidden ones" : "Show hidden types"}
          </button>
        ) : null}
      </div>

      <p className="text-xs text-[var(--brand-slate)] border-t border-[var(--brand-line)] pt-3">
        A type that is in use cannot be deleted, only hidden. Hiding removes it
        from the pickers and from new safety file packs, but certifications
        already filed under it stay on the register. Renaming applies to every
        record already filed under that name, including packs you have already
        submitted.
      </p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 font-bold uppercase tracking-widest text-[10px] text-[var(--brand-slate)]">
      {children}
    </th>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`p-1.5 rounded border border-transparent transition disabled:opacity-30 ${
        danger
          ? "text-red-600 hover:bg-red-50 hover:border-red-200"
          : "text-[var(--brand-slate)] hover:text-[var(--brand-ink)] hover:bg-[var(--brand-cream)]"
      }`}
    >
      {children}
    </button>
  );
}
