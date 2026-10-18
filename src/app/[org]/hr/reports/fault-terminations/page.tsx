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
  buildFaultTerminations,
  FAULT_REASON_NOTE,
  formatPct,
  formatSigned,
  MONTH_SHORT,
} from "@/lib/reports/fault-terminations";
import ReportShell, { Section, Stat, Th, Td } from "@/components/reports/ReportShell";
import { GroupedBars, CHART_COLOURS } from "@/lib/reports/charts";
import InlineField from "@/components/reports/InlineField";
import RecordLeaver from "@/components/reports/RecordLeaver";
import { isAdmin } from "@/lib/auth/roles";
import {
  defaultLastDay,
  leaverCandidates,
  terminationReasonOptions,
} from "@/lib/reports/inline";

export const metadata = { title: "Fault terminations" };
export const dynamic = "force-dynamic";

export default async function FaultTerminationsPage({
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

  const report = buildFaultTerminations(employees, period, site);
  const { stats, current, previous, months, totals, bySite, bySiteTotals, leavers } = report;
  const exportHref = `/${slug}/hr/reports/fault-terminations/export?period=${periodKey(period)}${site ? `&site=${encodeURIComponent(site)}` : ""}`;

  const scope = site ? ` at ${site}` : "";
  const ytdLabel = `YTD to ${period.label}`;
  const canWrite = isAdmin(ctx.role);
  const reasonOptions = terminationReasonOptions();
  const leaverPool = canWrite ? leaverCandidates(employees, period.end, site) : [];
  const lastDay = defaultLastDay(period.end);
  const changeTone = stats.change > 0 ? "red" : stats.change < 0 ? "green" : undefined;
  const nothingAtAll = !report.hasAnyTermination;
  const noFaultData =
    stats.currentYtd.total === 0 && stats.previousFullYear.total === 0 && current.total.every((v) => v === 0);

  return (
    <ReportShell
      slug={slug}
      orgName={ctx.org.name}
      reportKey="fault-terminations"
      title="Fault terminations"
      description={`Resignations, dismissals and abscondments by month for ${report.currentYear} against ${report.previousYear}. The current year runs to the selected month; the previous year is shown in full.`}
      period={period}
      site={site || undefined}
      sites={sitesFrom(employees, plans, candidates)}
      exportHref={exportHref}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          label={`${report.currentYear} fault terminations`}
          value={stats.currentYtd.total}
          tone={stats.currentYtd.total > 0 ? "red" : undefined}
          hint={ytdLabel}
        />
        <Stat
          label={`${report.previousYear} same months`}
          value={stats.previousSameMonths.total}
          hint={`January to ${MONTH_SHORT[period.month - 1]} ${report.previousYear}`}
        />
        <Stat
          label="Change"
          value={formatSigned(stats.change)}
          tone={changeTone}
          hint={
            stats.changePct === null
              ? `No fault terminations in the same months of ${report.previousYear}`
              : `${formatPct(stats.changePct)} against ${report.previousYear}`
          }
        />
        <div className="border border-[var(--brand-line)] rounded-xl p-4 bg-white">
          <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--brand-slate)]">
            {report.currentYear} split
          </p>
          <dl className="mt-2 space-y-1 text-sm">
            <SplitLine label="Resignations" value={stats.currentYtd.resignation} colour={CHART_COLOURS.slate} />
            <SplitLine label="Dismissals" value={stats.currentYtd.dismissal} colour={CHART_COLOURS.red} />
            <SplitLine label="Abscondments" value={stats.currentYtd.abscondment} colour={CHART_COLOURS.amber} />
          </dl>
          <p className="text-xs text-[var(--brand-slate)] mt-1">{ytdLabel}</p>
        </div>
      </div>

      {nothingAtAll ? (
        <EmptyBox>
          No terminations are recorded in the register{scope}. When someone leaves, open their
          employee page and record the last day and the reason under Leaving. Resignations,
          dismissals and abscondments then appear here month by month.
        </EmptyBox>
      ) : noFaultData ? (
        <EmptyBox>
          No fault terminations are recorded for {report.currentYear} or {report.previousYear}
          {scope}. Leavers with a no fault reason (death, retirement, ill health, contract end,
          retrenchment) are not counted on this report. If a resignation, dismissal or
          abscondment is missing, record the reason on the employee page under Leaving.
        </EmptyBox>
      ) : null}

      <Section
        title="Year on year"
        subtitle={`Fault terminations per month, ${report.previousYear} against ${report.currentYear}${scope}. Months after ${period.label} show what is recorded so far.`}
      >
        <GroupedBars
          title="Fault terminations by month"
          categories={MONTH_SHORT}
          series={[
            { name: String(report.previousYear), colour: CHART_COLOURS.sand, values: previous.total },
            { name: String(report.currentYear), colour: CHART_COLOURS.ink, values: current.total },
          ]}
        />
      </Section>

      <Section
        title={`${report.currentYear} by reason`}
        subtitle={`Resignations, dismissals and abscondments per month for ${report.currentYear}${scope}.`}
      >
        <GroupedBars
          title={`Fault terminations by reason, ${report.currentYear}`}
          categories={MONTH_SHORT}
          series={[
            { name: "Resignations", colour: CHART_COLOURS.slate, values: current.resignation },
            { name: "Dismissals", colour: CHART_COLOURS.red, values: current.dismissal },
            { name: "Abscondments", colour: CHART_COLOURS.amber, values: current.abscondment },
          ]}
        />
      </Section>

      <Section
        title="By month"
        subtitle={`${report.previousYear} total against the ${report.currentYear} split${scope}. The totals row counts ${report.previousYear} in full and ${report.currentYear} ${ytdLabel}; change compares the same months in both years.`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--brand-cream)]">
              <tr>
                <Th>Month</Th>
                <Th right>{report.previousYear} total</Th>
                <Th right>Resignations</Th>
                <Th right>Dismissals</Th>
                <Th right>Abscondments</Th>
                <Th right>{report.currentYear} total</Th>
                <Th right>Change</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--brand-line)]">
              {months.map((m) => (
                <tr key={m.month} className={m.toDate ? "text-[var(--brand-slate)]" : ""}>
                  <Td bold>
                    {m.label}
                    {m.toDate ? <span className="ml-2 text-[10px] uppercase tracking-widest font-normal">to date</span> : null}
                  </Td>
                  <Td right>{m.previousTotal || ""}</Td>
                  <Td right>{m.resignation || ""}</Td>
                  <Td right>{m.dismissal || ""}</Td>
                  <Td right>{m.abscondment || ""}</Td>
                  <Td right bold>
                    {m.currentTotal}
                  </Td>
                  <Td right className={m.change > 0 ? "text-red-700 font-bold" : m.change < 0 ? "text-emerald-700" : ""}>
                    {formatSigned(m.change)}
                  </Td>
                </tr>
              ))}
              <tr className="font-bold bg-[var(--brand-cream)]">
                <Td bold>
                  Total
                  <span className="ml-2 text-[10px] uppercase tracking-widest font-normal">
                    {report.previousYear} full year, {report.currentYear} {ytdLabel}
                  </span>
                </Td>
                <Td right bold>
                  {totals.previousTotal}
                </Td>
                <Td right bold>
                  {totals.resignation}
                </Td>
                <Td right bold>
                  {totals.dismissal}
                </Td>
                <Td right bold>
                  {totals.abscondment}
                </Td>
                <Td right bold>
                  {totals.currentTotal}
                </Td>
                <Td right bold className={totals.change > 0 ? "text-red-700" : totals.change < 0 ? "text-emerald-700" : ""}>
                  {formatSigned(totals.change)}
                </Td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="Fault leavers this month"
        subtitle={`Resignations, dismissals and abscondments with a last day in ${period.label}${scope}.`}
      >
        {canWrite ? (
          <div className="mb-4">
            <RecordLeaver
              orgId={ctx.org.id}
              slug={slug}
              employees={leaverPool}
              defaultDate={lastDay.defaultDate}
              maxDate={lastDay.maxDate}
              faultOnly
            />
          </div>
        ) : null}
        {leavers.length === 0 ? (
          <EmptyBox>
            No fault terminations in {period.label}
            {scope}. If someone resigned, was dismissed or absconded,
            {canWrite
              ? " use Record a leaver above or the employee page under Leaving."
              : " an admin can record the last day and the reason on the employee page under Leaving."}
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
                    <Td mono>
                      {canWrite ? (
                        <>
                          <InlineField
                            orgId={ctx.org.id}
                            slug={slug}
                            employeeId={l.id}
                            name="terminated_at"
                            kind="date"
                            value={l.lastDay}
                            max={lastDay.maxDate}
                          />
                          <span className="hidden print:inline">{l.lastDay}</span>
                        </>
                      ) : (
                        l.lastDay
                      )}
                    </Td>
                    <Td className="text-red-700 font-bold">
                      {canWrite ? (
                        <>
                          <InlineField
                            orgId={ctx.org.id}
                            slug={slug}
                            employeeId={l.id}
                            name="termination_reason"
                            kind="select"
                            value={l.reason}
                            options={reasonOptions}
                            width="w-44"
                          />
                          <span className="hidden print:inline">{l.reasonLabel}</span>
                        </>
                      ) : (
                        l.reasonLabel
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        title={`By site, ${report.currentYear}`}
        subtitle={`Fault terminations per site, ${ytdLabel}${scope}.`}
      >
        {bySite.length === 0 ? (
          <EmptyBox>
            No fault terminations recorded for {report.currentYear} {ytdLabel}
            {scope}.
          </EmptyBox>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--brand-cream)]">
                <tr>
                  <Th>Site</Th>
                  <Th right>Resignations</Th>
                  <Th right>Dismissals</Th>
                  <Th right>Abscondments</Th>
                  <Th right>Total</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--brand-line)]">
                {bySite.map((r) => (
                  <tr key={r.site}>
                    <Td bold>{r.site}</Td>
                    <Td right>{r.resignation || ""}</Td>
                    <Td right>{r.dismissal || ""}</Td>
                    <Td right>{r.abscondment || ""}</Td>
                    <Td right bold>
                      {r.total}
                    </Td>
                  </tr>
                ))}
                <tr className="font-bold bg-[var(--brand-cream)]">
                  <Td bold>Total</Td>
                  <Td right bold>
                    {bySiteTotals.resignation}
                  </Td>
                  <Td right bold>
                    {bySiteTotals.dismissal}
                  </Td>
                  <Td right bold>
                    {bySiteTotals.abscondment}
                  </Td>
                  <Td right bold>
                    {bySiteTotals.total}
                  </Td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <p className="text-xs text-[var(--brand-slate)]">{FAULT_REASON_NOTE}</p>
    </ReportShell>
  );
}

function SplitLine({ label, value, colour }: { label: string; value: number; colour: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="inline-flex items-center gap-1.5 text-[var(--brand-slate)]">
        <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: colour }} />
        {label}
      </dt>
      <dd className="font-bold">{value}</dd>
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
