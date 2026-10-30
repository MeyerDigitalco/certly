"use client";

import { useState, useTransition } from "react";
import { shrinkImage, describeSize } from "@/lib/images/shrink";
import { UPLOAD_LIMIT_BYTES } from "@/lib/images/limits";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ScanLine,
  Save,
  AlertTriangle,
  UserPlus,
  UserCheck,
  RotateCcw,
  FileBadge,
  BookUser,
} from "lucide-react";
import type { Employee, IdType, TrainingType } from "@/lib/types/database";
import { extractCertificate, type ExtractionDraft } from "@/lib/hr/extraction";
import {
  isIdentityKind,
  DOCUMENT_KIND_LABEL,
} from "@/lib/hr/document-kinds";
import {
  saveScannedCertificate,
  saveScannedIdentity,
} from "@/lib/hr/mutations";
import { ID_TYPES, ID_COUNTRIES } from "@/lib/validation/identification";

type EmployeeMode = "match" | "existing" | "new";

export default function ScanClient({
  orgId,
  slug,
  employees,
  trainingTypes,
  sites,
  lockedEmployee,
}: {
  orgId: string;
  slug: string;
  employees: Employee[];
  trainingTypes: TrainingType[];
  sites: string[];
  lockedEmployee?: Employee | null;
}) {
  const router = useRouter();
  const [reading, startReading] = useTransition();
  const [saving, startSaving] = useTransition();

  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<ExtractionDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [employeeMode, setEmployeeMode] = useState<EmployeeMode>("new");
  const [existingEmployeeId, setExistingEmployeeId] = useState("");
  const [surname, setSurname] = useState("");
  const [names, setNames] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [idType, setIdType] = useState<IdType>("sa_id");
  const [idCountry, setIdCountry] = useState("ZA");
  const [idExpiry, setIdExpiry] = useState("");
  const [site, setSite] = useState("");
  const [designation, setDesignation] = useState("");

  const [typeId, setTypeId] = useState("");
  const [newTypeName, setNewTypeName] = useState("");
  const [trainingDate, setTrainingDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  function onRead(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    startReading(async () => {
      // A photograph from a phone is several megabytes and would be refused
      // before it reached the server, with nothing to tell the person why.
      // Shrinking it here is invisible, quicker to upload on site, and still
      // far more detail than is needed to read a printed certificate.
      const sending = await shrinkImage(file);

      if (sending.size > UPLOAD_LIMIT_BYTES) {
        setError(
          `That file is ${describeSize(sending.size)}, which is over the ${describeSize(UPLOAD_LIMIT_BYTES)} limit. Photograph the certificate instead of scanning it, or save the PDF at a lower quality.`,
        );
        return;
      }

      const form = new FormData();
      form.set("file", sending);
      const result = await extractCertificate(orgId, form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      applyDraft(result.draft);
    });
  }

  function applyDraft(d: ExtractionDraft) {
    setDraft(d);
    const x = d.extracted;
    const identity = isIdentityKind(x.document_kind);

    setSurname(x.person_surname ?? lockedEmployee?.surname ?? "");
    setNames(x.person_names ?? lockedEmployee?.names ?? "");
    setIdNumber(x.id_number ?? "");
    setIdType(x.id_type ?? "sa_id");
    setIdCountry(x.id_country ?? (!x.id_type || x.id_type === "sa_id" ? "ZA" : "ZW"));
    setIdExpiry(identity ? (x.expiry_date ?? "") : "");
    setSite(lockedEmployee?.site ?? "");
    setDesignation(lockedEmployee?.designation ?? "");
    setTrainingDate(identity ? "" : (x.training_date ?? ""));
    setExpiryDate(identity ? "" : (x.expiry_date ?? ""));

    if (lockedEmployee) {
      setEmployeeMode("existing");
      setExistingEmployeeId(lockedEmployee.id);
    } else if (d.employeeMatch) {
      setEmployeeMode("match");
      setExistingEmployeeId(d.employeeMatch.id);
    } else {
      setEmployeeMode("new");
      setExistingEmployeeId("");
    }

    if (d.trainingTypeMatch) {
      setTypeId(d.trainingTypeMatch.id);
      setNewTypeName("");
    } else {
      setTypeId("");
      setNewTypeName(identity ? "" : (x.training_type ?? ""));
    }
  }

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft) return;
    setError(null);
    const isIdentity = isIdentityKind(draft.extracted.document_kind);
    const form = new FormData();

    if (isIdentity) {
      if (file) form.set("file", file);
      if (employeeMode !== "new") form.set("employee_id", existingEmployeeId);
      form.set("surname", surname);
      form.set("names", names);
      form.set("id_number", idNumber);
      form.set("id_type", idType);
      form.set("id_country", idCountry);
      form.set("id_expiry", idExpiry);
      form.set("site", site);
      form.set("designation", designation);
      startSaving(async () => {
        const result = await saveScannedIdentity(orgId, slug, form);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.push(`/${slug}/hr/employees/${result.employeeId}`);
        router.refresh();
      });
      return;
    }

    if (file) form.set("file", file);
    form.set("extraction_meta", JSON.stringify(draft.extracted));
    if (employeeMode !== "new") {
      form.set("employee_id", existingEmployeeId);
    } else {
      form.set("new_surname", surname);
      form.set("new_names", names);
      form.set("new_id_number", idNumber);
      form.set("new_id_type", idType);
      form.set("new_id_country", idCountry);
      form.set("new_id_expiry", idExpiry);
      form.set("new_site", site);
      form.set("new_designation", designation);
    }
    if (typeId) form.set("training_type_id", typeId);
    else form.set("new_training_type", newTypeName);
    form.set("training_date", trainingDate);
    form.set("expiry_date", expiryDate);

    startSaving(async () => {
      const result = await saveScannedCertificate(orgId, slug, form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/${slug}/hr/employees/${result.employeeId}`);
      router.refresh();
    });
  }

  function reset() {
    setDraft(null);
    setFile(null);
    setError(null);
  }

  if (!draft) {
    return (
      <form onSubmit={onRead} className="space-y-4">
        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 text-sm">
            {error}
          </div>
        ) : null}
        {lockedEmployee ? (
          <p className="text-sm text-[var(--brand-slate)] border border-[var(--brand-line)] bg-[var(--brand-cream)] rounded-md p-3">
            Adding for{" "}
            <span className="font-bold text-[var(--brand-ink)]">
              {lockedEmployee.surname}, {lockedEmployee.names}
            </span>
            .
          </p>
        ) : null}
        <div>
          <Label>Document</Label>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.gif"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 w-full border border-[var(--brand-line)] rounded-md p-3 text-sm file:mr-3 file:rounded file:border-0 file:bg-[var(--brand-ink)] file:px-3 file:py-1.5 file:text-white file:font-bold"
          />
          <p className="mt-1 text-xs text-[var(--brand-slate)]">
            A training certificate, medical certificate, licence, ID, passport or
            permit. PDF or a photo, up to 15 MB. Word documents cannot be read.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!file || reading}
            className="inline-flex items-center gap-2 bg-[var(--brand-red)] hover:bg-[var(--brand-red-deep)] disabled:opacity-50 text-white px-6 py-3 rounded-md font-bold transition"
          >
            <ScanLine size={16} />
            {reading ? "Reading the document..." : "Read document"}
          </button>
          <Link
            href={
              lockedEmployee
                ? `/${slug}/hr/certifications/new?employee=${lockedEmployee.id}`
                : `/${slug}/hr/certifications/new`
            }
            className="text-sm font-bold text-[var(--brand-slate)] hover:text-[var(--brand-ink)]"
          >
            Type it in by hand instead
          </Link>
        </div>
      </form>
    );
  }

  const x = draft.extracted;
  const isIdentity = isIdentityKind(x.document_kind);

  return (
    <form onSubmit={onSave} className="space-y-6">
      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 justify-between border-b border-[var(--brand-line)] pb-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full border bg-[var(--brand-ink)] border-[var(--brand-ink)] text-white">
            {isIdentity ? <BookUser size={11} /> : <FileBadge size={11} />}
            {DOCUMENT_KIND_LABEL[x.document_kind]}
          </span>
          <span
            className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full border ${
              x.confidence === "high"
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : x.confidence === "medium"
                  ? "bg-amber-50 border-amber-200 text-amber-800"
                  : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            {x.confidence} confidence
          </span>
          {x.issuer ? (
            <span className="text-[var(--brand-slate)]">Issued by {x.issuer}</span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--brand-slate)] hover:text-[var(--brand-ink)]"
        >
          <RotateCcw size={12} />
          Read a different file
        </button>
      </div>

      {isIdentity ? (
        <p className="text-sm bg-[var(--brand-cream)] border border-[var(--brand-line)] rounded-md px-4 py-3">
          This is an identity document, so saving updates who this person is
          rather than creating a certification. The scan is kept in a separate
          store that only owners and admins can open.
        </p>
      ) : null}

      {draft.warnings.length > 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-3">
          <p className="text-xs uppercase tracking-widest font-bold text-amber-800 flex items-center gap-1.5">
            <AlertTriangle size={12} />
            Check these
          </p>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {draft.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {x.notes ? (
        <p className="text-sm text-[var(--brand-slate)] italic">{x.notes}</p>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-sm uppercase tracking-widest font-bold text-[var(--brand-slate)]">
          Person
        </h3>

        {draft.employeeMatch && !lockedEmployee ? (
          <Choice
            checked={employeeMode === "match"}
            onChange={() => {
              setEmployeeMode("match");
              setExistingEmployeeId(draft.employeeMatch!.id);
            }}
            icon={<UserCheck size={14} />}
            title={`${draft.employeeMatch.surname}, ${draft.employeeMatch.names}`}
            subtitle={`${draft.employeeMatch.id_number}. ${draft.employeeMatch.reason}`}
          />
        ) : null}

        <Choice
          checked={employeeMode === "new"}
          onChange={() => setEmployeeMode("new")}
          icon={<UserPlus size={14} />}
          title="Add this person to the register"
          subtitle="Creates a new employee from the details read off the document."
        />

        <Choice
          checked={employeeMode === "existing"}
          onChange={() => setEmployeeMode("existing")}
          icon={<UserCheck size={14} />}
          title="Pick someone already on the register"
          subtitle="Use when the document belongs to a person the reader did not match."
        />

        {employeeMode === "existing" ? (
          <select
            value={existingEmployeeId}
            onChange={(e) => setExistingEmployeeId(e.target.value)}
            required
            className="w-full border border-[var(--brand-line)] rounded-md p-3 bg-white text-sm"
          >
            <option value="">Choose an employee</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.surname}, {emp.names} ({emp.id_number})
              </option>
            ))}
          </select>
        ) : null}

        {employeeMode === "new" ? (
          <div className="border border-[var(--brand-line)] rounded-xl p-4 space-y-4 bg-[var(--brand-cream)]/40">
            <div className="grid sm:grid-cols-2 gap-4">
              <Text label="Surname" value={surname} onChange={setSurname} required />
              <Text label="Names" value={names} onChange={setNames} required />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Site</Label>
                <input
                  type="text"
                  value={site}
                  onChange={(e) => setSite(e.target.value)}
                  list="scan-sites"
                  className="mt-1 w-full border border-[var(--brand-line)] rounded-md p-3 text-sm"
                />
                <datalist id="scan-sites">
                  {sites.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
              <Text label="Designation" value={designation} onChange={setDesignation} />
            </div>
          </div>
        ) : null}
      </section>

      {isIdentity || employeeMode === "new" ? (
        <section className="space-y-3">
          <h3 className="text-sm uppercase tracking-widest font-bold text-[var(--brand-slate)]">
            Identification
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label required>Document type</Label>
              <select
                value={idType}
                onChange={(e) => setIdType(e.target.value as IdType)}
                className="mt-1 w-full border border-[var(--brand-line)] rounded-md p-3 bg-white text-sm"
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
                value={idCountry}
                onChange={(e) => setIdCountry(e.target.value)}
                className="mt-1 w-full border border-[var(--brand-line)] rounded-md p-3 bg-white text-sm"
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
            <Text
              label="Document number"
              value={idNumber}
              onChange={setIdNumber}
              required
              mono
            />
            <div>
              <Label>Document expiry</Label>
              <input
                type="date"
                value={idExpiry}
                onChange={(e) => setIdExpiry(e.target.value)}
                className="mt-1 w-full border border-[var(--brand-line)] rounded-md p-3 text-sm"
              />
              <p className="mt-1 text-xs text-[var(--brand-slate)]">
                {idType === "sa_id"
                  ? "South African IDs do not expire. Leave this blank."
                  : "A lapsed permit stops this person at the gate."}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {!isIdentity ? (
        <section className="space-y-3">
          <h3 className="text-sm uppercase tracking-widest font-bold text-[var(--brand-slate)]">
            Certification
          </h3>
          <div>
            <Label required>Training type</Label>
            <select
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
              className="mt-1 w-full border border-[var(--brand-line)] rounded-md p-3 bg-white text-sm"
            >
              <option value="">
                {newTypeName ? `Add new type: ${newTypeName}` : "Choose a training type"}
              </option>
              {trainingTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {!typeId ? (
              <div className="mt-2">
                <Text
                  label="New training type name"
                  value={newTypeName}
                  onChange={setNewTypeName}
                  required
                />
                <p className="mt-1 text-xs text-[var(--brand-slate)]">
                  Read off the document as{" "}
                  <span className="font-mono">{x.training_type ?? "nothing"}</span>.
                  Saving adds it to this workspace&rsquo;s catalogue.
                </p>
              </div>
            ) : null}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Training date</Label>
              <input
                type="date"
                value={trainingDate}
                onChange={(e) => setTrainingDate(e.target.value)}
                className="mt-1 w-full border border-[var(--brand-line)] rounded-md p-3 text-sm"
              />
            </div>
            <div>
              <Label>Expiry date</Label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="mt-1 w-full border border-[var(--brand-line)] rounded-md p-3 text-sm"
              />
            </div>
          </div>

          {x.certificate_number ? (
            <p className="text-xs text-[var(--brand-slate)]">
              Certificate number read:{" "}
              <span className="font-mono">{x.certificate_number}</span>. Certly does
              not store this yet.
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-[var(--brand-line)]">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 bg-[var(--brand-red)] hover:bg-[var(--brand-red-deep)] disabled:opacity-60 text-white px-6 py-3 rounded-md font-bold transition"
        >
          <Save size={16} />
          {saving
            ? "Saving..."
            : isIdentity
              ? "Confirm and update the person"
              : "Confirm and save"}
        </button>
        <span className="text-xs text-[var(--brand-slate)]">
          Nothing has been written yet.
        </span>
      </div>
    </form>
  );
}

function Choice({
  checked,
  onChange,
  icon,
  title,
  subtitle,
}: {
  checked: boolean;
  onChange: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <label
      className={`flex items-start gap-3 border rounded-xl p-3 cursor-pointer transition ${
        checked
          ? "border-[var(--brand-red)] bg-[var(--brand-red)]/5"
          : "border-[var(--brand-line)] hover:border-[var(--brand-ink)]"
      }`}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="mt-1"
        name="employee-mode"
      />
      <span>
        <span className="flex items-center gap-1.5 font-bold text-sm">
          {icon}
          {title}
        </span>
        <span className="block text-xs text-[var(--brand-slate)] mt-0.5">
          {subtitle}
        </span>
      </span>
    </label>
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

function Text({
  label,
  value,
  onChange,
  required,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  mono?: boolean;
}) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className={`mt-1 w-full border border-[var(--brand-line)] rounded-md p-3 text-sm ${
          mono ? "font-mono" : ""
        }`}
      />
    </div>
  );
}
