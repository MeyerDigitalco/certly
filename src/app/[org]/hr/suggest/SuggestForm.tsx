"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { Send, Check } from "lucide-react";
import { sendSuggestion } from "./actions";
import { MAX_LENGTH, MIN_LENGTH } from "./limits";

export default function SuggestForm({ orgId }: { orgId: string }) {
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    const form = new FormData();
    form.set("orgId", orgId);
    form.set("body", body);
    form.set("context", pathname);
    startTransition(async () => {
      const result = await sendSuggestion(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBody("");
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-5">
        <p className="flex items-center gap-2 font-bold text-emerald-900">
          <Check size={16} /> Sent. Thank you.
        </p>
        <p className="mt-1 text-sm text-emerald-900">
          It goes straight to the person who builds Certly, with your address
          on it, so you may get a reply.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-4 text-sm font-bold underline"
        >
          Send another
        </button>
      </div>
    );
  }

  const remaining = MAX_LENGTH - body.length;

  return (
    <form onSubmit={submit} className="space-y-3">
      {error ? (
        <p className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 text-sm">
          {error}
        </p>
      ) : null}

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, MAX_LENGTH))}
        rows={7}
        required
        placeholder="What is slow, what is missing, or what you expected to find and did not."
        className="w-full border border-[var(--brand-line)] rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[var(--brand-ink)] transition"
      />

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-[var(--brand-slate)]">
          {remaining < 200
            ? `${remaining} characters left`
            : "No ticket number, no form. It is read by a person."}
        </p>
        <button
          type="submit"
          disabled={pending || body.trim().length < MIN_LENGTH}
          className="inline-flex items-center gap-2 bg-[var(--brand-red)] hover:bg-[var(--brand-red-deep)] disabled:opacity-50 text-white px-5 py-2.5 rounded-md font-bold text-sm transition shrink-0"
        >
          <Send size={14} />
          {pending ? "Sending..." : "Send suggestion"}
        </button>
      </div>
    </form>
  );
}
