import Link from "next/link";
import { CertlyMark } from "@/components/CertlyMark";
import WorkspaceNav from "./WorkspaceNav";
import { requireTenant } from "@/lib/tenant";
import { isOwner } from "@/lib/auth/roles";
import { getBillingState } from "@/lib/billing/access";
import { sectorProfile } from "@/lib/sector";
import BillingBanner from "@/components/BillingBanner";

/**
 * The workspace frame. The masthead carries the same condensed uppercase
 * navigation and red rule as the marketing site, and a form-reference strip
 * under it names the workspace, the sector and the plan, so a screenshot of
 * any page says whose it is and which world it belongs to.
 */
export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ org: string }>;
}) {
  const { org: slug } = await params;
  const ctx = await requireTenant(slug);
  const billing = await getBillingState(ctx.org.id);
  const profile = sectorProfile(ctx.org.sector);
  const base = `/${ctx.org.slug}/hr`;

  return (
    <div className="min-h-screen">
      <BillingBanner slug={ctx.org.slug} state={billing} />
      <header className="bg-white border-b-2 border-[var(--brand-ink)] print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap md:flex-nowrap items-center justify-between gap-x-4 gap-y-2">
          <Link href={base} className="flex items-center gap-2 shrink-0">
            <CertlyMark size={26} />
            <span
              className="text-2xl tracking-tight"
              style={{ fontFamily: "Anton, 'Arial Narrow', Impact, sans-serif", textTransform: "uppercase" }}
            >
              Certly
            </span>
          </Link>
          <WorkspaceNav base={base} owner={isOwner(ctx.role)} />
        </div>
        <div className="border-t border-[var(--brand-line)] bg-[var(--brand-cream)]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--brand-slate)]">
            <span>
              <span className="text-[var(--brand-ink)] font-bold">{ctx.org.name}</span>
              {" · "}
              {profile.label}
              {" · "}
              {ctx.role}
            </span>
            <span>
              {billing.state === "exempt"
                ? "Internal, not billed"
                : ctx.org.plan === "trial"
                  ? billing.daysLeft !== null
                    ? `Trial, ${billing.daysLeft} days left`
                    : "Trial"
                  : "Subscribed"}
              {" · "}
              certly.co.za/{ctx.org.slug}
            </span>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
