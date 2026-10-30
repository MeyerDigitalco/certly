"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LogOut,
  Menu,
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
  X,
} from "lucide-react";

/**
 * The workspace navigation.
 *
 * Eleven destinations do not fit across a phone, and wrapping them produced
 * three ragged rows with the logo stranded in the middle of them. Below the
 * medium breakpoint they collapse behind a single control instead; from there
 * up, the masthead row is unchanged.
 *
 * This is the half of the product most likely to be used on a phone. The
 * register is consulted standing at a gate, not at a desk.
 */

type Item = { href: string; label: string; icon: typeof LayoutDashboard };

function itemsFor(base: string, owner: boolean): Item[] {
  const items: Item[] = [
    { href: base, label: "Overview", icon: LayoutDashboard },
    { href: `${base}/register`, label: "Register", icon: ListChecks },
    { href: `${base}/employees`, label: "People", icon: Users },
    { href: `${base}/renewals`, label: "Renewals", icon: CalendarClock },
    { href: `${base}/sites`, label: "Sites", icon: MapPin },
    { href: `${base}/documents`, label: "Documents", icon: FolderLock },
    { href: `${base}/safety-file`, label: "Safety file", icon: FileText },
    { href: `${base}/reports`, label: "Reports", icon: BarChart3 },
  ];
  if (owner) {
    items.push({ href: `${base}/audit`, label: "Activity", icon: ScrollText });
    items.push({ href: `${base}/billing`, label: "Billing", icon: CreditCard });
  }
  items.push({ href: `${base}/settings`, label: "Settings", icon: Settings });
  return items;
}

const CONDENSED = { fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif" };

export default function WorkspaceNav({
  base,
  owner,
}: {
  base: string;
  owner: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const items = itemsFor(base, owner);

  // Close on navigation, or the panel stays open over the page the person
  // just asked for. Adjusted during render rather than in an effect, so the
  // open menu is never committed over the new page first.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <nav className="hidden md:flex flex-wrap items-center justify-end gap-x-1 gap-y-1">
        {items.map((item) => (
          <NavLink key={item.href} href={item.href} icon={item.icon}>
            {item.label}
          </NavLink>
        ))}
        <SignOut className="ml-1" />
      </nav>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="workspace-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        className="md:hidden inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.12em] font-bold text-[var(--brand-ink)] border border-[var(--brand-ink)] rounded-md px-3 py-2"
        style={CONDENSED}
      >
        {open ? <X size={14} /> : <Menu size={14} />}
        Menu
      </button>

      {open ? (
        <div
          id="workspace-menu"
          className="md:hidden basis-full border-t border-[var(--brand-line)] pt-2 mt-1"
        >
          <ul className="flex flex-col">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center gap-2.5 text-[14px] uppercase tracking-[0.12em] font-bold text-[var(--brand-ink)] hover:text-[var(--brand-red)] py-3 border-b border-[var(--brand-line)]"
                  style={CONDENSED}
                >
                  <item.icon size={15} />
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="pt-2">
              <SignOut />
            </li>
          </ul>
        </div>
      ) : null}
    </>
  );
}

function SignOut({ className = "" }: { className?: string }) {
  return (
    <form action="/logout" method="post" className={className}>
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 text-[12px] md:text-[11px] uppercase tracking-[0.12em] font-bold text-[var(--brand-slate)] hover:text-[var(--brand-red)] px-2 py-2 md:py-1.5 transition"
        style={CONDENSED}
      >
        <LogOut size={12} /> Sign out
      </button>
    </form>
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
      style={CONDENSED}
    >
      <Icon size={12} />
      {children}
    </Link>
  );
}
