import Link from "next/link";
import { Flame, LogOut, Settings, Users, Home } from "lucide-react";
import { requireTenant } from "@/lib/tenant";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ org: string }>;
}) {
  const { org: slug } = await params;
  const ctx = await requireTenant(slug);

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-[var(--brand-line)]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <Flame className="text-[var(--brand-red)]" size={20} />
              <span className="font-black text-lg tracking-tight">Certly</span>
            </Link>
            <div className="hidden md:block h-6 w-px bg-[var(--brand-line)]" />
            <span className="hidden md:inline text-sm font-bold text-[var(--brand-ink)]">
              {ctx.org.name}
            </span>
          </div>
          <nav className="flex items-center gap-1 text-sm">
            <NavLink href={`/${ctx.org.slug}/hr`} icon={Home}>Register</NavLink>
            <NavLink href={`/${ctx.org.slug}/hr/employees`} icon={Users}>Employees</NavLink>
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
