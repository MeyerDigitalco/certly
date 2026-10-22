import { requireTenant } from "@/lib/tenant";
import { isAdmin, isOwner } from "@/lib/auth/roles";
import { todayIso } from "@/lib/certifications/status";
import { getAuditLog, type AuditEntry } from "@/lib/hr/audit";
import { getCompanyDocuments, getRegisterRows, getRenewals } from "@/lib/hr/queries";
import {
  getAbsences,
  getEmployeesForReports,
  getTrainingDelivered,
  getTrainingTypesForReports,
} from "@/lib/reports/data";
import { buildWorkbook, xlsxResponse } from "@/lib/reports/excel";
import {
  ACTIVITY_LIMIT,
  ACTIVITY_WINDOW_DAYS,
  buildEvidenceSheets,
  shiftDays,
} from "@/lib/reports/evidence";

export const dynamic = "force-dynamic";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The audit trail is readable by the owner only. For anyone else the
 * database returns nothing, and each page costs a service role lookup, so
 * the fetch is skipped rather than paged through for an empty result.
 */
async function recentActivity(
  orgId: string,
  readable: boolean,
  asOf: string,
): Promise<AuditEntry[]> {
  if (!readable) return [];
  const since = `${shiftDays(asOf, -ACTIVITY_WINDOW_DAYS)}T00:00:00Z`;
  const out: AuditEntry[] = [];
  for (let page = 0; out.length < ACTIVITY_LIMIT; page += 1) {
    const result = await getAuditLog(orgId, { since }, page);
    out.push(...result.entries);
    if (!result.hasMore) break;
  }
  return out.slice(0, ACTIVITY_LIMIT);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ org: string }> },
) {
  const { org: slug } = await params;
  const ctx = await requireTenant(slug);
  if (!isAdmin(ctx.role)) {
    return new Response("Admins only", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const url = new URL(req.url);
  const requested = (url.searchParams.get("asOf") ?? "").trim();
  const asOf = ISO_DATE.test(requested) ? requested : todayIso();
  const orgId = ctx.org.id;
  const auditReadable = isOwner(ctx.role);

  const [
    employees,
    register,
    companyDocuments,
    renewals,
    absences,
    trainingTypes,
    trainingDelivered,
    audit,
  ] = await Promise.all([
    getEmployeesForReports(orgId),
    getRegisterRows(orgId),
    getCompanyDocuments(orgId),
    getRenewals(orgId, ctx.org.due_soon_days),
    getAbsences(orgId),
    getTrainingTypesForReports(orgId),
    getTrainingDelivered(orgId),
    recentActivity(orgId, auditReadable, asOf),
  ]);

  const sheets = buildEvidenceSheets({
    asOf,
    generatedBy: ctx.userEmail,
    generatedOn: todayIso(),
    org: {
      name: ctx.org.name,
      slug: ctx.org.slug,
      sector: ctx.org.sector,
      seta: ctx.org.seta,
      sdl_number: ctx.org.sdl_number,
      ee_reference: ctx.org.ee_reference,
      due_soon_days: ctx.org.due_soon_days,
    },
    employees,
    register,
    companyDocuments,
    renewals,
    absences,
    trainingTypes,
    trainingDelivered,
    audit,
    auditReadable,
  });

  const workbook = await buildWorkbook({
    organisation: ctx.org.name,
    period: `As at ${asOf}`,
    generatedBy: ctx.userEmail,
    sheets,
  });

  return xlsxResponse(workbook, `certly-evidence-${slug}-${asOf}.xlsx`);
}
