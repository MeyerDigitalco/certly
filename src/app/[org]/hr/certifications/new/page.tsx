import { requireTenant, requireRole } from "@/lib/tenant";
import {
  getEmployee,
  listEmployees,
  getTrainingTypes,
} from "@/lib/hr/queries";
import CertForm from "../CertForm";
import PageHeader from "@/components/app/PageHeader";

export const metadata = { title: "New certification" };
export const dynamic = "force-dynamic";

export default async function NewCertificationPage({
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

  // A forged employee id resolves to null here, because getEmployee filters
  // on this workspace. The form then falls back to the picker rather than
  // silently locking on to someone else's employee.
  const [lockedEmployee, employees, trainingTypes] = await Promise.all([
    sp.employee ? getEmployee(ctx.org.id, sp.employee) : Promise.resolve(null),
    listEmployees(ctx.org.id),
    getTrainingTypes(ctx.org.id),
  ]);

  const backHref = lockedEmployee
    ? `/${slug}/hr/employees/${lockedEmployee.id}`
    : `/${slug}/hr`;

  return (
    <div className="max-w-2xl">
      <PageHeader
        kicker="Register"
        title="New certification"
        lede={
          lockedEmployee
            ? `Record training for ${lockedEmployee.names} ${lockedEmployee.surname}.`
            : "Record training against an employee in this workspace."
        }
        back={{
          href: backHref,
          label: lockedEmployee ? "Back to employee" : "Back to register",
        }}
      />

      {trainingTypes.length === 0 ? (
        <div className="mt-8 bg-white border border-[var(--brand-line)] rounded-2xl p-8 text-center text-[var(--brand-slate)]">
          This workspace has no active training types yet. Add some in settings
          first.
        </div>
      ) : (
        <div className="mt-8 bg-white border border-[var(--brand-line)] rounded-2xl p-8">
          <CertForm
            orgId={ctx.org.id}
            slug={slug}
            trainingTypes={trainingTypes}
            employees={employees}
            lockedEmployee={lockedEmployee}
          />
        </div>
      )}
    </div>
  );
}
