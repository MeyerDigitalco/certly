"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Plus, Save, Trash2 } from "lucide-react";
import type { AbsenceReason } from "@/lib/types/database";
import { createAbsence, deleteAbsence, updateAbsence } from "@/lib/hr/mutations";
import {
  ABSENCE_REASONS,
  absenceReasonLabel,
  monthLabel,
  overlapDays,
  periodFor,
} from "@/lib/hr/operations";
import SpellFields, { INPUT, LABEL, PRIMARY, SECONDARY } from "./SpellFields";

const TH = "px-3 py-2 text-left font-bold uppercase tracking-widest text-[10px] text-[var(--brand-slate)]";
const TD = "px-3 py-2 whitespace-nowrap";

export interface LogPerson {
  id: string;
  name: string;
  site: string;
  designation: string;
}

export interface LogSpell {
  id: string;
  employeeId: string;
  name: string;
  site: string;
  designation: string;
  left: boolean;
  startsOn: string;
  endsOn: string;
  halfDay: boolean;
  reason: AbsenceReason;
  notes: string;
  createdAt: string;
}

const PLANNED = new Set(ABSENCE_REASONS.filter((r) => r.planned).map((r) => r.value));

function spellDays(s: LogSpell): number {
  return overlapDays(s.startsOn, s.endsOn, s.startsOn, s.endsOn, s.halfDay);
}

function formatDays(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function monthKeysOf(s: LogSpell): string[] {
  const out: string[] = [];
  let y = Number(s.startsOn.slice(0, 4));
  let m = Number(s.startsOn.slice(5, 7));
  const endKey = s.endsOn.slice(0, 7);
  for (let i = 0; i < 36; i += 1) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    out.push(key);
    if (key >= endKey) break;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function monthOptionLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${monthLabel(m)} ${y}`;
}

function inMonth(s: LogSpell, key: string): boolean {
  const [y, m] = key.split("-").map(Number);
  const p = periodFor(y, m);
  return s.startsOn <= p.end && s.endsOn >= p.start;
}

function ClassPill({ reason }: { reason: AbsenceReason }) {
  const planned = PLANNED.has(reason);
  return (
    <span
      className={`inline-block border rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
        planned
          ? "bg-[var(--brand-cream)] text-[var(--brand-ink)] border-[var(--brand-line)]"
          : "bg-red-50 text-red-800 border-red-200"
      }`}
    >
      {planned ? "Planned" : "Unplanned"}
    </span>
  );
}

export default function AbsenceLog({
  orgId,
  slug,
  people,
  spells,
  focus,
}: {
  orgId: string;
  slug: string;
  people: LogPerson[];
  spells: LogSpell[];
  focus: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [personQuery, setPersonQuery] = useState("");
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [formKey, setFormKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [field, setField] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const [month, setMonth] = useState("");
  const [reason, setReason] = useState("");
  const [site, setSite] = useState("");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(focus);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const focused = useRef(false);

  useEffect(() => {
    if (!focus || focused.current) return;
    const el = document.getElementById(`spell-${focus}`);
    if (el) {
      focused.current = true;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [focus]);

  const shownPeople = useMemo(() => {
    const q = personQuery.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) => `${p.name} ${p.site} ${p.designation}`.toLowerCase().includes(q));
  }, [people, personQuery]);

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of spells) for (const k of monthKeysOf(s)) set.add(k);
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [spells]);

  const siteOptions = useMemo(
    () => [...new Set(spells.map((s) => s.site))].sort((a, b) => a.localeCompare(b)),
    [spells],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...spells]
      .filter((s) => {
        if (month && !inMonth(s, month)) return false;
        if (reason && s.reason !== reason) return false;
        if (site && s.site !== site) return false;
        if (q) {
          const hay = `${s.name} ${s.designation} ${s.site} ${s.notes} ${absenceReasonLabel(s.reason)}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          b.startsOn.localeCompare(a.startsOn) ||
          b.createdAt.localeCompare(a.createdAt) ||
          a.name.localeCompare(b.name),
      );
  }, [spells, month, reason, site, query]);

  function togglePerson(id: string, on: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function onRecord(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setField(null);
    setSaved(null);
    const form = new FormData(e.currentTarget);
    form.delete("employee_id");
    const ids = [...checked];
    for (const id of ids) form.append("employee_id", id);
    if (ids.length === 0) {
      setError("Choose at least one person.");
      setField("employee_id");
      return;
    }
    startTransition(async () => {
      const result = await createAbsence(orgId, slug, form);
      if (!result.ok) {
        setError(result.error);
        setField(result.field ?? null);
        return;
      }
      setSaved(`Recorded for ${ids.length} ${ids.length === 1 ? "person" : "people"}.`);
      setChecked(new Set());
      setPersonQuery("");
      setFormKey((k) => k + 1);
      router.refresh();
    });
  }

  function onRemove(id: string) {
    setRowError(null);
    startTransition(async () => {
      const result = await deleteAbsence(orgId, slug, id);
      if (!result.ok) {
        setRowError(result.error);
        return;
      }
      setConfirmId(null);
      setExpandedId(null);
      router.refresh();
    });
  }

  const count = checked.size;
  const recordLabel =
    count === 0 ? "Record absence" : count === 1 ? "Record for 1 person" : `Record for ${count} people`;

  return (
    <div className="space-y-6">
      <form
        key={formKey}
        onSubmit={onRecord}
        className="border border-[var(--brand-line)] rounded-2xl bg-white p-6 space-y-4"
      >
        <div>
          <h2 className="text-lg font-black">Record absence</h2>
          <p className="text-sm text-[var(--brand-slate)] mt-1">
            Tick everyone who was off, give the days and the reason, and one spell is
            written for each person. People who have left are not listed.
          </p>
        </div>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {saved && !error ? <p className="text-sm text-emerald-700 font-bold">{saved}</p> : null}

        <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
          <div>
            <div className="flex items-end justify-between gap-3 mb-2">
              <div className="flex-1">
                <label htmlFor="people-filter" className={LABEL}>
                  People
                </label>
                <input
                  id="people-filter"
                  type="search"
                  value={personQuery}
                  onChange={(e) => setPersonQuery(e.target.value)}
                  placeholder="Filter by name, site or designation"
                  className={INPUT}
                />
              </div>
              <div className="flex items-center gap-3 text-xs font-bold whitespace-nowrap pb-2">
                <button
                  type="button"
                  disabled={shownPeople.length === 0}
                  onClick={() =>
                    setChecked((prev) => {
                      const next = new Set(prev);
                      for (const p of shownPeople) next.add(p.id);
                      return next;
                    })
                  }
                  className="text-[var(--brand-red)] hover:underline disabled:opacity-50"
                >
                  Select all shown
                </button>
                <button
                  type="button"
                  disabled={count === 0}
                  onClick={() => setChecked(new Set())}
                  className="text-[var(--brand-slate)] hover:underline disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
            </div>
            {people.length === 0 ? (
              <div className="bg-[var(--brand-cream)] border border-[var(--brand-line)] rounded-xl p-4 text-sm text-[var(--brand-slate)]">
                Nobody is on the register yet. Add employees first and they appear here.
              </div>
            ) : (
              <div
                className={`border rounded-md max-h-72 overflow-y-auto divide-y divide-[var(--brand-line)] ${
                  field === "employee_id" ? "border-red-700" : "border-[var(--brand-line)]"
                }`}
              >
                {shownPeople.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-[var(--brand-slate)]">Nobody matches that filter.</p>
                ) : (
                  shownPeople.map((p) => {
                    const on = checked.has(p.id);
                    return (
                      <label
                        key={p.id}
                        className={`flex items-center gap-3 px-3 py-2 text-sm cursor-pointer ${
                          on ? "bg-[var(--brand-cream)]/60" : "hover:bg-[var(--brand-cream)]/40"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) => togglePerson(p.id, e.target.checked)}
                          className="h-4 w-4 accent-[var(--brand-red)]"
                        />
                        <span className="font-bold">{p.name}</span>
                        <span className="text-xs text-[var(--brand-slate)]">
                          {p.designation}
                          {p.designation && p.site ? " · " : ""}
                          {p.site}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            )}
            <p className="mt-2 text-xs text-[var(--brand-slate)]">
              {count} of {people.length} selected
            </p>
          </div>

          <div className="space-y-4">
            <SpellFields field={field} />
            <div className="flex items-center gap-3 pt-1">
              <button type="submit" disabled={pending || count === 0} className={PRIMARY}>
                <Plus size={14} />
                {pending ? "Saving..." : recordLabel}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setChecked(new Set());
                  setPersonQuery("");
                  setError(null);
                  setField(null);
                  setSaved(null);
                  setFormKey((k) => k + 1);
                }}
                className={SECONDARY}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </form>

      <div className="border border-[var(--brand-line)] rounded-2xl bg-white p-6 space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-black">Spells</h2>
          <p className="text-xs text-[var(--brand-slate)]">
            {visible.length} of {spells.length} shown
          </p>
        </div>

        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div>
            <label htmlFor="log-month" className={LABEL}>
              Month
            </label>
            <select
              id="log-month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className={`${INPUT} bg-white md:w-44`}
            >
              <option value="">All months</option>
              {monthOptions.map((k) => (
                <option key={k} value={k}>
                  {monthOptionLabel(k)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="log-reason" className={LABEL}>
              Reason
            </label>
            <select
              id="log-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={`${INPUT} bg-white md:w-56`}
            >
              <option value="">All reasons</option>
              {ABSENCE_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="log-site" className={LABEL}>
              Site
            </label>
            <select
              id="log-site"
              value={site}
              onChange={(e) => setSite(e.target.value)}
              className={`${INPUT} bg-white md:w-44`}
            >
              <option value="">All sites</option>
              {siteOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label htmlFor="log-search" className={LABEL}>
              Search
            </label>
            <input
              id="log-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, designation, site or notes"
              className={INPUT}
            />
          </div>
        </div>

        {rowError ? <p className="text-sm text-red-700">{rowError}</p> : null}

        {spells.length === 0 ? (
          <div className="bg-[var(--brand-cream)] border border-[var(--brand-line)] rounded-xl p-4 text-sm text-[var(--brand-slate)]">
            No spells yet. Record the first one above and it appears here and on the
            Labour unavailability report.
          </div>
        ) : visible.length === 0 ? (
          <div className="bg-[var(--brand-cream)] border border-[var(--brand-line)] rounded-xl p-4 text-sm text-[var(--brand-slate)]">
            Nothing matches these filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--brand-cream)]">
                <tr>
                  <th className={TH}>Person</th>
                  <th className={TH}>Site</th>
                  <th className={TH}>First day</th>
                  <th className={TH}>Last day</th>
                  <th className={`${TH} text-right`}>Days</th>
                  <th className={TH}>Reason</th>
                  <th className={TH}>Notes</th>
                  <th className={`${TH} text-right`}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--brand-line)]">
                {visible.map((s) => {
                  const open = expandedId === s.id;
                  return (
                    <Fragment key={s.id}>
                      <tr id={`spell-${s.id}`} className={open ? "bg-[var(--brand-cream)]/40" : ""}>
                        <td className={TD}>
                          <span className="font-bold">{s.name}</span>
                          {s.designation ? (
                            <span className="block text-xs text-[var(--brand-slate)]">{s.designation}</span>
                          ) : null}
                          {s.left ? (
                            <span className="block text-[10px] uppercase tracking-widest text-[var(--brand-slate)]">
                              Left
                            </span>
                          ) : null}
                        </td>
                        <td className={TD}>{s.site}</td>
                        <td className={`${TD} font-mono text-xs`}>{s.startsOn}</td>
                        <td className={`${TD} font-mono text-xs`}>{s.endsOn}</td>
                        <td className={`${TD} text-right font-bold`}>
                          {formatDays(spellDays(s))}
                          {s.halfDay ? (
                            <span className="ml-1 text-[10px] uppercase tracking-widest font-normal text-[var(--brand-slate)]">
                              half
                            </span>
                          ) : null}
                        </td>
                        <td className={TD}>
                          {absenceReasonLabel(s.reason)}
                          <span className="ml-2">
                            <ClassPill reason={s.reason} />
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-[var(--brand-slate)] max-w-xs truncate" title={s.notes}>
                          {s.notes}
                        </td>
                        <td className={`${TD} text-right`}>
                          <button
                            type="button"
                            onClick={() => {
                              setRowError(null);
                              setConfirmId(null);
                              setExpandedId(open ? null : s.id);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-bold text-[var(--brand-red)] hover:underline"
                          >
                            {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            {open ? "Close" : "Edit"}
                          </button>
                        </td>
                      </tr>
                      {open ? (
                        <tr>
                          <td colSpan={8} className="px-3 py-4 bg-[var(--brand-cream)]/40">
                            <div className="space-y-4 max-w-xl">
                              <p className="text-sm font-bold">
                                {s.name}
                                <span className="ml-2 text-xs font-normal text-[var(--brand-slate)]">
                                  {s.designation}
                                  {s.designation ? " · " : ""}
                                  {s.site}
                                </span>
                              </p>
                              <SpellEditForm
                                orgId={orgId}
                                slug={slug}
                                spell={s}
                                onDone={() => setExpandedId(null)}
                                onCancel={() => setExpandedId(null)}
                              />
                              <div className="border-t border-[var(--brand-line)] pt-3">
                                {confirmId === s.id ? (
                                  <span className="inline-flex items-center gap-3 text-sm">
                                    <span className="text-[var(--brand-slate)]">
                                      Remove this spell for {s.name}?
                                    </span>
                                    <button
                                      type="button"
                                      disabled={pending}
                                      onClick={() => onRemove(s.id)}
                                      className="font-bold text-red-700 hover:underline disabled:opacity-50"
                                    >
                                      {pending ? "Removing..." : "Yes, remove"}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={pending}
                                      onClick={() => setConfirmId(null)}
                                      className="font-bold text-[var(--brand-slate)] hover:underline disabled:opacity-50"
                                    >
                                      Keep
                                    </button>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={pending}
                                    onClick={() => setConfirmId(s.id)}
                                    className="inline-flex items-center gap-1 text-xs font-bold text-[var(--brand-slate)] hover:text-red-700 disabled:opacity-50"
                                  >
                                    <Trash2 size={12} />
                                    Remove spell
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="border border-[var(--brand-line)] rounded-2xl bg-white p-6">
        <h2 className="text-lg font-black mb-3">How the report reads this log</h2>
        <dl className="grid md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
          <div className="flex gap-3">
            <dt className="w-24 shrink-0 font-bold">Planned</dt>
            <dd className="text-[var(--brand-slate)]">
              Annual and study leave. These count against availability but are not held
              against the contractor.
            </dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-24 shrink-0 font-bold">Unplanned</dt>
            <dd className="text-[var(--brand-slate)]">
              Sick, family responsibility, injury on duty, unpaid, absent without leave and
              other. This is what the client reads.
            </dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-24 shrink-0 font-bold">Sick leave</dt>
            <dd className="text-[var(--brand-slate)]">
              A day count only. No medical detail is stored anywhere in Certly, so keep the
              notes to dates and arrangements.
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function SpellEditForm({
  orgId,
  slug,
  spell,
  onDone,
  onCancel,
}: {
  orgId: string;
  slug: string;
  spell: LogSpell;
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [field, setField] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setField(null);
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateAbsence(orgId, slug, spell.id, form);
      if (!result.ok) {
        setError(result.error);
        setField(result.field ?? null);
        return;
      }
      onDone();
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <SpellFields
        field={field}
        initial={{
          startsOn: spell.startsOn,
          endsOn: spell.endsOn,
          halfDay: spell.halfDay,
          reason: spell.reason,
          notes: spell.notes,
        }}
      />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={PRIMARY}>
          <Save size={14} />
          {pending ? "Saving..." : "Save changes"}
        </button>
        <button type="button" disabled={pending} onClick={onCancel} className={SECONDARY}>
          Cancel
        </button>
      </div>
    </form>
  );
}
