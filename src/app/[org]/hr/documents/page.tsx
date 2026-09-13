import { requireTenant } from "@/lib/tenant";
import { isAdmin } from "@/lib/auth/roles";
import { getCompanyDocuments } from "@/lib/hr/queries";
import CompanyDocsClient from "./CompanyDocsClient";

export const metadata = { title: "Company documents" };
export const dynamic = "force-dynamic";

export default async function CompanyDocumentsPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org: slug } = await params;
  const ctx = await requireTenant(slug);
  const documents = await getCompanyDocuments(ctx.org.id);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--brand-red)] font-bold">
          {ctx.org.name} - Company documents
        </p>
        <h1 className="mt-2 text-4xl md:text-5xl font-black">
          The half that is not your crew
        </h1>
        <p className="mt-2 text-[var(--brand-slate)] max-w-2xl">
          Policies, registration, the COIDA letter of good standing, public
          liability, statutory appointments. Upload each once and every safety
          file pack picks them up. These are yours to write and sign; Certly only
          keeps them and binds them into the pack.
        </p>
      </header>

      <CompanyDocsClient
        orgId={ctx.org.id}
        slug={slug}
        canWrite={isAdmin(ctx.role)}
        documents={documents}
      />
    </div>
  );
}
