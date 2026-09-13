import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";
import type { BillingState } from "@/lib/billing/access";

/**
 * The one place a workspace is told about its own billing.
 *
 * Silent while a subscription is healthy. During a trial it only appears in
 * the last week, because a countdown shown from day one is noise by day three.
 */
export default function BillingBanner({
  slug,
  state,
}: {
  slug: string;
  state: BillingState;
}) {
  if (state.state === "subscribed") return null;

  if (state.state === "trialing") {
    const days = state.daysLeft ?? 0;
    if (days > 7) return null;
    return (
      <div className="bg-[var(--brand-cream)] border-b border-[var(--brand-line)]">
        <div className="max-w-6xl mx-auto px-6 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <Clock size={14} className="text-[var(--brand-slate)] shrink-0" />
          <span>
            {days <= 0
              ? "Your trial ends today."
              : `Your trial ends in ${days} day${days === 1 ? "" : "s"}.`}
          </span>
          <Link
            href={`/${slug}/hr/billing`}
            className="font-bold text-[var(--brand-red)] hover:underline"
          >
            Set up payment
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-red-50 border-b border-red-200">
      <div className="max-w-6xl mx-auto px-6 py-2.5 flex flex-wrap items-start gap-x-3 gap-y-1 text-sm text-red-900">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <span className="flex-1 min-w-[280px]">
          {state.canWrite ? state.reason : `Read only. ${state.reason}`}
        </span>
        <Link
          href={`/${slug}/hr/billing`}
          className="font-bold text-red-800 hover:underline whitespace-nowrap"
        >
          Sort out billing
        </Link>
      </div>
    </div>
  );
}
