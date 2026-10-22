import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, ScanLine } from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { GENDERS, OCCUPATIONAL_LEVEL_SHORT, POPULATION_GROUPS } from "@/lib/hr/operations";
import { isAdmin } from "@/lib/auth/roles";
import { getEmployee, getEmployeeCertifications } from "@/lib/hr/queries";
import { idTypeLabel, countryLabel } from "@/lib/validation/identification";
import EmployeeCertsClient from "./EmployeeCertsClient";
import IdentityFileCard from "./IdentityFileCard";
import TerminationCard from "./TerminationCard";
import PageHeader from "@/components/app/PageHeader";

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
      <PageHeader
        kicker="Employees"
        title={`${employee.surname}, ${employee.names}`}
        lede={
          <span className="font-mono text-sm">
            {idTypeLabel(employee.id_type)} {employee.id_number}
            {employee.id_country
              ? ` (${countryLabel(employee.id_country)})`
              : ""}
          </span>
        }
        back={{ href: `/${slug}/hr/employees`, label: "Back to employees" }}
        actions={
          canWrite ? (
            <>
              <Link
                href={`/${slug}/hr/employees/${employee.id}/edit`}
                className="inline-flex items-center gap-2 border border-[var(--brand-ink)] text-[var(--brand-ink)] hover:bg-[var(--brand-ink)] hover:text-white px-4 py-2.5 rounded-md font-bold text-sm transition"
              >
                <Pencil size={14} />
                Edit employee
              </Link>
              <Link
                href={`/${slug}/hr/certifications/scan?employee=${employee.id}`}
                className="inline-flex items-center gap-2 bg-[var(--brand-red)] hover:bg-[var(--brand-red-deep)] text-white px-4 py-2.5 rounded-md font-bold text-sm transition"
              >
                <ScanLine size={14} />
                Add certification
              </Link>
            </>
          ) : null
        }
      />

      <section className="grid sm:grid-cols-4 gap-4">
        <Info label="Site" value={employee.site} />
        <Info label="Superior" value={employee.superior} />
        <Info label="Designation" value={employee.designation} />
        <Info label="Document expiry" value={employee.id_expiry} />
        <Info label="Start date" value={employee.engaged_at} />
        <Info label="Date of birth" value={employee.date_of_birth} />
        <Info
          label="Retirement age"
          value={
            employee.retirement_age !== null
              ? String(employee.retirement_age)
              : `${ctx.org.default_retirement_age} (default)`
          }
        />
        <Info label="Approved retirement date" value={employee.approved_retirement_date} />
        <Info label="Gender" value={GENDERS.find((g) => g.value === employee.gender)?.label ?? null} />
        <Info
          label="Population group"
          value={POPULATION_GROUPS.find((g) => g.value === employee.population_group)?.label ?? null}
        />
        <Info
          label="Disability"
          value={employee.disability === true ? "Yes" : employee.disability === false ? "No" : null}
        />
        <Info
          label="Occupational level"
          value={employee.occupational_level ? OCCUPATIONAL_LEVEL_SHORT[employee.occupational_level] : null}
        />
        <Info label="OFO code" value={employee.ofo_code} />
        <Info label="EEA1 declared" value={employee.ee_declared_at} />
      </section>

      <section className="grid md:grid-cols-2 gap-4 max-w-4xl">
        <IdentityFileCard
          orgId={ctx.org.id}
          slug={slug}
          employeeId={employee.id}
          hasFile={Boolean(employee.id_file_path)}
          documentLabel={idTypeLabel(employee.id_type)}
          certifiedAt={employee.id_certified_at}
          canWrite={canWrite}
        />
        <TerminationCard
          orgId={ctx.org.id}
          slug={slug}
          employee={employee}
          canWrite={canWrite}
        />
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
