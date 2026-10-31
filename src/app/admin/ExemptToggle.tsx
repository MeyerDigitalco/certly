"use client";

import { useState, useTransition } from "react";
import { setBillingExempt } from "./actions";

export default function ExemptToggle({
  orgId,
  exempt,
}: {
  orgId: string;
  exempt: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  function toggle() {
    setError(false);
    const form = new FormData();
    form.set("orgId", orgId);
    form.set("exempt", exempt ? "0" : "1");
    startTransition(async () => {
      const result = await setBillingExempt(form);
      if (!result.ok) setError(true);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={
        exempt
          ? "Start billing this workspace again"
          : "Never bill this workspace"
      }
      className={`rounded-sm px-2 py-0.5 text-[11px] font-bold transition disabled:opacity-50 ${
        error
          ? "bg-red-50 text-red-700"
          : exempt
            ? "bg-[var(--brand-ink)] text-white"
            : "border border-[var(--brand-line)] text-[var(--brand-slate)] hover:border-[var(--brand-ink)]"
      }`}
    >
      {error ? "Failed" : pending ? "..." : exempt ? "Not billed" : "Bill"}
    </button>
  );
}
