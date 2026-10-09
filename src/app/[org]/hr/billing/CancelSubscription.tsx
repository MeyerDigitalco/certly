"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { XCircle, AlertTriangle } from "lucide-react";
import { cancelOwnSubscription } from "./cancel";

export default function CancelSubscription({
  orgId,
  slug,
  periodEnd,
}: {
  orgId: string;
  slug: string;
  periodEnd: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const until = periodEnd
    ? new Date(periodEnd).toLocaleDateString("en-ZA", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  function onCancel() {
    setError(null);
    const form = new FormData();
    form.set("orgId", orgId);
    form.set("slug", slug);
    startTransition(async () => {
      const result = await cancelOwnSubscription(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setWarning(result.warning);
      setOpen(false);
      router.refresh();
    });
  }

  if (warning) {
    return (
      <div className="mt-4 bg-amber-50 border border-amber-300 rounded-md px-4 py-3 text-sm text-amber-900 flex items-start gap-2">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <span>{warning}</span>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="mt-4">
        {error ? (
          <p className="mb-3 text-sm text-red-700">{error}</p>
        ) : null}
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 text-sm font-bold text-[var(--brand-slate)] hover:text-red-700 transition"
        >
          <XCircle size={14} />
          Cancel subscription
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 border border-[var(--brand-line)] rounded-xl p-4">
      <p className="text-sm font-bold">Cancel this subscription?</p>
      <p className="mt-1 text-sm text-[var(--brand-slate)]">
        No further debit order is taken.
        {until
          ? ` You keep full use of the workspace until ${until}, then it becomes read only.`
          : " You keep full use until the end of the month you have paid for, then the workspace becomes read only."}{" "}
        Nothing is deleted and you can subscribe again at any time.
      </p>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={onCancel}
          disabled={pending}
          className="inline-flex items-center gap-2 border border-red-300 text-red-800 hover:bg-red-50 disabled:opacity-50 px-4 py-2 rounded-md text-sm font-bold transition"
        >
          <XCircle size={14} />
          {pending ? "Cancelling..." : "Yes, cancel it"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="text-sm font-bold text-[var(--brand-slate)] hover:text-[var(--brand-ink)]"
        >
          Keep my subscription
        </button>
      </div>
    </div>
  );
}
