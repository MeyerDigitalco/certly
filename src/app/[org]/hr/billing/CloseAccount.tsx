"use client";

import { useState, useTransition } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { closeAccount } from "./close-account";

export default function CloseAccount({
  orgId,
  orgName,
  orgSlug,
  seats,
}: {
  orgId: string;
  orgName: string;
  orgSlug: string;
  seats: number;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await closeAccount(form);
      if (result && !result.ok) setError(result.error);
    });
  }

  if (!open) {
    return (
      <section className="border border-red-200 rounded-2xl p-6">
        <h2 className="text-lg font-black text-red-900">Close this workspace</h2>
        <p className="mt-1 text-sm text-[var(--brand-slate)] max-w-2xl">
          Deletes {orgName} and everything in it: every person on the register,
          every certificate, every identity copy, every company document, and
          every file. It cannot be undone and we keep no copy. Export what you
          need first.
        </p>
        <button
          onClick={() => setOpen(true)}
          className="mt-4 inline-flex items-center gap-2 border border-red-300 text-red-800 hover:bg-red-50 px-4 py-2 rounded-md text-sm font-bold transition"
        >
          <Trash2 size={14} />
          Close workspace
        </button>
      </section>
    );
  }

  return (
    <section className="bg-red-50 border border-red-300 rounded-2xl p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle size={20} className="text-red-700 mt-0.5 shrink-0" />
        <div className="flex-1">
          <h2 className="text-lg font-black text-red-900">
            This deletes everything
          </h2>
          <p className="mt-1 text-sm text-red-900 max-w-2xl">
            {seats} {seats === 1 ? "person" : "people"} on the register, their
            certificates, their identity documents and your company documents
            are all destroyed. Nothing is archived. If anyone might need a
            safety file pack from this data, build it before you continue.
          </p>

          {error ? (
            <p className="mt-4 bg-white border border-red-300 text-red-800 rounded-md px-3 py-2 text-sm">
              {error}
            </p>
          ) : null}

          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            <input type="hidden" name="orgId" value={orgId} />
            <input type="hidden" name="expected" value={orgSlug} />
            <label className="block text-xs uppercase tracking-widest font-bold text-red-900">
              Type {orgSlug} to confirm
            </label>
            <input
              type="text"
              name="confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="w-full max-w-xs border border-red-300 rounded-md p-3 text-sm font-mono bg-white"
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={pending || typed !== orgSlug}
                className="inline-flex items-center gap-2 bg-red-700 hover:bg-red-800 disabled:opacity-40 text-white px-5 py-2.5 rounded-md font-bold text-sm transition"
              >
                <Trash2 size={14} />
                {pending ? "Deleting..." : "Delete everything permanently"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setTyped("");
                  setError(null);
                }}
                className="text-sm font-bold text-red-900 hover:underline"
              >
                Keep my workspace
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
