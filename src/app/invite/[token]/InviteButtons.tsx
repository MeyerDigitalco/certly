"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { acceptInvitation, declineInvitation } from "./accept";

export default function InviteButtons({
  token,
  orgName,
}: {
  token: string;
  orgName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: typeof acceptInvitation) {
    setError(null);
    const form = new FormData();
    form.set("token", token);
    startTransition(async () => {
      const result = await action(form);
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 text-sm">
          {error}
        </p>
      ) : null}
      <button
        onClick={() => run(acceptInvitation)}
        disabled={pending}
        className="w-full inline-flex items-center justify-center gap-2 bg-[var(--brand-red)] hover:bg-[var(--brand-red-deep)] disabled:opacity-60 text-white px-6 py-3 rounded-md font-bold transition"
      >
        <Check size={14} />
        {pending ? "Joining..." : `Join ${orgName}`}
      </button>
      <button
        onClick={() => run(declineInvitation)}
        disabled={pending}
        className="w-full inline-flex items-center justify-center gap-2 border border-[var(--brand-line)] hover:border-[var(--brand-ink)] disabled:opacity-60 px-6 py-3 rounded-md font-bold text-sm transition"
      >
        <X size={14} />
        No thanks
      </button>
    </div>
  );
}
