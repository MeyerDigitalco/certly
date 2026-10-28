import Link from "next/link";
import { ClipboardList, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { isAdmin } from "@/lib/auth/roles";
import { parsePeriod, periodKey } from "@/lib/hr/operations";
import {
  getEmployeesForReports,
  getLabourPlans,
  getOnboardingCandidates,
  sitesFrom,
} from "@/lib/reports/data";
import {
  buildLabourPlan,
  describeGap,
  formatSigned,
  type PlanTotals,
} from "@/lib/reports/labour-plan";
import ReportShell, { Section, Stat, Th, Td } from "@/components/reports/ReportShell";
import { GroupedBars, StackedBar, CHART_COLOURS } from "@/lib/reports/charts";
import InlinePlanned from "@/components/reports/InlinePlanned";

export const metadata = { title: "Labour plan and onboarding" };
export const dynamic = "force-dynamic";

const STAGE_COLOURS: Record<string, string> = {
  screening: CHART_COLOURS.sand,
  medical: CHART_COLOURS.amber,
  teba: CHART_COLOURS.slate,
  training: CHART_COLOURS.ink,
  ready: CHART_COLOURS.green,
};

export default async function LabourPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ period?: string; site?: string }>;
}) {
  const { org: slug } = await params;
  const sp = await searchParams;
  const ctx = await requireTenant(slug);

  // Statutory reports carry each person's own EEA1 declaration: population
  // group, gender and disability. That is special personal information under
  // POPIA section 26, so these are admin only, matching the register export,
  // the evidence pack and the safety file.
  if (!isAdmin(ctx.role)) notFound();
  const canWrite = isAdmin(ctx.role);
  const period = parsePeriod(sp.period);
  const site = (sp.site ?? "").trim();

  const [employees, plans, candidates] = await Promise.all([
    getEmployeesForReports(ctx.org.id),
    getLabourPlans(ctx.org.id),
    getOnboardingCandidates(ctx.org.id),
  ]);

  const report = buildLabourPlan(employees, plans, candidates, period, site);
  const { groups, totals, stats, bySite, pipelineByStatus, pipeline, engaged } = report;
  const exportHref = `/${slug}/hr/reports/labour-plan/export?period=${periodKey(period)}${site ? `&site=${encodeURIComponent(site)}` : ""}`;
  const scope = site ? ` at ${site}` : "";

  return (
    <ReportShell
      slug={slug}
      orgName={ctx.org.name}
      reportKey="labour-plan"
      title="Labour plan and onboarding"
      description="Approved positions against people in service by site and designation, and the screening, medical, TEBA and training pipeline that will close the gap."
      period={period}
      site={site || undefined}
      sites={sitesFrom(employees, plans, candidates)}
      exportHref={exportHref}
    >
      {canWrite ? (
        <div className="print:hidden flex flex-wrap items-center gap-2 text-sm">
          <Link
            href={`/${slug}/hr/reports/labour-plan/plan`}
            className="inline-flex items-center gap-2 border border-[var(--brand-ink)] hover:bg-[var(--brand-ink)] hover:text-white px-4 py-2 rounded-md text-sm font-bold transition"
          >
            <ClipboardList size={14} />
            Edit the plan
          </Link>
          <Link
            href={`/${slug}/hr/reports/labour-plan/tracker`}
            className="inline-flex items-center gap-2 border border-[var(--brand-ink)] hover:bg-[var(--brand-ink)] hover:text-white px-4 py-2 rounded-md text-sm font-bold transition"
          >
            <Users size={14} />
            Onboarding tracker
          </Link>
        </div>
      ) : null}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="Planned positions" value={stats.planned} hint={`In force on ${period.end}`} />
        <Stat label="People in service" value={stats.actual} hint={`On ${period.end}`} />
        <Stat
          label="Variance"
          value={formatSigned(stats.variance)}
          tone={stats.variance < 0 ? "red" : stats.variance > 0 ? "amber" : "green"}
          hint="Actual minus plan"
        />
        <Stat label="In pipeline" value={stats.pipeline} tone={stats.pipeline > 0 ? "amber" : undefined} hint="Screening to ready" />
        <Stat
          label="Unfilled after pipeline"
          value={stats.unfilled}
          tone={stats.unfilled > 0 ? "red" : "green"}
          hint={stats.surplus > 0 ? `${stats.surplus} surplus in other positions` : "Plan minus actual minus pipeline"}
        />
      </div>

      <Section
        title="Plan against actual by site and designation"
        subtitle={`Approved positions in force on ${period.end} against people in service on that day${scope}. Projected gap is plan minus actual minus candidates in the pipeline. A negative gap is a surplus.`}
      >
        {!report.hasPlan ? (
          <EmptyBox>
            No labour plan is in force for {period.label}
            {scope}.{" "}
            {canWrite ? (
              <>
                <Link
                  href={`/${slug}/hr/reports/labour-plan/plan`}
                  className="text-[var(--brand-red)] font-bold hover:underline"
                >
                  Set the approved positions per site and designation
                </Link>{" "}
                and this report fills in.
              </>
            ) : (
              <>Ask an admin to set the approved positions per site and designation.</>
            )}{" "}
            People in service are still counted below.
          </EmptyBox>
        ) : null}

        {groups.length > 0 ? (
          <div className="space-y-5 mt-3">
            {report.hasPlan ? (
              <GroupedBars
                title="Plan, actual and pipeline by site"
                categories={bySite.map((s) => s.site)}
                series={[
                  { name: "Plan", colour: CHART_COLOURS.sand, values: bySite.map((s) => s.planned) },
                  { name: "Actual", colour: CHART_COLOURS.ink, values: bySite.map((s) => s.actual) },
                  { name: "Pipeline", colour: CHART_COLOURS.amber, values: bySite.map((s) => s.pipeline) },
                ]}
              />
            ) : null}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--brand-cream)]">
                  <tr>
                    <Th>Site</Th>
                    <Th>Designation</Th>
                    <Th right>Planned</Th>
                    <Th right>Actual</Th>
                    <Th right>Variance</Th>
                    <Th right>In pipeline</Th>
                    <Th right>Projected gap</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--brand-line)]">
                  {groups.map((g) => (
                    <SiteRows
                      key={g.site}
                      site={g.site}
                      rows={g.rows}
                      subtotal={g.subtotal}
                      edit={canWrite ? { orgId: ctx.org.id, slug, effectiveFrom: period.start } : null}
                    />
                  ))}
                  <tr className="font-bold bg-[var(--brand-cream)]">
                    <Td bold>Total</Td>
                    <Td>{""}</Td>
                    <TotalCells totals={totals} />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : report.hasPlan ? null : (
          <EmptyBox>
            Nobody is in service{scope} on {period.end} either. Add people to the register and
            give each one a site and designation, and they appear here.
          </EmptyBox>
        )}
      </Section>

      <Section
        title="Onboarding pipeline"
        subtitle={`Candidates still moving through screening, medical, TEBA and training${scope}, as recorded on the tracker.`}
      >
        {pipeline.length === 0 ? (
          <EmptyBox>
            No candidates are in the pipeline{scope}.{" "}
            {canWrite ? (
              <>
                <Link
                  href={`/${slug}/hr/reports/labour-plan/tracker`}
                  className="text-[var(--brand-red)] font-bold hover:underline"
                >
                  Add candidates on the onboarding tracker
                </Link>{" "}
                and their stage, dates and days in pipeline show here.
              </>
            ) : (
              <>Candidates are captured on the onboarding tracker by an admin.</>
            )}
          </EmptyBox>
        ) : (
          <div className="space-y-5">
            <StackedBar
              title="Candidates by stage"
              segments={pipelineByStatus.map((p) => ({
                label: p.label,
                value: p.count,
                colour: STAGE_COLOURS[p.status] ?? CHART_COLOURS.slate,
              }))}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--brand-cream)]">
                  <tr>
                    <Th>Surname</Th>
                    <Th>Names</Th>
                    <Th>Designation</Th>
                    <Th>Site</Th>
                    <Th>Stage</Th>
                    <Th>Screening</Th>
                    <Th>Medical</Th>
                    <Th>Medical status</Th>
                    <Th>TEBA</Th>
                    <Th>Training start</Th>
                    <Th>Expected passout</Th>
                    <Th right>Days in pipeline</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--brand-line)]">
                  {pipeline.map((c) => (
                    <tr key={c.id}>
                      <Td bold>{c.surname}</Td>
                      <Td>{c.names}</Td>
                      <Td>{c.designation}</Td>
                      <Td>{c.site}</Td>
                      <Td>{c.statusLabel}</Td>
                      <Td mono>{c.screeningDate}</Td>
                      <Td mono>{c.medicalDate}</Td>
                      <Td
                        className={
                          c.medicalStatus === "unfit"
                            ? "text-red-700 font-bold"
                            : c.medicalStatus === "fit"
                              ? "text-emerald-700 font-bold"
                              : "text-[var(--brand-slate)]"
                        }
                      >
                        {c.medicalStatusLabel}
                      </Td>
                      <Td>{c.tebaDone ? "Done" : ""}</Td>
                      <Td mono>{c.trainingStart}</Td>
                      <Td mono>{c.expectedPassout}</Td>
                      <Td right className={c.daysInPipeline > 60 ? "text-red-700 font-bold" : c.daysInPipeline > 30 ? "text-amber-700" : ""}>
                        {c.daysInPipeline}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Section>

      <Section
        title="Engaged this month"
        subtitle={`Candidates who came off the tracker and onto the register in ${period.label}${scope}.`}
      >
        {engaged.length === 0 ? (
          <EmptyBox>
            Nobody was engaged from the tracker in {period.label}
            {scope}. When a candidate is ready, mark them Engage on the onboarding tracker and
            Certly adds them to the register with their start date.
          </EmptyBox>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--brand-cream)]">
                <tr>
                  <Th>Surname</Th>
                  <Th>Names</Th>
                  <Th>Designation</Th>
                  <Th>Site</Th>
                  <Th>Engaged on</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--brand-line)]">
                {engaged.map((c) => (
                  <tr key={c.id}>
                    <Td bold>
                      {c.employeeId ? (
                        <Link
                          href={`/${slug}/hr/employees/${c.employeeId}`}
                          className="hover:text-[var(--brand-red)] hover:underline"
                        >
                          {c.surname}
                        </Link>
                      ) : (
                        c.surname
                      )}
                    </Td>
                    <Td>{c.names}</Td>
                    <Td>{c.designation}</Td>
                    <Td>{c.site}</Td>
                    <Td mono>{c.engagedOn}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </ReportShell>
  );
}

function SiteRows({
  site,
  rows,
  subtotal,
  edit,
}: {
  site: string;
  rows: Array<{
    key: string;
    designation: string;
    planned: number;
    actual: number;
    variance: number;
    pipeline: number;
    projectedGap: number;
  }>;
  subtotal: PlanTotals;
  edit: { orgId: string; slug: string; effectiveFrom: string } | null;
}) {
  return (
    <>
      {rows.map((r, i) => (
        <tr key={r.key}>
          <Td bold>{i === 0 ? site : ""}</Td>
          <Td>{r.designation}</Td>
          <Td right>
            {edit ? (
              <>
                <InlinePlanned
                  orgId={edit.orgId}
                  slug={edit.slug}
                  site={site}
                  designation={r.designation}
                  planned={r.planned}
                  effectiveFrom={edit.effectiveFrom}
                />
                <span className="hidden print:inline">{r.planned}</span>
              </>
            ) : (
              r.planned
            )}
          </Td>
          <Td right>{r.actual}</Td>
          <Td right className={r.variance < 0 ? "text-red-700 font-bold" : r.variance > 0 ? "text-amber-700" : ""}>
            {formatSigned(r.variance)}
          </Td>
          <Td right>{r.pipeline || ""}</Td>
          <Td right className={r.projectedGap > 0 ? "text-red-700 font-bold" : r.projectedGap < 0 ? "text-amber-700" : "text-emerald-700"}>
            {describeGap(r.projectedGap)}
          </Td>
        </tr>
      ))}
      <tr className="font-bold bg-[var(--brand-cream)]">
        <Td bold>{site} subtotal</Td>
        <Td>{""}</Td>
        <TotalCells totals={subtotal} />
      </tr>
    </>
  );
}

function TotalCells({ totals }: { totals: PlanTotals }) {
  return (
    <>
      <Td right bold>
        {totals.planned}
      </Td>
      <Td right bold>
        {totals.actual}
      </Td>
      <Td right bold>
        {formatSigned(totals.variance)}
      </Td>
      <Td right bold>
        {totals.pipeline}
      </Td>
      <Td right bold>
        {describeGap(totals.projectedGap)}
      </Td>
    </>
  );
}

function EmptyBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[var(--brand-cream)] border border-[var(--brand-line)] rounded-xl p-4 text-sm text-[var(--brand-slate)]">
      {children}
    </div>
  );
}
