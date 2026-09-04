import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { isAdmin } from "@/lib/auth/roles";
import { getEmployee, getEmployeeCertifications } from "@/lib/hr/queries";
import EmployeeCertsClient from "./EmployeeCertsClient";

export const dynamic = "force-dynamic";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ org: string; id: string }>;
}) {
  const { org: slug, id } = await params;
  const ctx = await requireTenant(slug);
  const canWrite = isAdmin(ctx.role);

  const employee = await getEmployee(ctx.org.id, id);
  if (!employee) notFound();

  const certs = await getEmployeeCertifications(ctx.org.id, employee.id);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/${slug}/hr/employees`}
          className="text-[var(--brand-red)] text-xs font-bold inline-flex items-center gap-1"
        >
          <ArrowLeft size={12} />
          Back to employees
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black">
              {employee.surname},{" "}
              <span className="text-[var(--brand-slate)] font-black">
                {employee.names}
              </span>
            </h1>
            <p className="mt-2 font-mono text-sm text-[var(--brand-slate)]">
              SA ID {employee.sa_id}
            </p>
          </div>
          {canWrite ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/${slug}/hr/employees/${employee.id}/edit`}
                className="inline-flex items-center gap-2 border border-[var(--brand-ink)] text-[var(--brand-ink)] hover:bg-[var(--brand-ink)] hover:text-white px-4 py-2.5 rounded-md font-bold text-sm transition"
              >
                <Pencil size={14} />
                Edit employee
              </Link>
              <Link
                href={`/${slug}/hr/certifications/new?employee=${employee.id}`}
                className="inline-flex items-center gap-2 bg-[var(--brand-red)] hover:bg-[var(--brand-red-deep)] text-white px-4 py-2.5 rounded-md font-bold text-sm transition"
              >
                <Plus size={14} />
                Add certification
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      <section className="grid sm:grid-cols-3 gap-4">
        <Info label="Site" value={employee.site} />
        <Info label="Superior" value={employee.superior} />
        <Info label="Designation" value={employee.designation} />
      </section>

      <EmployeeCertsClient
        certs={certs}
        orgId={ctx.org.id}
        slug={slug}
        employeeId={employee.id}
        canWrite={canWrite}
        dueSoonDays={ctx.org.due_soon_days}
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="bg-white border border-[var(--brand-line)] rounded-xl p-4">
      <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--brand-slate)]">
        {label}
      </p>
      <p className="mt-1 font-bold text-[var(--brand-ink)]">{value ?? "-"}</p>
    </div>
  );
}
