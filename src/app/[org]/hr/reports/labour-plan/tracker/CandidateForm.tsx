"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import type { OnboardingCandidate } from "@/lib/types/database";
import type { ActionResult } from "@/lib/hr/mutations";
import { ONBOARDING_STATUSES } from "@/lib/hr/operations";

export const LABEL = "block uppercase tracking-widest text-[10px] font-bold text-[var(--brand-slate)] mb-1";
export const INPUT = "w-full border border-[var(--brand-line)] rounded-md px-3 py-2 text-sm";
export const PRIMARY =
  "bg-[var(--brand-red)] hover:bg-[var(--brand-red-deep)] disabled:opacity-60 text-white px-4 py-2 rounded-md text-sm font-bold transition inline-flex items-center gap-2";
export const SECONDARY =
  "border border-[var(--brand-ink)] disabled:opacity-60 px-4 py-2 rounded-md text-sm font-bold transition";

const ID_TYPES: Array<{ value: OnboardingCandidate["id_type"]; label: string }> = [
  { value: "sa_id", label: "South African ID" },
  { value: "passport", label: "Passport" },
  { value: "work_permit", label: "Work permit" },
  { value: "asylum", label: "Asylum seeker permit" },
  { value: "other", label: "Other" },
];

const MEDICAL_STATUSES: Array<{ value: "" | "pending" | "fit" | "unfit"; label: string }> = [
  { value: "", label: "Not yet done" },
  { value: "pending", label: "Pending" },
  { value: "fit", label: "Fit" },
  { value: "unfit", label: "Unfit" },
];

/**
 * One form for both adding and editing a candidate. Field names match what
 * the server action reads, so the same markup drives create and update.
 */
export default function CandidateForm({
  initial,
  onSubmit,
  onDone,
  onCancel,
  submitLabel,
  siteOptions,
  designationOptions,
}: {
  initial?: OnboardingCandidate;
  onSubmit: (formData: FormData) => Promise<ActionResult>;
  onDone?: () => void;
  onCancel?: () => void;
  submitLabel: string;
  siteOptions: string[];
  designationOptions: string[];
}) {
  const router = useRouter();
  const uid = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [field, setField] = useState<string | null>(null);

  const siteList = `${uid}-sites`;
  const designationList = `${uid}-designations`;

  function cls(name: string): string {
    return `${INPUT} ${field === name ? "border-red-700" : ""}`;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setField(null);
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await onSubmit(form);
      if (!result.ok) {
        setError(result.error);
        setField(result.field ?? null);
        return;
      }
      router.refresh();
      onDone?.();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <fieldset className="space-y-3">
        <legend className="text-xs font-black uppercase tracking-widest text-[var(--brand-red)]">
          Person
        </legend>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${uid}-surname`} className={LABEL}>
              Surname
            </label>
            <input
              id={`${uid}-surname`}
              name="surname"
              required
              maxLength={120}
              defaultValue={initial?.surname ?? ""}
              className={cls("surname")}
            />
          </div>
          <div>
            <label htmlFor={`${uid}-names`} className={LABEL}>
              First names
            </label>
            <input
              id={`${uid}-names`}
              name="names"
              required
              maxLength={120}
              defaultValue={initial?.names ?? ""}
              className={cls("names")}
            />
          </div>
          <div>
            <label htmlFor={`${uid}-id-type`} className={LABEL}>
              Document type
            </label>
            <select
              id={`${uid}-id-type`}
              name="id_type"
              defaultValue={initial?.id_type ?? "sa_id"}
              className={`${cls("id_type")} bg-white`}
            >
              {ID_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${uid}-id-number`} className={LABEL}>
              Document number
            </label>
            <input
              id={`${uid}-id-number`}
              name="id_number"
              maxLength={40}
              defaultValue={initial?.id_number ?? ""}
              placeholder="Needed before they can be engaged"
              className={cls("id_number")}
            />
          </div>
          <div>
            <label htmlFor={`${uid}-designation`} className={LABEL}>
              Designation
            </label>
            <input
              id={`${uid}-designation`}
              name="designation"
              list={designationList}
              required
              maxLength={120}
              defaultValue={initial?.designation ?? ""}
              className={cls("designation")}
            />
            <datalist id={designationList}>
              {designationOptions.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>
          <div>
            <label htmlFor={`${uid}-site`} className={LABEL}>
              Site
            </label>
            <input
              id={`${uid}-site`}
              name="site"
              list={siteList}
              required
              maxLength={120}
              defaultValue={initial?.site ?? ""}
              className={cls("site")}
            />
            <datalist id={siteList}>
              {siteOptions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div>
            <label htmlFor={`${uid}-status`} className={LABEL}>
              Stage
            </label>
            <select
              id={`${uid}-status`}
              name="status"
              defaultValue={initial?.status ?? "screening"}
              className={`${cls("status")} bg-white`}
            >
              {ONBOARDING_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-xs font-black uppercase tracking-widest text-[var(--brand-red)]">
          Screening and medical
        </legend>
        <div className="grid md:grid-cols-3 gap-3">
          <DateField id={`${uid}-screening-booked`} name="screening_booked_at" label="Screening booked" value={initial?.screening_booked_at} cls={cls} />
          <DateField id={`${uid}-screened`} name="screened_at" label="Screened on" value={initial?.screened_at} cls={cls} />
          <DateField id={`${uid}-medical-booked`} name="medical_booked_at" label="Medical booked" value={initial?.medical_booked_at} cls={cls} />
          <DateField id={`${uid}-medical`} name="medical_at" label="Medical done on" value={initial?.medical_at} cls={cls} />
          <DateField id={`${uid}-rfac`} name="rfac_at" label="RFAC issued" value={initial?.rfac_at} cls={cls} />
          <div>
            <label htmlFor={`${uid}-medical-status`} className={LABEL}>
              Medical status
            </label>
            <select
              id={`${uid}-medical-status`}
              name="medical_status"
              defaultValue={initial?.medical_status ?? ""}
              className={`${cls("medical_status")} bg-white`}
            >
              {MEDICAL_STATUSES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <DateField id={`${uid}-medical-review`} name="medical_review_at" label="Medical review due" value={initial?.medical_review_at} cls={cls} />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-xs font-black uppercase tracking-widest text-[var(--brand-red)]">
          TEBA and training
        </legend>
        <div className="grid md:grid-cols-3 gap-3 items-end">
          <label className="inline-flex items-center gap-2 text-sm py-2">
            <input
              type="checkbox"
              name="teba_done"
              defaultChecked={initial?.teba_done ?? false}
              className="h-4 w-4 accent-[var(--brand-red)]"
            />
            TEBA registration done
          </label>
          <label className="inline-flex items-center gap-2 text-sm py-2">
            <input
              type="checkbox"
              name="training_booked"
              defaultChecked={initial?.training_booked ?? false}
              className="h-4 w-4 accent-[var(--brand-red)]"
            />
            Training booked
          </label>
          <div />
          <DateField id={`${uid}-training-start`} name="training_start_at" label="Training starts" value={initial?.training_start_at} cls={cls} />
          <DateField id={`${uid}-passout`} name="expected_passout_at" label="Expected passout" value={initial?.expected_passout_at} cls={cls} />
        </div>
      </fieldset>

      <div>
        <label htmlFor={`${uid}-notes`} className={LABEL}>
          Notes
        </label>
        <textarea
          id={`${uid}-notes`}
          name="notes"
          rows={2}
          maxLength={500}
          defaultValue={initial?.notes ?? ""}
          className={cls("notes")}
        />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={pending} className={PRIMARY}>
          <Save size={14} />
          {pending ? "Saving..." : submitLabel}
        </button>
        {onCancel ? (
          <button type="button" disabled={pending} onClick={onCancel} className={SECONDARY}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

function DateField({
  id,
  name,
  label,
  value,
  cls,
}: {
  id: string;
  name: string;
  label: string;
  value: string | null | undefined;
  cls: (name: string) => string;
}) {
  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <input id={id} name={name} type="date" defaultValue={value ?? ""} className={cls(name)} />
    </div>
  );
}
