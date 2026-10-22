import { requireTenant, requireRole } from "@/lib/tenant";
import { getSiteOptions } from "@/lib/hr/queries";
import EmployeeForm from "../EmployeeForm";
import PageHeader from "@/components/app/PageHeader";

export const metadata = { title: "New employee" };
export const dynamic = "force-dynamic";

export default async function NewEmployeePage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org: slug } = await params;
  const ctx = await requireTenant(slug);
  requireRole(ctx, ["owner", "admin"]);
  const sites = await getSiteOptions(ctx.org.id);

  return (
    <div className="max-w-2xl">
      <PageHeader
        kicker="Employees"
        title="New employee"
        lede="Add a new person to the training register."
        back={{ href: `/${slug}/hr/employees`, label: "Back to employees" }}
      />
      <div className="mt-8 bg-white border border-[var(--brand-line)] rounded-2xl p-8">
        <EmployeeForm orgId={ctx.org.id} slug={slug} sites={sites} />
      </div>
    </div>
  );
}
