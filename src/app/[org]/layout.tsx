import Link from "next/link";
import { LogOut, Settings, Users, Home, CalendarClock, MapPin, FileText, FolderLock, CreditCard, ScrollText } from "lucide-react";
import { CertlyMark } from "@/components/CertlyMark";
import { requireTenant } from "@/lib/tenant";
import { isOwner } from "@/lib/auth/roles";
import { getBillingState } from "@/lib/billing/access";
import BillingBanner from "@/components/BillingBanner";

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

  return (
    <div className="min-h-screen">
      <BillingBanner slug={ctx.org.slug} state={billing} />
      <header className="bg-white border-b border-[var(--brand-line)]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <CertlyMark size={24} />
              <span
                className="text-xl tracking-tight"
                style={{ fontFamily: "Anton, 'Arial Narrow', Impact, sans-serif", textTransform: "uppercase" }}
              >
                Certly
              </span>
            </Link>
            <div className="hidden md:block h-6 w-px bg-[var(--brand-line)]" />
            <span className="hidden md:inline text-sm font-bold text-[var(--brand-ink)]">
              {ctx.org.name}
            </span>
          </div>
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            <NavLink href={`/${ctx.org.slug}/hr`} icon={Home}>Register</NavLink>
            <NavLink href={`/${ctx.org.slug}/hr/employees`} icon={Users}>Employees</NavLink>
            <NavLink href={`/${ctx.org.slug}/hr/renewals`} icon={CalendarClock}>Renewals</NavLink>
            <NavLink href={`/${ctx.org.slug}/hr/sites`} icon={MapPin}>Sites</NavLink>
            <NavLink href={`/${ctx.org.slug}/hr/documents`} icon={FolderLock}>Documents</NavLink>
            <NavLink href={`/${ctx.org.slug}/hr/safety-file`} icon={FileText}>Safety file</NavLink>
            {isOwner(ctx.role) ? (
              <>
                <NavLink href={`/${ctx.org.slug}/hr/audit`} icon={ScrollText}>Activity</NavLink>
                <NavLink href={`/${ctx.org.slug}/hr/billing`} icon={CreditCard}>Billing</NavLink>
              </>
            ) : null}
            <NavLink href={`/${ctx.org.slug}/hr/settings`} icon={Settings}>Settings</NavLink>
            <form action="/logout" method="post" className="ml-2">
              <button type="submit"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--brand-slate)] hover:text-[var(--brand-red)] px-2 py-1.5 transition">
                <LogOut size={12} /> Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}

function NavLink({ href, icon: Icon, children }: { href: string; icon: typeof Home; children: React.ReactNode }) {
  return (
    <Link href={href}
      className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--brand-ink)] hover:text-[var(--brand-red)] px-3 py-1.5 transition">
      <Icon size={12} />
      {children}
    </Link>
  );
}
