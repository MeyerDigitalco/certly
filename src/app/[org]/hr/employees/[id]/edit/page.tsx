import { notFound } from "next/navigation";
import { requireTenant, requireRole } from "@/lib/tenant";
import { getEmployee, getSiteOptions } from "@/lib/hr/queries";
import EmployeeForm from "../../EmployeeForm";
import PageHeader from "@/components/app/PageHeader";

export const metadata = { title: "Edit employee" };
export const dynamic = "force-dynamic";

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ org: string; id: string }>;
}) {
  const { org: slug, id } = await params;
  const ctx = await requireTenant(slug);
  requireRole(ctx, ["owner", "admin"]);

  const [employee, sites] = await Promise.all([
    getEmployee(ctx.org.id, id),
    getSiteOptions(ctx.org.id),
  ]);
  if (!employee) notFound();

  return (
    <div className="max-w-2xl">
      <PageHeader
        kicker="Employees"
        title="Edit employee"
        back={{ href: `/${slug}/hr/employees/${id}`, label: "Back to employee" }}
      />
      <div className="mt-8 bg-white border border-[var(--brand-line)] rounded-2xl p-8">
        <EmployeeForm
          orgId={ctx.org.id}
          slug={slug}
          sites={sites}
          initial={employee}
        />
      </div>
    </div>
  );
}
