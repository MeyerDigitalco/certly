import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireTenant, requireRole } from "@/lib/tenant";
import { getEmployee, getSiteOptions } from "@/lib/hr/queries";
import EmployeeForm from "../../EmployeeForm";

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
      <Link
        href={`/${slug}/hr/employees/${id}`}
        className="text-[var(--brand-red)] text-xs font-bold inline-flex items-center gap-1"
      >
        <ArrowLeft size={12} />
        Back to employee
      </Link>
      <h1 className="mt-2 text-3xl font-black">Edit employee</h1>
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
