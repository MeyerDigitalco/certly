import { requireTenant, requireRole } from "@/lib/tenant";
import {
  listEmployees,
  getTrainingTypes,
  getSiteOptions,
  getEmployee,
} from "@/lib/hr/queries";
import ScanClient from "./ScanClient";
import PageHeader from "@/components/app/PageHeader";

export const metadata = { title: "Add a certification" };
export const dynamic = "force-dynamic";

export default async function ScanCertificatePage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ employee?: string }>;
}) {
  const { org: slug } = await params;
  const ctx = await requireTenant(slug);
  requireRole(ctx, ["owner", "admin"]);

  const sp = await searchParams;
  const [employees, trainingTypes, sites, lockedEmployee] = await Promise.all([
    listEmployees(ctx.org.id),
    getTrainingTypes(ctx.org.id),
    getSiteOptions(ctx.org.id),
    sp.employee ? getEmployee(ctx.org.id, sp.employee) : Promise.resolve(null),
  ]);

  return (
    <div className="max-w-3xl">
      <PageHeader
        kicker="Register"
        title="Add a certification"
        lede="Upload the document. Certly works out whether it is a training certificate, a licence, an ID, a passport or a permit, reads the person and the dates off it, matches them against this workspace, and shows you everything to check. Nothing is saved until you confirm."
        back={{ href: `/${slug}/hr/register`, label: "Back to register" }}
      />

      <div className="mt-8 bg-white border border-[var(--brand-line)] rounded-2xl p-8">
        <ScanClient
          orgId={ctx.org.id}
          slug={slug}
          employees={employees}
          trainingTypes={trainingTypes}
          sites={sites}
          lockedEmployee={lockedEmployee}
        />
      </div>
    </div>
  );
}
