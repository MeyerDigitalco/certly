"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Trash2, Paperclip, Eye, X } from "lucide-react";
import type {
  Certification,
  Employee,
  TrainingType,
} from "@/lib/types/database";
import {
  upsertCertification,
  deleteCertification,
  removeCertificationFile,
} from "@/lib/hr/mutations";

export default function CertForm({
  orgId,
  slug,
  trainingTypes,
  employees,
  lockedEmployee,
  initial,
}: {
  orgId: string;
  slug: string;
  trainingTypes: TrainingType[];
  employees: Employee[];
  lockedEmployee?: Employee | null;
  initial?: Certification;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<{ field?: string; message: string } | null>(
    null,
  );
  const [hasFile, setHasFile] = useState(Boolean(initial?.cert_file_path));

  const employeeId = lockedEmployee?.id ?? initial?.employee_id ?? "";

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await upsertCertification(orgId, slug, form);
      if (!result.ok) {
        setError({ message: result.error, field: result.field });
        return;
      }
      const target = String(form.get("employee_id") ?? employeeId);
      router.push(
        target ? `/${slug}/hr/employees/${target}` : `/${slug}/hr`,
      );
      router.refresh();
    });
  }

  function onDelete() {
    if (!initial) return;
    if (
      !confirm(
        "Delete this certification and any attached file? This cannot be undone.",
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteCertification(orgId, slug, initial.id);
      if (!result.ok) {
        setError({ message: result.error });
        return;
      }
      router.push(`/${slug}/hr/employees/${initial.employee_id}`);
      router.refresh();
    });
  }

  function onRemoveFile() {
    if (!initial) return;
    if (!confirm("Remove the attached file from this certification?")) return;
    setError(null);
    startTransition(async () => {
      const result = await removeCertificationFile(orgId, slug, initial.id);
      if (!result.ok) {
        setError({ message: result.error });
        return;
      }
      setHasFile(false);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}

      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 text-sm">
          {error.message}
        </div>
      ) : null}

      <div>
        <Label required invalid={error?.field === "employee_id"}>
          Employee
        </Label>
        {lockedEmployee ? (
          <>
            <input
              type="hidden"
              name="employee_id"
              value={lockedEmployee.id}
            />
            <p className="mt-1 border border-[var(--brand-line)] bg-[var(--brand-cream)] rounded-md p-3 font-bold">
              {lockedEmployee.surname}, {lockedEmployee.names}
            </p>
          </>
        ) : (
          <select
            name="employee_id"
            required
            defaultValue={employeeId}
            className={`mt-1 w-full border rounded-md p-3 bg-white focus:outline-none focus:border-[var(--brand-red)] ${
              error?.field === "employee_id"
                ? "border-red-400"
                : "border-[var(--brand-line)]"
            }`}
          >
            <option value="">Choose an employee</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.surname}, {e.names}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <Label required invalid={error?.field === "training_type_id"}>
          Training type
        </Label>
        <select
          name="training_type_id"
          required
          defaultValue={initial?.training_type_id ?? ""}
          className={`mt-1 w-full border rounded-md p-3 bg-white focus:outline-none focus:border-[var(--brand-red)] ${
            error?.field === "training_type_id"
              ? "border-red-400"
              : "border-[var(--brand-line)]"
          }`}
        >
          <option value="">Choose a training type</option>
          {trainingTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-[var(--brand-slate)]">
          One record per employee per training type. Saving a type this person
          already has updates that record.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label invalid={error?.field === "training_date"}>Training date</Label>
          <input
            type="date"
            name="training_date"
            defaultValue={initial?.training_date ?? ""}
            className={`mt-1 w-full border rounded-md p-3 focus:outline-none focus:border-[var(--brand-red)] ${
              error?.field === "training_date"
                ? "border-red-400"
                : "border-[var(--brand-line)]"
            }`}
          />
        </div>
        <div>
          <Label invalid={error?.field === "expiry_date"}>Expiry date</Label>
          <input
            type="date"
            name="expiry_date"
            defaultValue={initial?.expiry_date ?? ""}
            className={`mt-1 w-full border rounded-md p-3 focus:outline-none focus:border-[var(--brand-red)] ${
              error?.field === "expiry_date"
                ? "border-red-400"
                : "border-[var(--brand-line)]"
            }`}
          />
          <p className="mt-1 text-xs text-[var(--brand-slate)]">
            Leave blank if this training does not expire.
          </p>
        </div>
      </div>

      <div>
        <Label invalid={error?.field === "file"}>Attachment</Label>
        {initial && hasFile ? (
          <div className="mt-1 mb-2 flex flex-wrap items-center gap-3 border border-[var(--brand-line)] bg-[var(--brand-cream)] rounded-md p-3">
            <span className="inline-flex items-center gap-1 text-sm font-bold">
              <Paperclip size={14} />
              File on record
            </span>
            <a
              href={`/${slug}/hr/certifications/${initial.id}/file`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[var(--brand-red)] font-bold text-xs hover:underline"
            >
              <Eye size={12} />
              View
            </a>
            <button
              type="button"
              onClick={onRemoveFile}
              disabled={pending}
              className="inline-flex items-center gap-1 text-[var(--brand-slate)] hover:text-red-700 font-bold text-xs transition"
            >
              <X size={12} />
              Remove file
            </button>
          </div>
        ) : null}
        <input
          type="file"
          name="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx"
          className={`mt-1 w-full border rounded-md p-3 text-sm file:mr-3 file:rounded file:border-0 file:bg-[var(--brand-ink)] file:px-3 file:py-1.5 file:text-white file:font-bold ${
            error?.field === "file"
              ? "border-red-400"
              : "border-[var(--brand-line)]"
          }`}
        />
        <p className="mt-1 text-xs text-[var(--brand-slate)]">
          PDF, image, or Word document. Up to 15 MB.
          {hasFile ? " Choosing a new file replaces the one on record." : ""}
        </p>
      </div>

      <div className="flex items-center gap-3 pt-4 border-t border-[var(--brand-line)]">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 bg-[var(--brand-red)] hover:bg-[var(--brand-red-deep)] disabled:opacity-60 text-white px-6 py-3 rounded-md font-bold transition"
        >
          <Save size={16} />
          {pending
            ? "Saving..."
            : initial
              ? "Save changes"
              : "Save certification"}
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

function Label({
  children,
  required,
  invalid,
}: {
  children: React.ReactNode;
  required?: boolean;
  invalid?: boolean;
}) {
  return (
    <label
      className={`text-xs uppercase tracking-widest font-bold ${
        invalid ? "text-red-600" : "text-[var(--brand-slate)]"
      }`}
    >
      {children}{" "}
      {required ? <span className="text-[var(--brand-red)]">*</span> : null}
    </label>
  );
}
