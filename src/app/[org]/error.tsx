"use client";

export default function OrgError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="bg-white border border-[var(--brand-line)] rounded-2xl p-10 max-w-2xl">
      <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--brand-red)] font-bold">
        This screen did not load
      </p>
      <h1 className="mt-2 text-3xl font-black">Something broke on our side</h1>
      <p className="mt-3 text-[var(--brand-slate)]">
        Your register is untouched. Nothing on this screen was saved. Try again,
        and if it keeps happening send us the reference below.
      </p>
      {error.digest ? (
        <p className="mt-4 font-mono text-xs text-[var(--brand-slate)] bg-[var(--brand-cream)] border border-[var(--brand-line)] rounded-md px-3 py-2 select-all inline-block">
          Reference {error.digest}
        </p>
      ) : null}
      <div className="mt-6">
        <button
          onClick={reset}
          className="bg-[var(--brand-red)] hover:bg-[var(--brand-red-deep)] text-white px-5 py-2.5 rounded-md font-bold text-sm transition"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
