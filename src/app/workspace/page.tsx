import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSector } from "@/lib/sector";
import { CertlyMark } from "@/components/CertlyMark";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Where a signed-in visitor lands when they ask for the home page. It looks
 * up the workspace they belong to and forwards them into it. It exists so
 * the marketing page itself can stay static, and it deliberately never
 * redirects back to "/", which the proxy would bounce straight back here.
 */

export const metadata = {
  title: "Your workspace",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  const supabase: any = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: mem } = await supabase
    .from("org_members")
    .select("organisations(slug)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const slug = mem?.organisations?.slug as string | undefined;
  if (slug) redirect(`/${slug}/hr`);

  const pending = user.user_metadata?.pending_workspace as
    | { company?: string; slug?: string; sector?: string }
    | undefined;
  let pendingError: string | null = null;
  if (
    pending &&
    typeof pending.company === "string" &&
    typeof pending.slug === "string" &&
    /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(pending.slug) &&
    user.email_confirmed_at
  ) {
    const admin: any = createAdminClient();
    const { error } = await admin.rpc("provision_organisation", {
      p_slug: pending.slug,
      p_name: pending.company,
      p_user_id: user.id,
      p_sector: isSector(pending.sector) ? pending.sector : "general",
    });
    if (!error) {
      const rest = { ...(user.user_metadata ?? {}) };
      delete rest.pending_workspace;
      await admin.auth.admin.updateUserById(user.id, { user_metadata: rest });
      redirect(`/${pending.slug}/hr`);
    }
    pendingError = /duplicate|unique|taken/i.test(error.message ?? "")
      ? `The workspace address certly.co.za/${pending.slug} was taken while you were confirming your email. Create the workspace again with a different address.`
      : error.message;
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md text-center">
        <div className="flex items-center gap-2 justify-center">
          <CertlyMark size={26} />
          <span className="font-black text-xl tracking-tight">Certly</span>
        </div>
        <h1 className="mt-6 text-2xl font-black">You are signed in</h1>
        {pendingError ? (
          <p className="mt-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-3">
            {pendingError}
          </p>
        ) : null}
        <p className="mt-2 text-[var(--brand-slate)]">
          This account is not a member of a workspace yet. If someone invited
          you, open the invitation link they sent. If you are setting up your
          own company, create the workspace.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/signup"
            className="bg-[var(--brand-red)] hover:bg-[var(--brand-red-deep)] text-white px-5 py-2.5 rounded-md text-sm font-bold transition"
          >
            Create a workspace
          </Link>
          <Link
            href="/logout"
            className="border border-[var(--brand-ink)] hover:bg-[var(--brand-ink)] hover:text-white px-5 py-2.5 rounded-md text-sm font-bold transition"
          >
            Sign out
          </Link>
        </div>
      </div>
    </main>
  );
}
