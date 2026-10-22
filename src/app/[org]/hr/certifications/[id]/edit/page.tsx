import { notFound } from "next/navigation";
import { requireTenant, requireRole } from "@/lib/tenant";
import {
  getCertification,
  getEmployee,
  listEmployees,
  getTrainingTypes,
} from "@/lib/hr/queries";
import CertForm from "../../CertForm";
import PageHeader from "@/components/app/PageHeader";

export const metadata = { title: "Edit certification" };
export const dynamic = "force-dynamic";

export default async function EditCertificationPage({
  params,
}: {
  params: Promise<{ org: string; id: string }>;
}) {
  const { org: slug, id } = await params;
  const ctx = await requireTenant(slug);
  requireRole(ctx, ["owner", "admin"]);

  const certification = await getCertification(ctx.org.id, id);
  if (!certification) notFound();

  const [employee, employees, trainingTypes] = await Promise.all([
    getEmployee(ctx.org.id, certification.employee_id),
    listEmployees(ctx.org.id),
    getTrainingTypes(ctx.org.id),
  ]);

  return (
    <div className="max-w-2xl">
      <PageHeader
        kicker="Register"
        title="Edit certification"
        lede={employee ? `${employee.surname}, ${employee.names}` : undefined}
        back={{
          href: employee ? `/${slug}/hr/employees/${employee.id}` : `/${slug}/hr`,
          label: employee ? "Back to employee" : "Back to register",
        }}
      />

      <div className="mt-8 bg-white border border-[var(--brand-line)] rounded-2xl p-8">
        <CertForm
          orgId={ctx.org.id}
          slug={slug}
          trainingTypes={trainingTypes}
          employees={employees}
          lockedEmployee={employee}
          initial={certification}
        />
      </div>
    </div>
  );
}
