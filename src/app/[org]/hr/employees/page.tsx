import Link from "next/link";
import { UserPlus, Search } from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { isAdmin } from "@/lib/auth/roles";
import { listEmployees } from "@/lib/hr/queries";
import EmployeeListClient from "./EmployeeListClient";
import PageHeader from "@/components/app/PageHeader";

export const metadata = { title: "Employees" };
export const dynamic = "force-dynamic";

export default async function EmployeesPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ search?: string; show?: string }>;
}) {
  const { org: slug } = await params;
  const ctx = await requireTenant(slug);
  const canWrite = isAdmin(ctx.role);

  const sp = await searchParams;
  const showAll = sp.show === "all";
  const employees = await listEmployees(ctx.org.id, sp.search, {
    includeTerminated: showAll,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="Employees"
        title="Staff master list"
        lede={
          <>
            {employees.length} employee{employees.length === 1 ? "" : "s"}{" "}
            {showAll ? "on file, including people who have left." : "currently on the register."}
            {canWrite ? " Select rows to delete in bulk." : ""}
            <span className="block mt-1 text-xs">
              {showAll ? (
                <Link href={`/${slug}/hr/employees`} className="font-bold text-[var(--brand-red)] hover:underline">
                  Hide people who have left
                </Link>
              ) : (
                <Link href={`/${slug}/hr/employees?show=all`} className="font-bold text-[var(--brand-slate)] hover:text-[var(--brand-red)]">
                  Include people who have left
                </Link>
              )}
            </span>
          </>
        }
        actions={
          canWrite ? (
            <Link
              href={`/${slug}/hr/employees/new`}
              className="inline-flex items-center gap-2 bg-[var(--brand-red)] hover:bg-[var(--brand-red-deep)] text-white px-4 py-2.5 rounded-md font-bold text-sm transition"
            >
              <UserPlus size={14} />
              New employee
            </Link>
          ) : null
        }
      />

      <form className="bg-white border border-[var(--brand-line)] rounded-2xl p-4 flex gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--brand-slate)]"
          />
          <input
            type="search"
            name="search"
            defaultValue={sp.search ?? ""}
            placeholder="Search by name, surname or document number..."
            className="w-full pl-9 pr-3 py-2.5 border border-[var(--brand-line)] rounded-md focus:outline-none focus:border-[var(--brand-red)]"
          />
        </div>
        <button
          type="submit"
          className="bg-[var(--brand-ink)] text-white px-4 py-2 rounded-md font-bold text-sm"
        >
          Search
        </button>
      </form>

      <EmployeeListClient
        employees={employees}
        orgId={ctx.org.id}
        slug={slug}
        canWrite={canWrite}
      />
    </div>
  );
}
