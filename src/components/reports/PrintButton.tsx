"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 border border-[var(--brand-line)] hover:border-[var(--brand-ink)] px-4 py-2 rounded-md text-sm font-bold transition print:hidden"
    >
      <Printer size={14} />
      Print
    </button>
  );
}
