"use client";

import { useState, useTransition } from "react";
import { setPassword } from "./actions";

export default function SetPasswordForm({ next }: { next?: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await setPassword(form);
      if (res && !res.ok) setError(res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}
      <input type="hidden" name="next" value={next ?? ""} />
      <div>
        <label className="text-xs uppercase tracking-widest font-bold text-[var(--brand-slate)]">
          New password
        </label>
        <input
          type="password"
          name="password"
          required
          autoComplete="new-password"
          className="mt-1 w-full border border-[var(--brand-line)] rounded-md p-3 focus:outline-none focus:border-[var(--brand-red)]"
        />
      </div>
      <div>
        <label className="text-xs uppercase tracking-widest font-bold text-[var(--brand-slate)]">
          Confirm password
        </label>
        <input
          type="password"
          name="confirm"
          required
          autoComplete="new-password"
          className="mt-1 w-full border border-[var(--brand-line)] rounded-md p-3 focus:outline-none focus:border-[var(--brand-red)]"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-[var(--brand-red)] hover:bg-[var(--brand-red-deep)] disabled:opacity-60 text-white px-6 py-3 rounded-md font-bold transition"
      >
        {pending ? "Saving..." : "Save password"}
      </button>
    </form>
  );
}
