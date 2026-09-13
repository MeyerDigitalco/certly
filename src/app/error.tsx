"use client";

import Link from "next/link";
import { CertlyMark } from "@/components/CertlyMark";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 justify-center">
          <CertlyMark size={26} />
          <span className="font-black text-xl tracking-tight">Certly</span>
        </div>
        <div className="mt-6 bg-white border border-[var(--brand-line)] rounded-2xl p-8">
          <h1 className="text-2xl font-black">Something broke on our side</h1>
          <p className="mt-2 text-sm text-[var(--brand-slate)]">
            Your data is intact. Nothing was saved from the screen you were on.
            Try again, and if it keeps happening send us the reference below.
          </p>
          {error.digest ? (
            <p className="mt-4 font-mono text-xs text-[var(--brand-slate)] bg-[var(--brand-cream)] border border-[var(--brand-line)] rounded-md px-3 py-2 select-all">
              Reference {error.digest}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={reset}
              className="bg-[var(--brand-red)] hover:bg-[var(--brand-red-deep)] text-white px-5 py-2.5 rounded-md font-bold text-sm transition"
            >
              Try again
            </button>
            <Link
              href="/"
              className="text-sm font-bold text-[var(--brand-ink)] hover:text-[var(--brand-red)]"
            >
              Back to start
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
