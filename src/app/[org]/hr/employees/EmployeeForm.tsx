"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Trash2 } from "lucide-react";
import type { Employee } from "@/lib/types/database";
import {
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from "@/lib/hr/mutations";
import { validateSaId } from "@/lib/validation/sa-id";

export default function EmployeeForm({
  orgId,
  slug,
  sites,
  initial,
}: {
  orgId: string;
  slug: string;
  sites: string[];
  initial?: Employee;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<{ field?: string; message: string } | null>(
    null,
  );
  const [saId, setSaId] = useState(initial?.sa_id ?? "");
  const saCheck = saId ? validateSaId(saId) : null;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = initial
        ? await updateEmployee(orgId, slug, initial.id, form)
        : await createEmployee(orgId, slug, form);
      if (!result.ok) {
        setError({ message: result.error, field: result.field });
        return;
      }
      router.push(
        initial
          ? `/${slug}/hr/employees/${initial.id}`
          : `/${slug}/hr/employees`,
      );
      router.refresh();
    });
  }

  function onDelete() {
    if (!initial) return;
    if (
      !confirm(
        `Delete ${initial.names} ${initial.surname}? All their certifications will be removed too.`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteEmployee(orgId, slug, initial.id);
      if (!result.ok) {
        setError({ message: result.error });
        return;
      }
      router.push(`/${slug}/hr/employees`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 text-sm">
          {error.message}
        </div>
      ) : null}

      <div className="grid sm:grid-cols-2 gap-4">
        <Field
          label="Surname"
          name="surname"
          defaultValue={initial?.surname}
          required
          invalid={error?.field === "surname"}
        />
        <Field
          label="Names"
          name="names"
          defaultValue={initial?.names}
          required
          invalid={error?.field === "names"}
        />
      </div>

      <div>
        <label className="text-xs uppercase tracking-widest font-bold text-[var(--brand-slate)]">
          SA ID <span className="text-[var(--brand-red)]">*</span>
        </label>
        <input
          type="text"
          name="sa_id"
          value={saId}
          onChange={(e) => setSaId(e.target.value.replace(/\s+/g, ""))}
          maxLength={13}
          required
          inputMode="numeric"
          pattern="\d{13}"
          className={`mt-1 w-full border rounded-md p-3 font-mono focus:outline-none focus:border-[var(--brand-red)] ${
            error?.field === "sa_id" || (saCheck && !saCheck.valid)
              ? "border-red-400"
              : "border-[var(--brand-line)]"
          }`}
        />
        {saCheck ? (
          saCheck.valid ? (
            <p className="mt-1 text-xs text-emerald-700">
              Valid. DOB {saCheck.dateOfBirth},{" "}
              {saCheck.gender === "male" ? "male" : "female"},{" "}
              {saCheck.citizen ? "citizen" : "permanent resident"}.
            </p>
          ) : (
            <p className="mt-1 text-xs text-red-600">{saCheck.reason}</p>
          )
        ) : (
          <p className="mt-1 text-xs text-[var(--brand-slate)]">
            13 digits. Luhn checksum is verified on save.
          </p>
        )}
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Field
          label="Site"
          name="site"
          defaultValue={initial?.site ?? ""}
          list="site-options"
        />
        <Field
          label="Superior"
          name="superior"
          defaultValue={initial?.superior ?? ""}
        />
        <Field
          label="Designation"
          name="designation"
          defaultValue={initial?.designation ?? ""}
        />
      </div>
      <datalist id="site-options">
        {sites.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <div className="flex items-center gap-3 pt-4 border-t border-[var(--brand-line)]">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 bg-[var(--brand-red)] hover:bg-[var(--brand-red-deep)] disabled:opacity-60 text-white px-6 py-3 rounded-md font-bold transition"
        >
          <Save size={16} />
          {pending ? "Saving..." : initial ? "Save changes" : "Create employee"}
        </button>
        {initial ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="inline-flex items-center gap-2 border border-red-300 text-red-700 hover:bg-red-50 px-4 py-3 rounded-md font-bold transition text-sm"
          >
            <Trash2 size={14} />
            Delete
          </button>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  required,
  invalid,
  list,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  invalid?: boolean;
  list?: string;
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-widest font-bold text-[var(--brand-slate)]">
        {label}{" "}
        {required ? <span className="text-[var(--brand-red)]">*</span> : null}
      </label>
      <input
        type="text"
        name={name}
        defaultValue={defaultValue}
        required={required}
        list={list}
        className={`mt-1 w-full border rounded-md p-3 focus:outline-none focus:border-[var(--brand-red)] ${
          invalid ? "border-red-400" : "border-[var(--brand-line)]"
        }`}
      />
    </div>
  );
}
