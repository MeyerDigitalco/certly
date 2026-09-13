import Link from "next/link";
import { UserPlus, ScanLine, Upload, ChevronLeft, ChevronRight } from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { isAdmin } from "@/lib/auth/roles";
import {
  getRegisterPage,
  getRegisterKpis,
  getSiteOptions,
  getTrainingTypes,
  type RegisterSortKey,
  type SortDirection,
} from "@/lib/hr/queries";
import type { CertStatus } from "@/lib/types/database";
import KpiCards from "@/components/hr/KpiCards";
import RegisterFilters from "@/components/hr/RegisterFilters";
import RegisterTable from "@/components/hr/RegisterTable";

export const metadata = { title: "Register" };
export const dynamic = "force-dynamic";

const VALID_STATUSES: (CertStatus | "all")[] = [
  "expired",
  "due_soon",
  "valid",
  "no_expiry",
  "all",
];

const VALID_SORT_KEYS: RegisterSortKey[] = [
  "surname",
  "names",
  "id_number",
  "site",
  "training_type",
  "training_date",
  "expiry_date",
  "days_left",
  "status",
];

export default async function HrRegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{
    search?: string;
    site?: string;
    training?: string;
    status?: string;
    sort?: string;
    dir?: string;
    page?: string;
  }>;
}) {
  const { org: slug } = await params;
  const ctx = await requireTenant(slug);
  const canWrite = isAdmin(ctx.role);

  const sp = await searchParams;
  const statusFilter: CertStatus | "all" =
    sp.status && VALID_STATUSES.includes(sp.status as CertStatus | "all")
      ? (sp.status as CertStatus | "all")
      : "all";
  const sort: RegisterSortKey | undefined =
    sp.sort && VALID_SORT_KEYS.includes(sp.sort as RegisterSortKey)
      ? (sp.sort as RegisterSortKey)
      : undefined;
  const dir: SortDirection = sp.dir === "desc" ? "desc" : "asc";

  const page = Math.max(0, Number(sp.page ?? "0") || 0);

  const [register, kpis, sites, trainingTypes] = await Promise.all([
    getRegisterPage(
      ctx.org.id,
      {
        search: sp.search,
        site: sp.site,
        trainingType: sp.training,
        status: statusFilter,
        sort,
        dir,
      },
      page,
    ),
    getRegisterKpis(ctx.org.id),
    getSiteOptions(ctx.org.id),
    getTrainingTypes(ctx.org.id),
  ]);
  const rows = register.rows;

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--brand-red)] font-bold">
            {ctx.org.name} - Register
          </p>
          <h1 className="mt-2 text-4xl md:text-5xl font-black">
            Training and certification
          </h1>
          <p className="mt-2 text-[var(--brand-slate)]">
            Live view of every employee&rsquo;s certifications. Click a KPI card
            to filter, or use the search and drop-downs below.
          </p>
        </div>
        {canWrite ? (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/${slug}/hr/import`}
              className="inline-flex items-center gap-2 border border-[var(--brand-line)] text-[var(--brand-slate)] hover:border-[var(--brand-ink)] hover:text-[var(--brand-ink)] px-4 py-2.5 rounded-md font-bold text-sm transition"
            >
              <Upload size={14} />
              Import
            </Link>
            <Link
              href={`/${slug}/hr/employees/new`}
              className="inline-flex items-center gap-2 border border-[var(--brand-ink)] text-[var(--brand-ink)] hover:bg-[var(--brand-ink)] hover:text-white px-4 py-2.5 rounded-md font-bold text-sm transition"
            >
              <UserPlus size={14} />
              New employee
            </Link>
            <Link
              href={`/${slug}/hr/certifications/scan`}
              className="inline-flex items-center gap-2 bg-[var(--brand-red)] hover:bg-[var(--brand-red-deep)] text-white px-4 py-2.5 rounded-md font-bold text-sm transition"
            >
              <ScanLine size={14} />
              Add certification
            </Link>
          </div>
        ) : null}
      </header>

      <KpiCards slug={slug} counts={kpis} active={statusFilter} />

      <RegisterFilters
        slug={slug}
        sites={sites}
        trainingTypes={trainingTypes.map((t) => t.name)}
      />

      <RegisterTable
        slug={slug}
        rows={rows}
        sort={sort}
        dir={dir}
        currentParams={{
          search: sp.search,
          site: sp.site,
          training: sp.training,
          status: sp.status,
        }}
      />

      <RegisterPager
        slug={slug}
        page={register.page}
        pageSize={register.pageSize}
        total={register.total}
        hasMore={register.hasMore}
        params={{
          search: sp.search,
          site: sp.site,
          training: sp.training,
          status: sp.status,
          sort: sp.sort,
          dir: sp.dir,
        }}
      />
    </div>
  );
}

function RegisterPager({
  slug,
  page,
  pageSize,
  total,
  hasMore,
  params,
}: {
  slug: string;
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  params: Record<string, string | undefined>;
}) {
  if (total <= pageSize) {
    return (
      <p className="text-xs text-[var(--brand-slate)]">
        {total} record{total === 1 ? "" : "s"}
      </p>
    );
  }

  const href = (next: number) => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) qs.set(key, value);
    }
    if (next > 0) qs.set("page", String(next));
    const text = qs.toString();
    return `/${slug}/hr${text ? `?${text}` : ""}`;
  };

  const first = page * pageSize + 1;
  const last = Math.min(total, page * pageSize + pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-[var(--brand-slate)]">
        Showing {first} to {last} of {total}
      </p>
      <div className="flex items-center gap-4">
        {page > 0 ? (
          <Link
            href={href(page - 1)}
            className="inline-flex items-center gap-1 text-sm font-bold text-[var(--brand-ink)] hover:text-[var(--brand-red)]"
          >
            <ChevronLeft size={14} /> Previous
          </Link>
        ) : null}
        {hasMore ? (
          <Link
            href={href(page + 1)}
            className="inline-flex items-center gap-1 text-sm font-bold text-[var(--brand-ink)] hover:text-[var(--brand-red)]"
          >
            Next <ChevronRight size={14} />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
