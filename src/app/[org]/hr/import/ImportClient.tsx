"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  AlertTriangle,
  AlertCircle,
  Check,
  Download,
  ArrowRight,
} from "lucide-react";
import {
  countIssues,
  IMPORT_TEMPLATE,
  IMPORT_COLUMNS,
  type ImportPlan,
} from "@/lib/hr/import";
import { previewImport, commitImport } from "./actions";

export default function ImportClient({
  orgId,
  slug,
}: {
  orgId: string;
  slug: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [done, setDone] = useState<{
    people: number;
    certificates: number;
    types: number;
  } | null>(null);

  function onPreview(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPlan(null);
    setDone(null);
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await previewImport(orgId, form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPlan(result.plan);
    });
  }

  function onCommit() {
    if (!formRef.current) return;
    setError(null);
    const form = new FormData(formRef.current);
    startTransition(async () => {
      const result = await commitImport(orgId, slug, form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone({
        people: result.people,
        certificates: result.certificates,
        types: result.types,
      });
      setPlan(null);
      formRef.current?.reset();
      router.refresh();
    });
  }

  function downloadTemplate() {
    const blob = new Blob([IMPORT_TEMPLATE], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "certly-import-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const counts = plan ? countIssues(plan) : { errors: 0, warnings: 0 };

  return (
    <div className="space-y-6">
      {error ? (
        <p className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 text-sm">
          {error}
        </p>
      ) : null}

      {done ? (
        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-6">
          <p className="font-black text-emerald-900 flex items-center gap-2">
            <Check size={16} /> Imported
          </p>
          <p className="mt-1 text-sm text-emerald-900">
            {done.people} new {done.people === 1 ? "person" : "people"},{" "}
            {done.certificates}{" "}
            {done.certificates === 1 ? "certificate" : "certificates"}
            {done.types > 0
              ? `, and ${done.types} new training ${done.types === 1 ? "type" : "types"}`
              : ""}
            .
          </p>
          <a
            href={`/${slug}/hr`}
            className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-emerald-900 hover:underline"
          >
            Open the register <ArrowRight size={14} />
          </a>
        </div>
      ) : null}

      <section className="bg-white border border-[var(--brand-line)] rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="font-black">1. Start from the template</h2>
          <p className="mt-1 text-sm text-[var(--brand-slate)]">
            Columns can be in any order. Surname, names and ID number are
            required; everything else is optional. Dates are read day first, so
            10/02/2026 is the tenth of February.
          </p>
          <button
            onClick={downloadTemplate}
            className="mt-3 inline-flex items-center gap-2 border border-[var(--brand-line)] hover:border-[var(--brand-ink)] px-4 py-2 rounded-md text-sm font-bold transition"
          >
            <Download size={14} /> Download the template
          </button>
        </div>

        <details className="text-sm">
          <summary className="cursor-pointer font-bold text-[var(--brand-slate)]">
            What each column means
          </summary>
          <ul className="mt-2 space-y-1">
            {IMPORT_COLUMNS.map((c) => (
              <li key={c.key} className="text-[var(--brand-slate)]">
                <span className="font-mono text-xs text-[var(--brand-ink)]">
                  {c.key}
                </span>{" "}
                {c.label}
                {c.required ? (
                  <span className="text-[var(--brand-red)] font-bold">
                    {" "}
                    required
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      </section>

      <form
        ref={formRef}
        onSubmit={onPreview}
        className="bg-white border border-[var(--brand-line)] rounded-2xl p-6 space-y-4"
      >
        <h2 className="font-black">2. Check what will happen</h2>
        <p className="text-sm text-[var(--brand-slate)]">
          Nothing is saved until you confirm. Rows with a problem are listed and
          skipped; the rest still import.
        </p>
        <input
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          className="w-full border border-[var(--brand-line)] rounded-md p-3 text-sm file:mr-3 file:rounded file:border-0 file:bg-[var(--brand-ink)] file:px-3 file:py-1.5 file:text-white file:font-bold"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 border border-[var(--brand-ink)] hover:bg-[var(--brand-ink)] hover:text-white disabled:opacity-60 px-5 py-2.5 rounded-md font-bold text-sm transition"
        >
          <Upload size={14} />
          {pending ? "Reading..." : "Check the file"}
        </button>
      </form>

      {plan ? (
        <section className="bg-white border border-[var(--brand-line)] rounded-2xl p-6 space-y-4">
          <h2 className="font-black">3. Confirm</h2>

          {plan.fatal ? (
            <p className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 text-sm">
              {plan.fatal}
            </p>
          ) : plan.missingColumns.length > 0 ? (
            <p className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 text-sm">
              That file is missing these required columns:{" "}
              {plan.missingColumns.join(", ")}.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Rows read" value={plan.rows.length} />
                <Stat label="Will import" value={plan.validRows.length} />
                <Stat
                  label="New people"
                  value={plan.newPeople}
                />
                <Stat
                  label="Skipped"
                  value={plan.rows.length - plan.validRows.length}
                  tone={counts.errors > 0 ? "bad" : undefined}
                />
              </div>

              {plan.newTrainingTypes.length > 0 ? (
                <p className="text-sm text-[var(--brand-slate)]">
                  These training types will be created:{" "}
                  <span className="font-bold text-[var(--brand-ink)]">
                    {plan.newTrainingTypes.join(", ")}
                  </span>
                </p>
              ) : null}

              {counts.errors + counts.warnings > 0 ? (
                <div className="border border-[var(--brand-line)] rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {plan.rows
                        .filter((r) => r.issues.length > 0)
                        .map((row) =>
                          row.issues.map((issue, i) => (
                            <tr
                              key={`${row.line}-${i}`}
                              className="border-b border-[var(--brand-line)] last:border-0"
                            >
                              <td className="px-3 py-2 w-16 font-mono text-xs text-[var(--brand-slate)] align-top">
                                Row {row.line}
                              </td>
                              <td className="px-3 py-2 align-top">
                                <span
                                  className={`inline-flex items-start gap-1.5 text-xs ${
                                    issue.severity === "error"
                                      ? "text-red-700"
                                      : "text-amber-700"
                                  }`}
                                >
                                  {issue.severity === "error" ? (
                                    <AlertCircle
                                      size={11}
                                      className="mt-0.5 shrink-0"
                                    />
                                  ) : (
                                    <AlertTriangle
                                      size={11}
                                      className="mt-0.5 shrink-0"
                                    />
                                  )}
                                  {issue.message}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-xs text-[var(--brand-slate)] align-top whitespace-nowrap">
                                {row.surname}, {row.names}
                              </td>
                            </tr>
                          )),
                        )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-emerald-800">
                  Every row reads cleanly.
                </p>
              )}

              <button
                onClick={onCommit}
                disabled={pending || plan.validRows.length === 0}
                className="inline-flex items-center gap-2 bg-[var(--brand-red)] hover:bg-[var(--brand-red-deep)] disabled:opacity-40 text-white px-5 py-2.5 rounded-md font-bold text-sm transition"
              >
                {pending
                  ? "Importing..."
                  : `Import ${plan.validRows.length} row${plan.validRows.length === 1 ? "" : "s"}`}
              </button>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "bad";
}) {
  return (
    <div className="border border-[var(--brand-line)] rounded-xl p-3">
      <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--brand-slate)]">
        {label}
      </p>
      <p
        className={`text-2xl font-black ${tone === "bad" && value > 0 ? "text-red-700" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
