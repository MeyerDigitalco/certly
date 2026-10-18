import Link from "next/link";
import { requireTenant } from "@/lib/tenant";
import { parsePeriod, periodKey } from "@/lib/hr/operations";
import {
  getEmployeesForReports,
  getLabourPlans,
  getOnboardingCandidates,
  sitesFrom,
} from "@/lib/reports/data";
import {
  buildStaffMovement,
  formatPct,
  formatSigned,
  UNCLASSIFIED_LABEL,
} from "@/lib/reports/staff-movement";
import ReportShell, { Section, Stat, Th, Td } from "@/components/reports/ReportShell";
import { GroupedBars, StackedBar, CHART_COLOURS } from "@/lib/reports/charts";

export const metadata = { title: "Staff movement" };
export const dynamic = "force-dynamic";

export default async function StaffMovementPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ period?: string; site?: string }>;
}) {
  const { org: slug } = await params;
  const sp = await searchParams;
  const ctx = await requireTenant(slug);
  const period = parsePeriod(sp.period);
  const site = (sp.site ?? "").trim();

  const [employees, plans, candidates] = await Promise.all([
    getEmployeesForReports(ctx.org.id),
    getLabourPlans(ctx.org.id),
    getOnboardingCandidates(ctx.org.id),
  ]);

  const report = buildStaffMovement(employees, plans, period, site);
  const { kpis, matrix, planVsActual, trend, leavers } = report;
  const exportHref = `/${slug}/hr/reports/staff-movement/export?period=${periodKey(period)}${site ? `&site=${encodeURIComponent(site)}` : ""}`;

  const turnoverTone = kpis.turnoverPct >= 10 ? "red" : kpis.turnoverPct >= 5 ? "amber" : undefined;
  const headcountDelta = kpis.endHeadcount - kpis.startHeadcount;

  return (
    <ReportShell
      slug={slug}
      orgName={ctx.org.name}
      reportKey="staff-movement"
      title="Staff movement"
      description="Who left and why, split by site and by fault or no fault, against who joined and what the approved plan says each site should carry."
      period={period}
      site={site || undefined}
      sites={sitesFrom(employees, plans, candidates)}
      exportHref={exportHref}
    >
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="Headcount at start" value={kpis.startHeadcount} hint={`On ${period.start}`} />
        <Stat label="Joiners" value={kpis.joiners} tone={kpis.joiners > 0 ? "green" : undefined} hint="Started in the month" />
        <Stat label="Leavers" value={kpis.leavers} tone={kpis.leavers > 0 ? "red" : undefined} hint="Last day in the month" />
        <Stat
          label="Headcount at end"
          value={kpis.endHeadcount}
          hint={`${formatSigned(headcountDelta)} on the month`}
        />
        <Stat
          label="Turnover"
          value={`${kpis.turnoverPct.toFixed(1)}%`}
          tone={turnoverTone}
          hint="Leavers over average headcount"
        />
      </div>

      <Section
        title="Terminations by reason and site"
        subtitle={`${period.label}${site ? `, ${site}` : ""}. No fault covers death, retirement, ill health, contract end and retrenchment. Fault covers resignation, dismissal and abscondment.`}
      >
        {matrix.grand.total === 0 ? (
          <EmptyBox>
            No terminations recorded for {period.label}
            {site ? ` at ${site}` : ""}. When someone leaves, open their employee page and
            record the last day and the reason under Leaving. Do not delete them, or they
            drop out of every report.
          </EmptyBox>
        ) : (
          <div className="space-y-5">
            <StackedBar
              title="Fault against no fault"
              segments={[
                { label: "No fault", value: kpis.noFault, colour: CHART_COLOURS.slate },
                { label: "Fault", value: kpis.fault, colour: CHART_COLOURS.red },
                ...(kpis.unclassified > 0
                  ? [{ label: UNCLASSIFIED_LABEL, value: kpis.unclassified, colour: CHART_COLOURS.sand }]
                  : []),
              ]}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--brand-cream)]">
                  <tr>
                    <Th>Reason</Th>
                    {matrix.sites.map((s) => (
                      <Th key={s} right>
                        {s}
                      </Th>
                    ))}
                    <Th right>Total</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--brand-line)]">
                  {matrix.groups.map((g) => (
                    <GroupRows key={g.cls} label={g.label} rows={g.rows} subtotal={g.subtotal} />
                  ))}
                  {matrix.unclassified.total > 0 ? (
                    <tr>
                      <Td>{UNCLASSIFIED_LABEL}</Td>
                      {matrix.unclassified.bySite.map((v, i) => (
                        <Td key={i} right>
                          {v || ""}
                        </Td>
                      ))}
                      <Td right bold>
                        {matrix.unclassified.total}
                      </Td>
                    </tr>
                  ) : null}
                  <tr className="font-bold bg-[var(--brand-cream)]">
                    <Td bold>Total terminations</Td>
                    {matrix.grand.bySite.map((v, i) => (
                      <Td key={i} right bold>
                        {v}
                      </Td>
                    ))}
                    <Td right bold>
                      {matrix.grand.total}
                    </Td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Section>

      <Section
        title="Plan against actual"
        subtitle={`Approved positions in force on ${period.end} against people in service on that day, per site.`}
      >
        {!planVsActual.hasPlan ? (
          <EmptyBox>
            No labour plan is in force for {period.label}
            {site ? ` at ${site}` : ""}.{" "}
            <Link
              href={`/${slug}/hr/reports/labour-plan/plan`}
              className="text-[var(--brand-red)] font-bold hover:underline"
            >
              Set the approved positions per site and designation
            </Link>{" "}
            and this section fills in. People in service are still counted below.
            {planVsActual.rows.length > 0 ? <PlanTable rows={planVsActual.rows} totals={planVsActual.totals} /> : null}
          </EmptyBox>
        ) : (
          <div className="space-y-5">
            <GroupedBars
              title="Plan against actual headcount by site"
              categories={planVsActual.rows.map((r) => r.site)}
              series={[
                { name: "Plan", colour: CHART_COLOURS.sand, values: planVsActual.rows.map((r) => r.planned) },
                { name: "Actual", colour: CHART_COLOURS.ink, values: planVsActual.rows.map((r) => r.actual) },
              ]}
            />
            <PlanTable rows={planVsActual.rows} totals={planVsActual.totals} />
          </div>
        )}
      </Section>

      <Section
        title="Six month trend"
        subtitle="Leavers by class and joiners for each of the last six months, ending on the month shown."
      >
        <GroupedBars
          title="Movement by month"
          categories={trend.map((m) => m.label)}
          series={[
            { name: "No fault", colour: CHART_COLOURS.slate, values: trend.map((m) => m.noFault) },
            { name: "Fault", colour: CHART_COLOURS.red, values: trend.map((m) => m.fault) },
            { name: "Joiners", colour: CHART_COLOURS.green, values: trend.map((m) => m.joiners) },
          ]}
        />
      </Section>

      <Section
        title="Leavers"
        subtitle={`Everyone whose last day fell in ${period.label}${site ? ` at ${site}` : ""}.`}
      >
        {leavers.length === 0 ? (
          <EmptyBox>
            Nobody left in {period.label}
            {site ? ` at ${site}` : ""}. If someone did, record their last day on the employee
            page under Leaving.
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
                  <Th>Last day</Th>
                  <Th>Reason</Th>
                  <Th>Class</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--brand-line)]">
                {leavers.map((l) => (
                  <tr key={l.id}>
                    <Td bold>
                      <Link
                        href={`/${slug}/hr/employees/${l.id}`}
                        className="hover:text-[var(--brand-red)] hover:underline"
                      >
                        {l.surname}
                      </Link>
                    </Td>
                    <Td>{l.names}</Td>
                    <Td>{l.designation}</Td>
                    <Td>{l.site}</Td>
                    <Td mono>{l.lastDay}</Td>
                    <Td>{l.reasonLabel}</Td>
                    <Td
                      className={
                        l.cls === "fault"
                          ? "text-red-700 font-bold"
                          : l.cls === "no_fault"
                            ? "text-[var(--brand-slate)]"
                            : "text-amber-700"
                      }
                    >
                      {l.clsLabel}
                    </Td>
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

function GroupRows({
  label,
  rows,
  subtotal,
}: {
  label: string;
  rows: Array<{ reason: string; label: string; bySite: number[]; total: number }>;
  subtotal: { bySite: number[]; total: number };
}) {
  return (
    <>
      <tr>
        <td
          colSpan={subtotal.bySite.length + 2}
          className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-widest font-bold text-[var(--brand-red)]"
        >
          {label}
        </td>
      </tr>
      {rows.map((r) => (
        <tr key={r.reason}>
          <Td>{r.label}</Td>
          {r.bySite.map((v, i) => (
            <Td key={i} right>
              {v || ""}
            </Td>
          ))}
          <Td right bold>
            {r.total}
          </Td>
        </tr>
      ))}
      <tr className="font-bold bg-[var(--brand-cream)]">
        <Td bold>{label} subtotal</Td>
        {subtotal.bySite.map((v, i) => (
          <Td key={i} right bold>
            {v}
          </Td>
        ))}
        <Td right bold>
          {subtotal.total}
        </Td>
      </tr>
    </>
  );
}

function PlanTable({
  rows,
  totals,
}: {
  rows: Array<{ site: string; planned: number; actual: number; variance: number; variancePct: number | null }>;
  totals: { planned: number; actual: number; variance: number; variancePct: number | null };
}) {
  return (
    <div className="overflow-x-auto mt-3">
      <table className="w-full text-sm">
        <thead className="bg-[var(--brand-cream)]">
          <tr>
            <Th>Site</Th>
            <Th right>Plan</Th>
            <Th right>Actual</Th>
            <Th right>Variance</Th>
            <Th right>Variance %</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--brand-line)]">
          {rows.map((r) => (
            <tr key={r.site}>
              <Td bold>{r.site}</Td>
              <Td right>{r.planned}</Td>
              <Td right>{r.actual}</Td>
              <Td right className={r.variance < 0 ? "text-red-700 font-bold" : r.variance > 0 ? "text-amber-700" : ""}>
                {formatSigned(r.variance)}
              </Td>
              <Td right>{formatPct(r.variancePct)}</Td>
            </tr>
          ))}
          <tr className="font-bold bg-[var(--brand-cream)]">
            <Td bold>Total</Td>
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
              {formatPct(totals.variancePct)}
            </Td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function EmptyBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[var(--brand-cream)] border border-[var(--brand-line)] rounded-xl p-4 text-sm text-[var(--brand-slate)]">
      {children}
    </div>
  );
}
