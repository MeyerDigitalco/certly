import Link from "next/link";
import { AlertTriangle, Clock, CircleCheck, MinusCircle } from "lucide-react";
import type { CertStatus } from "@/lib/types/database";

/**
 * Four KPI tiles at the top of the register. Click any tile to filter
 * the table below by that status. A tile that is already active clears
 * the filter.
 */
export default function KpiCards({
  slug,
  counts,
  active,
}: {
  slug: string;
  counts: Record<CertStatus, number>;
  active?: CertStatus | "all";
}) {
  const cards: Array<{
    status: CertStatus;
    label: string;
    hint: string;
    icon: typeof Clock;
    valueColour: string;
    borderActive: string;
  }> = [
    {
      status: "expired",
      label: "Expired",
      hint: "Renewal required immediately",
      icon: AlertTriangle,
      valueColour: "text-red-600",
      borderActive: "border-red-400",
    },
    {
      status: "due_soon",
      label: "Due soon",
      hint: "Renew within the due-soon window",
      icon: Clock,
      valueColour: "text-amber-600",
      borderActive: "border-amber-400",
    },
    {
      status: "valid",
      label: "Valid",
      hint: "In date and on file",
      icon: CircleCheck,
      valueColour: "text-emerald-600",
      borderActive: "border-emerald-400",
    },
    {
      status: "no_expiry",
      label: "No expiry",
      hint: "Once-off (e.g. inductions)",
      icon: MinusCircle,
      valueColour: "text-slate-500",
      borderActive: "border-slate-400",
    },
  ];

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => {
        const isActive = active === c.status;
        return (
          <Link
            key={c.status}
            href={
              isActive
                ? `/${slug}/hr/register`
                : `/${slug}/hr/register?${new URLSearchParams({ status: c.status })}`
            }
            className={`block bg-white border-2 rounded-2xl p-5 transition hover:shadow-md ${
              isActive ? c.borderActive : "border-[var(--brand-line)]"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-widest font-bold text-[var(--brand-slate)]">
                {c.label}
              </p>
              <c.icon size={16} className={c.valueColour} />
            </div>
            <p className={`mt-3 text-4xl font-black ${c.valueColour}`}>
              {counts[c.status]}
            </p>
            <p className="mt-1 text-xs text-[var(--brand-slate)]">{c.hint}</p>
          </Link>
        );
      })}
      <p className="sr-only">{total} certifications in total.</p>
    </section>
  );
}
