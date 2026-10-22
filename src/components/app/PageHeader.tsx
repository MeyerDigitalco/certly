import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * The header every in-app page starts with: a red tracked kicker, a heavy
 * title, one sentence of lede, optional back link and optional actions on
 * the right. It is the same shape the marketing site uses, so the app and
 * the brochure read as one product rather than two.
 */
export default function PageHeader({
  kicker,
  title,
  lede,
  back,
  actions,
}: {
  kicker: string;
  title: string;
  lede?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
}) {
  return (
    <header className="pb-6 border-b-2 border-[var(--brand-ink)]">
      {back ? (
        <Link
          href={back.href}
          className="text-[var(--brand-red)] text-xs font-bold inline-flex items-center gap-1 mb-3 print:hidden"
        >
          <ArrowLeft size={12} /> {back.label}
        </Link>
      ) : null}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--brand-red)] font-bold font-mono">
            {kicker}
          </p>
          <h1 className="mt-2 text-3xl md:text-4xl font-black tracking-tight leading-[1.05]">
            {title}
          </h1>
          {lede ? <p className="mt-2 text-[var(--brand-slate)] max-w-2xl">{lede}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2 shrink-0 print:hidden">{actions}</div> : null}
      </div>
    </header>
  );
}
