import Link from "next/link";
import {
  ArrowLeft, ShieldCheck, KeyRound, Users, Building, GraduationCap, Download, CreditCard,
} from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { isOwner, isAdmin } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTrainingTypesWithUsage } from "@/lib/hr/queries";
import AdminRoster from "./AdminRoster";
import TrainingTypesManager from "./TrainingTypesManager";

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

  const trainingTypes = await getTrainingTypesWithUsage(ctx.org.id);

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
  const { data: rawInvitations } = await supabase
    .from("invitations")
    .select("id, email, role, expires_at")
    .eq("organisation_id", ctx.org.id)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  const invitations = (rawInvitations ?? []) as Array<{
    id: string;
    email: string;
    role: "owner" | "admin" | "viewer";
    expires_at: string;
  }>;

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
        {isOwner(ctx.role) ? (
          <div className="pt-3 border-t border-[var(--brand-line)]">
            <Link href={`/${slug}/hr/billing`}
              className="inline-flex items-center gap-2 border border-[var(--brand-line)] hover:border-[var(--brand-ink)] px-4 py-2 rounded-md text-sm font-bold transition">
              <CreditCard size={12} /> Plan and billing
            </Link>
          </div>
        ) : null}
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

      <Section icon={Download}
        title="Export"
        subtitle="Your register and your files leave in a format you can open without us. Comma separated, opens in Excel.">
        <div className="flex flex-wrap gap-2">
          <a href={`/${slug}/hr/export?data=register`}
            className="inline-flex items-center gap-2 border border-[var(--brand-line)] hover:border-[var(--brand-ink)] px-4 py-2.5 rounded-md text-sm font-bold transition">
            <Download size={14} /> Register
          </a>
          <a href={`/${slug}/hr/export?data=employees`}
            className="inline-flex items-center gap-2 border border-[var(--brand-line)] hover:border-[var(--brand-ink)] px-4 py-2.5 rounded-md text-sm font-bold transition">
            <Download size={14} /> Employees
          </a>
          <a href={`/${slug}/hr/export?data=documents`}
            className="inline-flex items-center gap-2 border border-[var(--brand-line)] hover:border-[var(--brand-ink)] px-4 py-2.5 rounded-md text-sm font-bold transition">
            <Download size={14} /> Company documents
          </a>
        </div>
        <p className="mt-3 text-xs text-[var(--brand-slate)]">
          Attached certificates and identity copies are not in the export. Build a
          safety file pack to take those with you.
        </p>
      </Section>

      <Section icon={GraduationCap}
        title="Training types"
        subtitle="The catalogue this workspace files certifications against. Twenty four are seeded when a workspace is created. Add your own, reorder them, hide the ones you do not use, and delete the ones nobody has filed against.">
        <TrainingTypesManager
          orgId={ctx.org.id}
          slug={slug}
          canWrite={isAdmin(ctx.role)}
          types={trainingTypes}
        />
        {isAdmin(ctx.role) ? (
          <p className="mt-4 text-sm text-[var(--brand-slate)]">
            Category, hours, cost and provider per training type feed the Annual
            Training Report.{" "}
            <Link
              href={`/${slug}/hr/reports/skills-development/types`}
              className="text-[var(--brand-red)] font-bold hover:underline"
            >
              Set them here
            </Link>
            .
          </p>
        ) : null}
      </Section>

      <Section icon={Users}
        title="Admin roster"
        subtitle={isOwner(ctx.role)
          ? "Invite, remove, and re-role the people who can access this workspace. An invitation becomes access only when that person signs in and accepts it. Owners have full control including billing. Admins manage employees and certificates. Viewers can only read."
          : "The people who can access this workspace. Only the owner can add or remove admins."}>
        <AdminRoster
          orgSlug={slug}
          orgId={ctx.org.id}
          currentUserId={ctx.userId}
          isOwner={isOwner(ctx.role)}
          members={members}
          invitations={invitations}
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
