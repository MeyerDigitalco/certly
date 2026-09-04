import Link from "next/link";
import {
  ArrowLeft, ShieldCheck, KeyRound, Users, Building,
} from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { isOwner } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AdminRoster from "./AdminRoster";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org: slug } = await params;
  const ctx = await requireTenant(slug);

  const supabase: any = await createClient();
  const { data: rawMembers } = await supabase
    .from("org_members")
    .select("user_id, role, created_at")
    .eq("organisation_id", ctx.org.id);

  // Resolve emails via service role (auth.users not exposed to app role)
  const admin: any = createAdminClient();
  const { data: userList } = await admin.auth.admin.listUsers({ page: 1, perPage: 500 });
  const idToEmail = new Map<string, string>();
  for (const u of (userList?.users ?? []) as Array<{ id: string; email: string | null }>) {
    if (u.email) idToEmail.set(u.id, u.email);
  }
  const members = (rawMembers ?? []).map((m: any) => ({
    ...m,
    email: idToEmail.get(m.user_id) ?? "(unknown)",
  })).sort((a: any, b: any) => a.email.localeCompare(b.email));

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <Link href={`/${slug}/hr`}
          className="text-[var(--brand-red)] text-xs font-bold inline-flex items-center gap-1">
          <ArrowLeft size={12} /> Back to register
        </Link>
        <h1 className="mt-2 text-3xl font-black">Settings</h1>
        <p className="mt-2 text-[var(--brand-slate)]">
          Workspace configuration, admin roster, and account.
        </p>
      </div>

      <Section icon={Building} title="Workspace" subtitle="Your organisation on Certly.">
        <Kv label="Name" value={ctx.org.name} />
        <Kv label="URL" value={`certly.co.za/${ctx.org.slug}`} mono />
        <Kv label="Plan" value={ctx.org.plan} />
        <Kv label="Trial ends" value={new Date(ctx.org.trial_ends_at).toLocaleDateString()} />
      </Section>

      <Section icon={ShieldCheck} title="You" subtitle="Currently signed-in.">
        <Kv label="Email" value={ctx.userEmail} mono />
        <Kv label="Role" value={ctx.role} />
        <div className="pt-3 border-t border-[var(--brand-line)]">
          <Link href="/set-password?change=1"
            className="inline-flex items-center gap-2 bg-[var(--brand-ink)] text-white hover:bg-[var(--brand-charcoal)] px-4 py-2 rounded-md text-sm font-bold transition">
            <KeyRound size={12} /> Change my password
          </Link>
        </div>
      </Section>

      <Section icon={Users}
        title="Admin roster"
        subtitle={isOwner(ctx.role)
          ? "Add, remove, and re-role the people who can access this workspace. Owners have full control including billing. Admins manage employees and certificates. Viewers can only read."
          : "The people who can access this workspace. Only the owner can add or remove admins."}>
        <AdminRoster
          orgSlug={slug}
          orgId={ctx.org.id}
          currentUserId={ctx.userId}
          isOwner={isOwner(ctx.role)}
          members={members}
        />
      </Section>
    </div>
  );
}

function Section({ icon: Icon, title, subtitle, children }: {
  icon: typeof ShieldCheck; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-[var(--brand-line)] rounded-2xl p-6 space-y-4">
      <header className="flex items-start gap-3">
        <Icon size={20} className="text-[var(--brand-red)] mt-0.5 shrink-0" />
        <div>
          <h2 className="text-lg font-black">{title}</h2>
          <p className="text-sm text-[var(--brand-slate)] mt-1 max-w-2xl">{subtitle}</p>
        </div>
      </header>
      <div>{children}</div>
    </section>
  );
}
function Kv({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm">
      <span className="text-xs uppercase tracking-widest font-bold text-[var(--brand-slate)] sm:w-40">{label}</span>
      <span className={`${mono ? "font-mono text-xs" : ""} text-[var(--brand-ink)]`}>{value}</span>
    </div>
  );
}
