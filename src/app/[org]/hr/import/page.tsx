import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { isAdmin } from "@/lib/auth/roles";
import ImportClient from "./ImportClient";

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
      <div>
        <Link
          href={`/${slug}/hr`}
          className="text-[var(--brand-red)] text-xs font-bold inline-flex items-center gap-1"
        >
          <ArrowLeft size={12} /> Back to register
        </Link>
        <h1 className="mt-2 text-3xl font-black">Import from a spreadsheet</h1>
        <p className="mt-2 text-[var(--brand-slate)]">
          For the first load, when your register already exists in Excel and
          nobody is going to retype four hundred rows. People are matched on
          document number, so running the same file twice updates rather than
          duplicates.
        </p>
      </div>

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
