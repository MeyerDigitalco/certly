"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Plus, Trash2, UserCheck } from "lucide-react";
import type { OnboardingCandidate, OnboardingStatus } from "@/lib/types/database";
import {
  createOnboardingCandidate,
  deleteOnboardingCandidate,
  engageOnboardingCandidate,
  updateOnboardingCandidate,
} from "@/lib/hr/mutations";
import { ONBOARDING_STATUSES, siteOf } from "@/lib/hr/operations";
import CandidateForm, { INPUT, LABEL, PRIMARY, SECONDARY } from "./CandidateForm";

const TH = "px-3 py-2 text-left font-bold uppercase tracking-widest text-[10px] text-[var(--brand-slate)]";
const TD = "px-3 py-2 whitespace-nowrap";

const PILL: Record<OnboardingStatus, string> = {
  screening: "bg-[var(--brand-cream)] text-[var(--brand-ink)] border-[var(--brand-line)]",
  medical: "bg-amber-50 text-amber-800 border-amber-200",
  teba: "bg-amber-50 text-amber-800 border-amber-200",
  training: "bg-[var(--brand-ink)] text-white border-[var(--brand-ink)]",
  ready: "bg-emerald-50 text-emerald-800 border-emerald-200",
  engaged: "bg-emerald-700 text-white border-emerald-700",
  unfit: "bg-red-50 text-red-800 border-red-200",
  withdrawn: "bg-white text-[var(--brand-slate)] border-[var(--brand-line)]",
};

const LEGEND: Array<{ stage: string; text: string }> = [
  { stage: "Screening", text: "Interview, documents and reference checks. Record the booked date and the date screened." },
  { stage: "Medical", text: "Occupational health medical. RFAC is the date the fitness certificate was issued. Mark fit, unfit or pending." },
  { stage: "TEBA", text: "TEBA registration and fingerprinting done, so the person can be inducted on the mine." },
  { stage: "Training", text: "Booked and started on induction or trade training. Expected passout is the date they can start." },
  { stage: "Ready", text: "Passed out and cleared. Engage them with a start date and Certly adds them to the register." },
  { stage: "Engaged", text: "On the register. They leave the pipeline and count as actual headcount from the start date." },
];

function statusLabel(status: OnboardingStatus): string {
  return ONBOARDING_STATUSES.find((s) => s.value === status)?.label ?? status;
}

function today(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function StatusPill({ status }: { status: OnboardingStatus }) {
  return (
    <span
      className={`inline-block border rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${PILL[status]}`}
    >
      {statusLabel(status)}
    </span>
  );
}

export default function TrackerBoard({
  orgId,
  slug,
  candidates,
  siteOptions,
  designationOptions,
}: {
  orgId: string;
  slug: string;
  candidates: OnboardingCandidate[];
  siteOptions: string[];
  designationOptions: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string>("active");
  const [site, setSite] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const candidateSites = useMemo(
    () => [...new Set(candidates.map((c) => siteOf(c.site)))].sort((a, b) => a.localeCompare(b)),
    [candidates],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates.filter((c) => {
      if (status === "active") {
        if (c.status === "engaged" || c.status === "unfit" || c.status === "withdrawn") return false;
      } else if (status !== "" && c.status !== status) {
        return false;
      }
      if (site && siteOf(c.site) !== site) return false;
      if (q) {
        const hay = `${c.surname} ${c.names} ${c.id_number ?? ""} ${c.designation} ${c.site}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [candidates, status, site, query]);

  function onRemove(id: string) {
    setRowError(null);
    startTransition(async () => {
      const result = await deleteOnboardingCandidate(orgId, slug, id);
      if (!result.ok) {
        setRowError(result.error);
        return;
      }
      setConfirmId(null);
      setExpandedId(null);
      router.refresh();
    });
  }

  function onEngage(id: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setRowError(null);
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await engageOnboardingCandidate(orgId, slug, id, form);
      if (!result.ok) {
        setRowError(result.error);
        return;
      }
      setExpandedId(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="border border-[var(--brand-line)] rounded-2xl bg-white p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div>
            <label htmlFor="tracker-status" className={LABEL}>
              Stage
            </label>
            <select
              id="tracker-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={`${INPUT} bg-white md:w-48`}
            >
              <option value="active">In pipeline</option>
              <option value="">All stages</option>
              {ONBOARDING_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tracker-site" className={LABEL}>
              Site
            </label>
            <select
              id="tracker-site"
              value={site}
              onChange={(e) => setSite(e.target.value)}
              className={`${INPUT} bg-white md:w-48`}
            >
              <option value="">All sites</option>
              {candidateSites.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label htmlFor="tracker-search" className={LABEL}>
              Search
            </label>
            <input
              id="tracker-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Surname, names, document number or designation"
              className={INPUT}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setCreating((v) => !v);
              setExpandedId(null);
            }}
            className={creating ? SECONDARY : PRIMARY}
          >
            {creating ? (
              "Close"
            ) : (
              <>
                <Plus size={14} />
                Add candidate
              </>
            )}
          </button>
        </div>

        {creating ? (
          <div className="border-t border-[var(--brand-line)] pt-4">
            <h2 className="text-lg font-black mb-3">New candidate</h2>
            <CandidateForm
              onSubmit={(fd) => createOnboardingCandidate(orgId, slug, fd)}
              onDone={() => setCreating(false)}
              onCancel={() => setCreating(false)}
              submitLabel="Add candidate"
              siteOptions={siteOptions}
              designationOptions={designationOptions}
            />
          </div>
        ) : null}
      </div>

      <div className="border border-[var(--brand-line)] rounded-2xl bg-white p-6">
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h2 className="text-lg font-black">Candidates</h2>
          <p className="text-xs text-[var(--brand-slate)]">
            {visible.length} of {candidates.length} shown
          </p>
        </div>
        {rowError ? <p className="mb-3 text-sm text-red-700">{rowError}</p> : null}

        {candidates.length === 0 ? (
          <div className="bg-[var(--brand-cream)] border border-[var(--brand-line)] rounded-xl p-4 text-sm text-[var(--brand-slate)]">
            No candidates yet. Use Add candidate above to start the pipeline. Each one
            moves from screening through medical, TEBA and training to ready, and is
            then engaged onto the register.
          </div>
        ) : visible.length === 0 ? (
          <div className="bg-[var(--brand-cream)] border border-[var(--brand-line)] rounded-xl p-4 text-sm text-[var(--brand-slate)]">
            Nothing matches these filters. Choose All stages to include people who were
            engaged, found unfit or withdrew.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--brand-cream)]">
                <tr>
                  <th className={TH}>Candidate</th>
                  <th className={TH}>Designation</th>
                  <th className={TH}>Site</th>
                  <th className={TH}>Stage</th>
                  <th className={TH}>Screened</th>
                  <th className={TH}>Medical</th>
                  <th className={TH}>RFAC</th>
                  <th className={TH}>TEBA</th>
                  <th className={TH}>Training</th>
                  <th className={TH}>Passout</th>
                  <th className={`${TH} text-right`}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--brand-line)]">
                {visible.map((c) => {
                  const open = expandedId === c.id;
                  return (
                    <Fragment key={c.id}>
                      <tr className={open ? "bg-[var(--brand-cream)]/40" : ""}>
                        <td className={TD}>
                          <span className="font-bold">{c.surname}</span>{" "}
                          <span className="text-[var(--brand-slate)]">{c.names}</span>
                          {c.id_number ? (
                            <span className="block font-mono text-[11px] text-[var(--brand-slate)]">{c.id_number}</span>
                          ) : null}
                        </td>
                        <td className={TD}>{c.designation}</td>
                        <td className={TD}>{siteOf(c.site)}</td>
                        <td className={TD}>
                          <StatusPill status={c.status} />
                        </td>
                        <td className={`${TD} font-mono text-xs`}>{c.screened_at ?? (c.screening_booked_at ? `booked ${c.screening_booked_at}` : "")}</td>
                        <td className={`${TD} font-mono text-xs`}>
                          {c.medical_at ?? (c.medical_booked_at ? `booked ${c.medical_booked_at}` : "")}
                          {c.medical_status ? (
                            <span
                              className={`ml-1 font-sans text-[10px] font-bold uppercase ${c.medical_status === "unfit" ? "text-red-700" : c.medical_status === "fit" ? "text-emerald-700" : "text-amber-700"}`}
                            >
                              {c.medical_status}
                            </span>
                          ) : null}
                        </td>
                        <td className={`${TD} font-mono text-xs`}>{c.rfac_at ?? ""}</td>
                        <td className={TD}>{c.teba_done ? "Done" : ""}</td>
                        <td className={`${TD} font-mono text-xs`}>{c.training_start_at ?? (c.training_booked ? "booked" : "")}</td>
                        <td className={`${TD} font-mono text-xs`}>{c.expected_passout_at ?? ""}</td>
                        <td className={`${TD} text-right`}>
                          <button
                            type="button"
                            onClick={() => {
                              setRowError(null);
                              setConfirmId(null);
                              setExpandedId(open ? null : c.id);
                              setCreating(false);
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
                          <td colSpan={11} className="px-3 py-4 bg-[var(--brand-cream)]/40">
                            <div className="space-y-5">
                              {c.status === "ready" ? (
                                <form
                                  onSubmit={(e) => onEngage(c.id, e)}
                                  className="border border-emerald-200 bg-emerald-50 rounded-xl p-4 flex flex-col md:flex-row md:items-end gap-3"
                                >
                                  <div className="flex-1">
                                    <p className="text-sm font-bold flex items-center gap-2">
                                      <UserCheck size={14} className="text-emerald-700" />
                                      Ready to engage
                                    </p>
                                    <p className="text-xs text-[var(--brand-slate)] mt-1">
                                      Give the start date and Certly creates {c.names} {c.surname} on the
                                      register with this site and designation. The document number must be
                                      filled in first.
                                    </p>
                                  </div>
                                  <div>
                                    <label htmlFor={`engage-${c.id}`} className={LABEL}>
                                      Start date
                                    </label>
                                    <input
                                      id={`engage-${c.id}`}
                                      name="engaged_at"
                                      type="date"
                                      required
                                      defaultValue={today()}
                                      className={INPUT}
                                    />
                                  </div>
                                  <button type="submit" disabled={pending} className={PRIMARY}>
                                    <UserCheck size={14} />
                                    {pending ? "Working..." : "Engage"}
                                  </button>
                                </form>
                              ) : null}

                              {c.status === "engaged" ? (
                                <p className="text-xs text-[var(--brand-slate)]">
                                  Engaged and on the register. Changing the stage here does not
                                  change the employee record.
                                </p>
                              ) : null}

                              <CandidateForm
                                initial={c}
                                onSubmit={(fd) => updateOnboardingCandidate(orgId, slug, c.id, fd)}
                                onDone={() => setExpandedId(null)}
                                onCancel={() => setExpandedId(null)}
                                submitLabel="Save changes"
                                siteOptions={siteOptions}
                                designationOptions={designationOptions}
                              />

                              <div className="border-t border-[var(--brand-line)] pt-3">
                                {confirmId === c.id ? (
                                  <span className="inline-flex items-center gap-3 text-sm">
                                    <span className="text-[var(--brand-slate)]">
                                      Remove {c.names} {c.surname} from the tracker? Use Withdrawn or
                                      Unfit instead if you want to keep the record.
                                    </span>
                                    <button
                                      type="button"
                                      disabled={pending}
                                      onClick={() => onRemove(c.id)}
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
                                    onClick={() => setConfirmId(c.id)}
                                    className="inline-flex items-center gap-1 text-xs font-bold text-[var(--brand-slate)] hover:text-red-700 disabled:opacity-50"
                                  >
                                    <Trash2 size={12} />
                                    Remove candidate
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
        <h2 className="text-lg font-black mb-3">Stages</h2>
        <dl className="grid md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {LEGEND.map((l) => (
            <div key={l.stage} className="flex gap-3">
              <dt className="w-24 shrink-0 font-bold">{l.stage}</dt>
              <dd className="text-[var(--brand-slate)]">{l.text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
