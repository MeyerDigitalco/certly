import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireTenant, requireRole } from "@/lib/tenant";
import { getSiteOptions } from "@/lib/hr/queries";
import EmployeeForm from "../EmployeeForm";

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
      <Link
        href={`/${slug}/hr/employees`}
        className="text-[var(--brand-red)] text-xs font-bold inline-flex items-center gap-1"
      >
        <ArrowLeft size={12} />
        Back to employees
      </Link>
      <h1 className="mt-2 text-3xl font-black">New employee</h1>
      <p className="mt-1 text-[var(--brand-slate)]">
        Add a new person to the training register.
      </p>
      <div className="mt-8 bg-white border border-[var(--brand-line)] rounded-2xl p-8">
        <EmployeeForm orgId={ctx.org.id} slug={slug} sites={sites} />
      </div>
    </div>
  );
}
