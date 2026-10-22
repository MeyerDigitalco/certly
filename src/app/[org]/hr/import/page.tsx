import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { isAdmin } from "@/lib/auth/roles";
import ImportClient from "./ImportClient";
import PageHeader from "@/components/app/PageHeader";

export const metadata = { title: "Import" };
export const dynamic = "force-dynamic";

export default async function ImportPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org: slug } = await params;
  const ctx = await requireTenant(slug);
  if (!isAdmin(ctx.role)) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        kicker="Register"
        title="Import from a spreadsheet"
        lede="For the first load, when your register already exists in Excel and nobody is going to retype four hundred rows. People are matched on document number, so running the same file twice updates rather than duplicates."
        back={{ href: `/${slug}/hr/register`, label: "Back to register" }}
      />

      <ImportClient orgId={ctx.org.id} slug={slug} />

      <p className="text-xs text-[var(--brand-slate)]">
        Import brings across the details, not the paper. Certificates loaded
        this way have no file attached, so a safety file pack will list them as
        having no evidence until you scan the certificate in. Use Add
        certification for anything you have the document for.
      </p>
    </div>
  );
}
