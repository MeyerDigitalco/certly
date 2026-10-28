import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { parsePeriod, periodKey } from "@/lib/hr/operations";
import {
  getEmployeesForReports,
  getLabourPlans,
  getOnboardingCandidates,
  sitesFrom,
} from "@/lib/reports/data";
import { buildRetirement, type RetirementStatus } from "@/lib/reports/retirement";
import ReportShell, { Section, Stat, Th, Td } from "@/components/reports/ReportShell";
import { GroupedBars, StackedBar, CHART_COLOURS } from "@/lib/reports/charts";
import InlineField from "@/components/reports/InlineField";
import { isAdmin } from "@/lib/auth/roles";
import { retirementAgeOptions } from "@/lib/reports/inline";

export const metadata = { title: "Overdue retirement" };
export const dynamic = "force-dynamic";

export default async function RetirementPage({
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
  const period = parsePeriod(sp.period);
  const site = (sp.site ?? "").trim();

  const [employees, plans, candidates] = await Promise.all([
    getEmployeesForReports(ctx.org.id),
    getLabourPlans(ctx.org.id),
    getOnboardingCandidates(ctx.org.id),
  ]);

  const report = buildRetirement(employees, period, ctx.org.default_retirement_age, site);
  const { counts, rows, missingDob, bySite } = report;
  const exportHref = `/${slug}/hr/reports/retirement/export?period=${periodKey(period)}${site ? `&site=${encodeURIComponent(site)}` : ""}`;
  const scope = site ? ` at ${site}` : "";
  const canWrite = isAdmin(ctx.role);
  const ageOptions = retirementAgeOptions(ctx.org.default_retirement_age);

  return (
    <ReportShell
      slug={slug}
      orgName={ctx.org.name}
      reportKey="retirement"
      title="Overdue retirement"
      description="Everyone in service at month end who is past their retirement date, working on an approved extension, retiring this month, or due within the next six months."
      period={period}
      site={site || undefined}
      sites={sitesFrom(employees, plans, candidates)}
      exportHref={exportHref}
    >
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat
          label="Overdue"
          value={counts.overdue}
          tone={counts.overdue > 0 ? "red" : undefined}
          hint="Past retirement date, no current approval"
        />
        <Stat
          label="On approved extension"
          value={counts.extended}
          tone={counts.extended > 0 ? "amber" : undefined}
          hint="Past retirement date, extension approved"
        />
        <Stat label="Retiring this month" value={counts.dueThisMonth} hint={`Retirement date in ${period.label}`} />
        <Stat label="Due in next 6 months" value={counts.dueSoon} hint={`Up to ${report.windowEnd}`} />
        <Stat
          label="Missing date of birth"
          value={counts.missingDob}
          tone={counts.missingDob > 0 ? "amber" : undefined}
          hint="Cannot be assessed"
        />
      </div>

      <Section
        title="Retirement position"
        subtitle={`People in service on ${period.end}${scope}, by status and by site. Retirement age is ${report.defaultRetirementAge} unless the employee record says otherwise.`}
      >
        {rows.length === 0 ? (
          <EmptyBox>
            Nobody in service on {period.end}
            {scope} is at or within six months of retirement.
            {counts.missingDob > 0 ? (
              <>
                {" "}
                {counts.missingDob} {counts.missingDob === 1 ? "person has" : "people have"} no date of
                birth recorded and cannot be assessed. See the list at the bottom of this page.
              </>
            ) : null}
          </EmptyBox>
        ) : (
          <div className="space-y-5">
            <StackedBar
              title="By status"
              segments={[
                { label: "Overdue", value: counts.overdue, colour: CHART_COLOURS.red },
                { label: "On approved extension", value: counts.extended, colour: CHART_COLOURS.amber },
                { label: "Retiring this month", value: counts.dueThisMonth, colour: CHART_COLOURS.ink },
                { label: "Due in next 6 months", value: counts.dueSoon, colour: CHART_COLOURS.slate },
              ]}
            />
            <GroupedBars
              title="By site"
              categories={bySite.sites}
              series={[
                { name: "Overdue", colour: CHART_COLOURS.red, values: bySite.overdue },
                { name: "Extended", colour: CHART_COLOURS.amber, values: bySite.extended },
                { name: "Due in 6 months", colour: CHART_COLOURS.slate, values: bySite.dueWithinSix },
              ]}
            />
            <p className="text-xs text-[var(--brand-slate)]">
              Due in 6 months includes people retiring this month.
            </p>
          </div>
        )}
      </Section>

      <Section
        title="Retirement schedule"
        subtitle={`Overdue first, then by official retirement date. The official date is the last day of the month in which the person reaches retirement age. Identity numbers are masked on screen and shown in full in the Excel export.`}
      >
        {rows.length === 0 ? (
          <EmptyBox>
            No one to list for {period.label}
            {scope}. Retirement dates come from the date of birth and retirement age on the
            employee form under Service and retirement. Approved extensions are captured in the
            same place.
          </EmptyBox>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--brand-cream)]">
                <tr>
                  <Th>Surname</Th>
                  <Th>Names</Th>
                  <Th>ID number</Th>
                  <Th>Designation</Th>
                  <Th>Site</Th>
                  <Th>Date of birth</Th>
                  <Th right>Age</Th>
                  <Th right>Retirement age</Th>
                  <Th>Official date</Th>
                  <Th>Approved date</Th>
                  <Th>Status</Th>
                  <Th right>Months</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--brand-line)]">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <Td bold>
                      <Link
                        href={`/${slug}/hr/employees/${r.id}`}
                        className="hover:text-[var(--brand-red)] hover:underline"
                      >
                        {r.surname}
                      </Link>
                    </Td>
                    <Td>{r.names}</Td>
                    <Td mono>{r.idMasked}</Td>
                    <Td>{r.designation}</Td>
                    <Td>{r.site}</Td>
                    <Td mono>{r.dateOfBirth}</Td>
                    <Td right>{r.age}</Td>
                    <Td right>
                      {canWrite ? (
                        <InlineField
                          orgId={ctx.org.id}
                          slug={slug}
                          employeeId={r.id}
                          name="retirement_age"
                          kind="select"
                          value={r.ageIsDefault ? "" : r.retirementAge}
                          options={ageOptions}
                          placeholder={`Default (${ctx.org.default_retirement_age})`}
                          width="w-32"
                        />
                      ) : null}
                      <span className={canWrite ? "hidden print:inline" : ""}>
                        {r.retirementAge}
                        {r.ageIsDefault ? (
                          <span className="text-[var(--brand-slate)] text-xs"> (default)</span>
                        ) : null}
                      </span>
                    </Td>
                    <Td mono>{r.officialDate}</Td>
                    <Td mono>
                      {canWrite ? (
                        <InlineField
                          orgId={ctx.org.id}
                          slug={slug}
                          employeeId={r.id}
                          name="approved_retirement_date"
                          kind="date"
                          value={r.approvedDate}
                          min={r.officialDate}
                        />
                      ) : null}
                      <span className={canWrite ? "hidden print:inline" : ""}>{r.approvedDate ?? ""}</span>
                    </Td>
                    <Td className={statusClass(r.status)}>{r.statusLabel}</Td>
                    <Td right className={r.status === "overdue" ? "text-red-700 font-bold" : ""}>
                      {r.monthsLabel}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        title="Missing date of birth"
        subtitle="People in service with no date of birth on record. They cannot be assessed for retirement until it is captured."
      >
        {missingDob.length === 0 ? (
          <EmptyBox>
            Everyone in service on {period.end}
            {scope} has a date of birth recorded.
          </EmptyBox>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[var(--brand-slate)]">
              {missingDob.length} {missingDob.length === 1 ? "person has" : "people have"} no date of
              birth recorded.
              {canWrite
                ? " Type it in the Fix column and the person is assessed on the next load."
                : " An admin can add it on the employee form under Service and retirement."}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--brand-cream)]">
                  <tr>
                    <Th>Surname</Th>
                    <Th>Names</Th>
                    <Th>Designation</Th>
                    <Th>Site</Th>
                    <Th>Fix</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--brand-line)]">
                  {missingDob.map((m) => (
                    <tr key={m.id}>
                      <Td bold>
                        <Link
                          href={`/${slug}/hr/employees/${m.id}`}
                          className="hover:text-[var(--brand-red)] hover:underline"
                        >
                          {m.surname}
                        </Link>
                      </Td>
                      <Td>{m.names}</Td>
                      <Td>{m.designation}</Td>
                      <Td>{m.site}</Td>
                      <Td>
                        {canWrite ? (
                          <InlineField
                            orgId={ctx.org.id}
                            slug={slug}
                            employeeId={m.id}
                            name="date_of_birth"
                            kind="date"
                            value={null}
                            max={period.end}
                          />
                        ) : (
                          <Link
                            href={`/${slug}/hr/employees/${m.id}`}
                            className="text-[var(--brand-red)] text-xs font-bold hover:underline print:hidden"
                          >
                            Open employee
                          </Link>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Section>
    </ReportShell>
  );
}

function statusClass(status: RetirementStatus): string {
  if (status === "overdue") return "text-red-700 font-bold";
  if (status === "extended") return "text-amber-700 font-bold";
  if (status === "due_this_month") return "font-bold";
  return "text-[var(--brand-slate)]";
}

function EmptyBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[var(--brand-cream)] border border-[var(--brand-line)] rounded-xl p-4 text-sm text-[var(--brand-slate)]">
      {children}
    </div>
  );
}
