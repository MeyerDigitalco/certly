import Link from "next/link";
import { UserPlus, ScanLine, Upload, ChevronLeft, ChevronRight } from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { isAdmin } from "@/lib/auth/roles";
import {
  companyDocumentRenewals,
  getCompanyDocuments,
  getRegisterPage,
  getRegisterKpis,
  getSiteOptions,
  getTrainingTypes,
  type RegisterSortKey,
  type SortDirection,
} from "@/lib/hr/queries";
import { Building2 } from "lucide-react";
import type { CertStatus } from "@/lib/types/database";
import KpiCards from "@/components/hr/KpiCards";
import RegisterFilters from "@/components/hr/RegisterFilters";
import RegisterTable from "@/components/hr/RegisterTable";
import PageHeader from "@/components/app/PageHeader";

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

  const [register, kpis, sites, trainingTypes, companyDocs] = await Promise.all([
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
    getCompanyDocuments(ctx.org.id),
  ]);
  const rows = register.rows;
  const companyLapsing = companyDocumentRenewals(
    companyDocs,
    ctx.org.due_soon_days,
    Math.max(ctx.org.due_soon_days, 30),
  );
  const companyExpired = companyLapsing.filter((d) => d.days_left < 0);

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="Register"
        title="Training and certification"
        lede={
          <>
            Live view of every employee&rsquo;s certifications. Click a KPI card
            to filter, or use the search and drop-downs below.
          </>
        }
        actions={
          canWrite ? (
            <>
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
            </>
          ) : null
        }
      />

      <KpiCards slug={slug} counts={kpis} active={statusFilter} />

      {companyLapsing.length > 0 ? (
        <Link
          href={`/${slug}/hr/renewals`}
          className={`flex flex-wrap items-center gap-3 rounded-2xl border px-5 py-4 text-sm transition hover:border-[var(--brand-ink)] ${
            companyExpired.length > 0
              ? "bg-red-50 border-red-300"
              : "bg-amber-50 border-amber-300"
          }`}
        >
          <Building2
            size={18}
            className={companyExpired.length > 0 ? "text-red-700" : "text-amber-700"}
          />
          <span className="font-bold">
            {companyExpired.length > 0
              ? `${companyExpired.length} company ${companyExpired.length === 1 ? "document has" : "documents have"} expired`
              : `${companyLapsing.length} company ${companyLapsing.length === 1 ? "document lapses" : "documents lapse"} soon`}
          </span>
          <span className="text-[var(--brand-slate)]">
            {companyLapsing
              .slice(0, 3)
              .map((d) => d.label)
              .join(", ")}
            {companyLapsing.length > 3 ? ` and ${companyLapsing.length - 3} more` : ""}.
            An expired letter of good standing or B-BBEE certificate stops the whole crew, not one person.
          </span>
        </Link>
      ) : null}

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
