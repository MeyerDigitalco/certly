"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";

export default function PayFastForm({
  action,
  fields,
  total,
}: {
  action: string;
  fields: Array<[string, string]>;
  total: string;
}) {
  const [pending, setPending] = useState(false);

  return (
    <form
      action={action}
      method="post"
      onSubmit={() => setPending(true)}
      className="space-y-3"
    >
      {fields.map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 bg-[var(--brand-red)] hover:bg-[var(--brand-red-deep)] disabled:opacity-60 text-white px-5 py-3 rounded-md font-bold text-sm transition"
      >
        <CreditCard size={14} />
        {pending ? "Opening PayFast..." : `Set up a monthly debit of ${total}`}
      </button>
      <p className="text-xs text-[var(--brand-slate)]">
        You are taken to PayFast to authorise it. Certly never sees your card or
        bank details. The amount is recalculated each month from your headcount,
        so it changes when your register does.
      </p>
    </form>
  );
}
