import Link from "next/link";
import { UserPlus, Search } from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { isAdmin } from "@/lib/auth/roles";
import { listEmployees } from "@/lib/hr/queries";
import EmployeeListClient from "./EmployeeListClient";

export const metadata = { title: "Employees" };
export const dynamic = "force-dynamic";

export default async function EmployeesPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ search?: string }>;
}) {
  const { org: slug } = await params;
  const ctx = await requireTenant(slug);
  const canWrite = isAdmin(ctx.role);

  const sp = await searchParams;
  const employees = await listEmployees(ctx.org.id, sp.search);

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--brand-red)] font-bold">
            Employees
          </p>
          <h1 className="mt-2 text-4xl font-black">Staff master list</h1>
          <p className="mt-2 text-[var(--brand-slate)]">
            {employees.length} employee{employees.length === 1 ? "" : "s"} on file.
            {canWrite ? " Select rows to delete in bulk." : ""}
          </p>
        </div>
        {canWrite ? (
          <Link
            href={`/${slug}/hr/employees/new`}
            className="inline-flex items-center gap-2 bg-[var(--brand-red)] hover:bg-[var(--brand-red-deep)] text-white px-4 py-2.5 rounded-md font-bold text-sm transition"
          >
            <UserPlus size={14} />
            New employee
          </Link>
        ) : null}
      </header>

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
            placeholder="Search by name, surname or SA ID..."
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
