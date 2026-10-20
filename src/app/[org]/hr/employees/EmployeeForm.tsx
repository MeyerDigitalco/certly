"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Trash2 } from "lucide-react";
import type { Employee, IdType } from "@/lib/types/database";
import {
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from "@/lib/hr/mutations";
import {
  validateIdentification,
  ID_TYPES,
  ID_COUNTRIES,
} from "@/lib/validation/identification";
import {
  GENDERS,
  OCCUPATIONAL_LEVELS,
  POPULATION_GROUPS,
} from "@/lib/hr/operations";

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
  const [idType, setIdType] = useState<IdType>(initial?.id_type ?? "sa_id");
  const [idNumber, setIdNumber] = useState(initial?.id_number ?? "");

  const idCheck = idNumber ? validateIdentification(idType, idNumber) : null;
  const typeMeta = ID_TYPES.find((t) => t.value === idType);
  const needsExpiry = idType !== "sa_id";

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
        initial ? `/${slug}/hr/employees/${initial.id}` : `/${slug}/hr/employees`,
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

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label required>Identification type</Label>
          <select
            name="id_type"
            value={idType}
            onChange={(e) => setIdType(e.target.value as IdType)}
            className="mt-1 w-full border border-[var(--brand-line)] rounded-md p-3 bg-white focus:outline-none focus:border-[var(--brand-red)]"
          >
            {ID_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label required>Issuing country</Label>
          <select
            name="id_country"
            defaultValue={initial?.id_country ?? "ZA"}
            className="mt-1 w-full border border-[var(--brand-line)] rounded-md p-3 bg-white focus:outline-none focus:border-[var(--brand-red)]"
          >
            {ID_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label required>Identification number</Label>
          <input
            type="text"
            name="id_number"
            value={idNumber}
            onChange={(e) =>
              setIdNumber(
                idType === "sa_id"
                  ? e.target.value.replace(/\s+/g, "")
                  : e.target.value,
              )
            }
            maxLength={idType === "sa_id" ? 13 : 30}
            required
            inputMode={idType === "sa_id" ? "numeric" : "text"}
            className={`mt-1 w-full border rounded-md p-3 font-mono focus:outline-none focus:border-[var(--brand-red)] ${
              error?.field === "id_number" || (idCheck && !idCheck.valid)
                ? "border-red-400"
                : "border-[var(--brand-line)]"
            }`}
          />
          {idCheck ? (
            idCheck.valid ? (
              <p className="mt-1 text-xs text-emerald-700">
                {idCheck.detail ?? "Looks valid."}
              </p>
            ) : (
              <p className="mt-1 text-xs text-red-600">{idCheck.reason}</p>
            )
          ) : (
            <p className="mt-1 text-xs text-[var(--brand-slate)]">
              {typeMeta?.hint}
            </p>
          )}
        </div>
        <div>
          <Label>Document expiry</Label>
          <input
            type="date"
            name="id_expiry"
            defaultValue={initial?.id_expiry ?? ""}
            className={`mt-1 w-full border rounded-md p-3 focus:outline-none focus:border-[var(--brand-red)] ${
              error?.field === "id_expiry"
                ? "border-red-400"
                : "border-[var(--brand-line)]"
            }`}
          />
          <p className="mt-1 text-xs text-[var(--brand-slate)]">
            {needsExpiry
              ? "A lapsed permit stops this person at the gate. Record it."
              : "South African IDs do not expire. Leave this blank."}
          </p>
        </div>
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

      <div className="pt-4 border-t border-[var(--brand-line)]">
        <p className="text-xs uppercase tracking-widest font-bold text-[var(--brand-slate)]">
          Service and retirement
        </p>
        <p className="mt-1 text-xs text-[var(--brand-slate)]">
          These feed the monthly reports. Start date drives joiners and
          turnover; date of birth and retirement age drive the overdue
          retirement list.
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <Label>Start date</Label>
          <input
            type="date"
            name="engaged_at"
            defaultValue={initial?.engaged_at ?? ""}
            className="mt-1 w-full border border-[var(--brand-line)] rounded-md p-3"
          />
        </div>
        <div>
          <Label>Date of birth</Label>
          <input
            type="date"
            name="date_of_birth"
            defaultValue={initial?.date_of_birth ?? ""}
            className="mt-1 w-full border border-[var(--brand-line)] rounded-md p-3"
          />
        </div>
        <div>
          <Label>Retirement age</Label>
          <input
            type="number"
            name="retirement_age"
            min={50}
            max={75}
            placeholder="Workspace default"
            defaultValue={initial?.retirement_age ?? ""}
            className="mt-1 w-full border border-[var(--brand-line)] rounded-md p-3"
          />
          <p className="mt-1 text-xs text-[var(--brand-slate)]">
            Leave blank to use the workspace default. Set it when a contract
            or fund rule says otherwise.
          </p>
        </div>
        <div>
          <Label>Approved revised retirement date</Label>
          <input
            type="date"
            name="approved_retirement_date"
            defaultValue={initial?.approved_retirement_date ?? ""}
            className="mt-1 w-full border border-[var(--brand-line)] rounded-md p-3"
          />
          <p className="mt-1 text-xs text-[var(--brand-slate)]">
            Only when an extension past the official date has been approved.
          </p>
        </div>
      </div>

      <div className="pt-4 border-t border-[var(--brand-line)]">
        <p className="text-xs uppercase tracking-widest font-bold text-[var(--brand-slate)]">
          Employment equity declaration
        </p>
        <p className="mt-1 text-xs text-[var(--brand-slate)]">
          Only what the person declared on their EEA1 form. The Employment
          Equity Act requires it from employers with 50 or more people and
          POPIA permits it on that basis. Leave blank if the person has not
          declared. Nothing here is guessed from a name or a photo.
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <Label>Gender</Label>
          <select
            name="gender"
            defaultValue={initial?.gender ?? ""}
            className="mt-1 w-full border border-[var(--brand-line)] rounded-md p-3 bg-white"
          >
            <option value="">Not declared</option>
            {GENDERS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Population group</Label>
          <select
            name="population_group"
            defaultValue={initial?.population_group ?? ""}
            className="mt-1 w-full border border-[var(--brand-line)] rounded-md p-3 bg-white"
          >
            <option value="">Not declared</option>
            {POPULATION_GROUPS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Person with a disability</Label>
          <select
            name="disability"
            defaultValue={
              initial?.disability === true ? "yes" : initial?.disability === false ? "no" : ""
            }
            className="mt-1 w-full border border-[var(--brand-line)] rounded-md p-3 bg-white"
          >
            <option value="">Not declared</option>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
          <p className="mt-1 text-xs text-[var(--brand-slate)]">
            Yes or no only. The nature of a disability is never recorded.
          </p>
        </div>
        <div>
          <Label>Occupational level</Label>
          <select
            name="occupational_level"
            defaultValue={initial?.occupational_level ?? ""}
            className="mt-1 w-full border border-[var(--brand-line)] rounded-md p-3 bg-white"
          >
            <option value="">Not set</option>
            {OCCUPATIONAL_LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>OFO code</Label>
          <input
            type="text"
            name="ofo_code"
            maxLength={12}
            placeholder="Optional, for the WSP"
            defaultValue={initial?.ofo_code ?? ""}
            className="mt-1 w-full border border-[var(--brand-line)] rounded-md p-3"
          />
        </div>
        <div>
          <Label>EEA1 declaration date</Label>
          <input
            type="date"
            name="ee_declared_at"
            defaultValue={initial?.ee_declared_at ?? ""}
            className="mt-1 w-full border border-[var(--brand-line)] rounded-md p-3"
          />
          <p className="mt-1 text-xs text-[var(--brand-slate)]">
            The date on the signed form you keep on file.
          </p>
        </div>
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

function Label({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="text-xs uppercase tracking-widest font-bold text-[var(--brand-slate)]">
      {children}{" "}
      {required ? <span className="text-[var(--brand-red)]">*</span> : null}
    </label>
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
      <Label required={required}>{label}</Label>
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
