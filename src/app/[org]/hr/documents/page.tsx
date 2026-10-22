import { requireTenant } from "@/lib/tenant";
import { isAdmin } from "@/lib/auth/roles";
import { getCompanyDocuments } from "@/lib/hr/queries";
import CompanyDocsClient from "./CompanyDocsClient";
import PageHeader from "@/components/app/PageHeader";

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
      <PageHeader
        kicker="Company documents"
        title="The half that is not your crew"
        lede="Policies, registration, the COIDA letter of good standing, public liability, statutory appointments. Upload each once and every safety file pack picks them up. These are yours to write and sign; Certly only keeps them and binds them into the pack."
      />

      <CompanyDocsClient
        orgId={ctx.org.id}
        slug={slug}
        canWrite={isAdmin(ctx.role)}
        documents={documents}
      />
    </div>
  );
}
