import { AlertTriangle, CircleCheck, Clock, MinusCircle } from "lucide-react";
import type { CertStatus } from "@/lib/types/database";
import { statusLabel } from "@/lib/certifications/status";

/**
 * Traffic-light status chip. Colour plus icon plus label, never colour
 * alone, so users with red/green colour vision issues can still read it.
 */
export default function StatusChip({
  status,
  daysLeft,
}: {
  status: CertStatus;
  daysLeft?: number | null;
}) {
  const meta: Record<
    CertStatus,
    { bg: string; text: string; icon: typeof Clock }
  > = {
    expired: {
      bg: "bg-red-100 border-red-200",
      text: "text-red-700",
      icon: AlertTriangle,
    },
    due_soon: {
      bg: "bg-amber-100 border-amber-200",
      text: "text-amber-800",
      icon: Clock,
    },
    valid: {
      bg: "bg-emerald-100 border-emerald-200",
      text: "text-emerald-700",
      icon: CircleCheck,
    },
    no_expiry: {
      bg: "bg-slate-100 border-slate-200",
      text: "text-slate-600",
      icon: MinusCircle,
    },
  };
  const { bg, text, icon: Icon } = meta[status];
  const label = statusLabel(status);
  const days =
    daysLeft == null
      ? null
      : status === "expired"
        ? `${Math.abs(daysLeft)}d over`
        : `${daysLeft}d`;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${bg} ${text}`}
    >
      <Icon size={12} />
      {label}
      {days ? <span className="opacity-70">{days}</span> : null}
    </span>
  );
}
