import Link from "next/link";
import { redirect } from "next/navigation";
import { Flame, ShieldCheck, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase: any = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed in already: send them straight to their workspace.
  if (user) {
    const { data: mem } = await supabase
      .from("org_members")
      .select("organisations(slug)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    const slug = mem?.organisations?.slug as string | undefined;
    if (slug) redirect(`/${slug}/hr`);
  }

  return (
    <main className="min-h-screen">
      <header className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="text-[var(--brand-red)]" size={22} />
          <span className="font-black text-xl tracking-tight">Certly</span>
        </div>
        <nav className="flex items-center gap-3 text-sm font-bold">
          <Link
            href="/login"
            className="text-[var(--brand-ink)] hover:text-[var(--brand-red)] transition px-3 py-2"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-[var(--brand-red)] hover:bg-[var(--brand-red-deep)] text-white px-4 py-2 rounded-md transition"
          >
            Start free
            <ArrowRight size={14} />
          </Link>
        </nav>
      </header>

      <section className="max-w-3xl mx-auto px-6 pt-16 pb-24 text-center">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--brand-red)] font-bold">
          HR compliance for South African business
        </p>
        <h1 className="mt-4 text-5xl md:text-6xl font-black tracking-tight">
          Every certificate. Every expiry. One register.
        </h1>
        <p className="mt-5 text-lg text-[var(--brand-slate)]">
          Track staff training and certification, see what is expired or due
          soon at a glance, and keep every workspace&rsquo;s data walled off
          from the next. Built for teams that get audited.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-[var(--brand-red)] hover:bg-[var(--brand-red-deep)] text-white px-6 py-3 rounded-md font-bold transition"
          >
            Create your workspace
            <ArrowRight size={16} />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 border border-[var(--brand-ink)] text-[var(--brand-ink)] hover:bg-[var(--brand-ink)] hover:text-white px-6 py-3 rounded-md font-bold transition"
          >
            Sign in
          </Link>
        </div>
        <p className="mt-6 text-xs text-[var(--brand-slate)] inline-flex items-center gap-1.5">
          <ShieldCheck size={12} className="text-[var(--brand-red)]" />
          14-day trial. No card required.
        </p>
      </section>
    </main>
  );
}
