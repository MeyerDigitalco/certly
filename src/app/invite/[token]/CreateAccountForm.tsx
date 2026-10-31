"use client";

import { useState, useTransition } from "react";
import PasswordInput from "@/components/PasswordInput";
import { createInvitedAccount } from "./create-account";

export default function CreateAccountForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    const form = new FormData(event.currentTarget);
    form.set("token", token);
    startTransition(async () => {
      const result = await createInvitedAccount(form);
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? (
        <p className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 text-sm">
          {error}
        </p>
      ) : null}

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-[var(--brand-slate)]">
          Email
        </label>
        <p className="mt-1 text-sm font-medium break-all">{email}</p>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-[var(--brand-slate)]">
          Choose a password
        </label>
        <div className="mt-1">
          <PasswordInput
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="At least 8 characters"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-[var(--brand-slate)]">
          Confirm password
        </label>
        <div className="mt-1">
          <PasswordInput
            name="confirm"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="Type it again"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-[var(--brand-red)] hover:bg-[var(--brand-red-deep)] disabled:opacity-60 text-white px-6 py-3 rounded-md font-bold transition"
      >
        {pending ? "Creating your account..." : "Create account and continue"}
      </button>
    </form>
  );
}
