"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState, useEffect } from "react";
import { Search, X } from "lucide-react";

/**
 * Client-side filter bar for the register. Uses URL search params as the
 * source of truth so filtered views are shareable and bookmarkable.
 */
export default function RegisterFilters({
  slug,
  sites,
  trainingTypes,
}: {
  slug: string;
  sites: string[];
  trainingTypes: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [search, setSearch] = useState(params.get("search") ?? "");
  const site = params.get("site") ?? "";
  const trainingType = params.get("training") ?? "";

  // Debounce search, 250ms after the user stops typing, then push to URL.
  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (search) next.set("search", search);
      else next.delete("search");
      startTransition(() => router.push(`/${slug}/hr/register?${next.toString()}`));
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.push(`/${slug}/hr/register?${next.toString()}`));
  }

  function clearAll() {
    setSearch("");
    startTransition(() => router.push(`/${slug}/hr/register`));
  }

  const hasAny = search || site || trainingType || params.get("status");

  return (
    <div className="bg-white border border-[var(--brand-line)] rounded-2xl p-4 flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[240px]">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--brand-slate)]"
        />
        <input
          type="search"
          placeholder="Search by name, surname or document number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 border border-[var(--brand-line)] rounded-md focus:outline-none focus:border-[var(--brand-red)]"
        />
      </div>
      <select
        value={site}
        onChange={(e) => setParam("site", e.target.value)}
        className="border border-[var(--brand-line)] rounded-md py-2.5 px-3 bg-white text-sm"
      >
        <option value="">All sites</option>
        {sites.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <select
        value={trainingType}
        onChange={(e) => setParam("training", e.target.value)}
        className="border border-[var(--brand-line)] rounded-md py-2.5 px-3 bg-white text-sm"
      >
        <option value="">All training types</option>
        {trainingTypes.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      {hasAny ? (
        <button
          onClick={clearAll}
          className="inline-flex items-center gap-1 text-xs font-bold text-[var(--brand-slate)] hover:text-[var(--brand-red)] transition"
        >
          <X size={12} />
          Clear
        </button>
      ) : null}
      {pending ? (
        <span className="text-xs text-[var(--brand-slate)]">Loading...</span>
      ) : null}
    </div>
  );
}
