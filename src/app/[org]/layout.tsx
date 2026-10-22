import Link from "next/link";
import {
  LogOut,
  Settings,
  Users,
  LayoutDashboard,
  ListChecks,
  CalendarClock,
  MapPin,
  FileText,
  FolderLock,
  CreditCard,
  ScrollText,
  BarChart3,
} from "lucide-react";
import { CertlyMark } from "@/components/CertlyMark";
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
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <Link href={base} className="flex items-center gap-2 shrink-0">
            <CertlyMark size={26} />
            <span
              className="text-2xl tracking-tight"
              style={{ fontFamily: "Anton, 'Arial Narrow', Impact, sans-serif", textTransform: "uppercase" }}
            >
              Certly
            </span>
          </Link>
          <nav className="flex flex-wrap items-center justify-end gap-x-1 gap-y-1">
            <NavLink href={base} icon={LayoutDashboard}>Overview</NavLink>
            <NavLink href={`${base}/register`} icon={ListChecks}>Register</NavLink>
            <NavLink href={`${base}/employees`} icon={Users}>People</NavLink>
            <NavLink href={`${base}/renewals`} icon={CalendarClock}>Renewals</NavLink>
            <NavLink href={`${base}/sites`} icon={MapPin}>Sites</NavLink>
            <NavLink href={`${base}/documents`} icon={FolderLock}>Documents</NavLink>
            <NavLink href={`${base}/safety-file`} icon={FileText}>Safety file</NavLink>
            <NavLink href={`${base}/reports`} icon={BarChart3}>Reports</NavLink>
            {isOwner(ctx.role) ? (
              <>
                <NavLink href={`${base}/audit`} icon={ScrollText}>Activity</NavLink>
                <NavLink href={`${base}/billing`} icon={CreditCard}>Billing</NavLink>
              </>
            ) : null}
            <NavLink href={`${base}/settings`} icon={Settings}>Settings</NavLink>
            <form action="/logout" method="post" className="ml-1">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] font-bold text-[var(--brand-slate)] hover:text-[var(--brand-red)] px-2 py-1.5 transition"
                style={{ fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif" }}
              >
                <LogOut size={12} /> Sign out
              </button>
            </form>
          </nav>
        </div>
        <div className="border-t border-[var(--brand-line)] bg-[var(--brand-cream)]">
          <div className="max-w-6xl mx-auto px-6 py-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--brand-slate)]">
            <span>
              <span className="text-[var(--brand-ink)] font-bold">{ctx.org.name}</span>
              {" · "}
              {profile.label}
              {" · "}
              {ctx.role}
            </span>
            <span>
              {ctx.org.plan === "trial"
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
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}

function NavLink({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: typeof LayoutDashboard;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-[12px] uppercase tracking-[0.12em] font-bold text-[var(--brand-ink)] hover:text-[var(--brand-red)] px-2.5 py-1.5 transition"
      style={{ fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif" }}
    >
      <Icon size={12} />
      {children}
    </Link>
  );
}
