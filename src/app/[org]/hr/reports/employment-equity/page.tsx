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
  buildEmploymentEquity,
  EE_MISSING_LABELS,
  type EEMatrix,
} from "@/lib/reports/employment-equity";
import ReportShell, { Section, Stat, Th, Td } from "@/components/reports/ReportShell";
import { GroupedBars, StackedBar, CHART_COLOURS } from "@/lib/reports/charts";
import InlineField from "@/components/reports/InlineField";
import { isAdmin } from "@/lib/auth/roles";
import {
  disabilityOptions,
  disabilityValue,
  genderOptions,
  occupationalLevelOptions,
  populationGroupOptions,
} from "@/lib/reports/inline";

export const metadata = { title: "Employment equity" };
export const dynamic = "force-dynamic";

const POPIA_NOTE =
  "Population group and disability are the person's own EEA1 declaration. Certly never infers or defaults them.";

export default async function EmploymentEquityPage({
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

  const report = buildEmploymentEquity(employees, period, site);
  const { year, headcount, designated, completeness, byGroup, byLevel } = report;
  const exportHref = `/${slug}/hr/reports/employment-equity/export?period=${periodKey(period)}${site ? `&site=${encodeURIComponent(site)}` : ""}`;
  const scope = site ? ` at ${site}` : "";
  const canWrite = isAdmin(ctx.role);
  const missingTotal = completeness.people.length;

  return (
    <ReportShell
      slug={slug}
      orgName={ctx.org.name}
      reportKey="employment-equity"
      title="Employment equity"
      description={`The EEA2 workforce profile and movements for the Employment Equity reporting year ${year.label}, as far as the register allows. Profile is taken as at ${period.end}.`}
      period={period}
      site={site || undefined}
      sites={sitesFrom(employees, plans, candidates)}
      exportHref={exportHref}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="In service" value={headcount} hint={`On ${period.end}${scope}`} />
        <Stat
          label="Designated employer"
          value={designated ? "Yes" : "No"}
          tone={designated ? "amber" : undefined}
          hint={`Threshold is ${report.threshold} employees`}
        />
        <Stat
          label="Missing declarations"
          value={missingTotal}
          tone={missingTotal > 0 ? "red" : "green"}
          hint="People with at least one EEA1 field blank"
        />
        <Stat label="EE reporting year" value={year.label} hint="1 September to 31 August" />
      </div>

      <Section title="Designation check" subtitle="Whether this employer must submit an EEA2 for the reporting year.">
        <div className="space-y-2 text-sm">
          {designated ? (
            <p className="font-bold text-amber-700">
              Designated employer: an EEA2 is due by 15 January. {headcount} people were in service on{" "}
              {period.end}
              {scope}, at or above the threshold of {report.threshold}.
            </p>
          ) : (
            <p>
              {headcount} {headcount === 1 ? "person was" : "people were"} in service on {period.end}
              {scope}, below the threshold of {report.threshold}. The employer is not designated by
              headcount and EEA2 reporting is voluntary unless a collective agreement or a turnover
              threshold makes it designated.
            </p>
          )}
          {site ? (
            <p className="text-[var(--brand-slate)]">
              The EEA2 is per employer, not per site. Clear the site filter for the headcount that
              counts toward designation.
            </p>
          ) : null}
          {ctx.org.ee_reference ? (
            <p>
              EE reference number: <span className="font-mono">{ctx.org.ee_reference}</span>
            </p>
          ) : (
            <p className="text-[var(--brand-slate)]">
              No EE reference number is recorded for this workspace. An admin can add it under
              reporting settings.
            </p>
          )}
        </div>
      </Section>

      <Section
        title="Data completeness"
        subtitle={`The report is only as good as the declarations. People in service on ${period.end}${scope} with an EEA1 field still blank.`}
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Stat
            label="No gender"
            value={completeness.missingGender}
            tone={completeness.missingGender > 0 ? "amber" : undefined}
          />
          <Stat
            label="No population group"
            value={completeness.missingGroup}
            tone={completeness.missingGroup > 0 ? "amber" : undefined}
            hint="Foreign nationals are not counted here"
          />
          <Stat
            label="No disability declaration"
            value={completeness.missingDisability}
            tone={completeness.missingDisability > 0 ? "amber" : undefined}
          />
          <Stat
            label="No occupational level"
            value={completeness.missingLevel}
            tone={completeness.missingLevel > 0 ? "amber" : undefined}
          />
        </div>
        <p className="text-xs text-[var(--brand-slate)] mb-3">{POPIA_NOTE}</p>
        {completeness.people.length === 0 ? (
          <EmptyBox>
            Everyone in service on {period.end}
            {scope} has a full EEA1 declaration on record.
          </EmptyBox>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[var(--brand-slate)]">
              {missingTotal} {missingTotal === 1 ? "person has" : "people have"} at least one field
              blank.
              {canWrite
                ? " Capture each person's declaration in the row and the profile below recomputes on the next load."
                : " An admin can capture the declaration on the employee form under Employment equity declaration."}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--brand-cream)]">
                  <tr>
                    <Th>Surname</Th>
                    <Th>Names</Th>
                    <Th>Designation</Th>
                    <Th>Site</Th>
                    <Th>Missing</Th>
                    <Th>Gender</Th>
                    <Th>Population group</Th>
                    <Th>Disability</Th>
                    <Th>Occupational level</Th>
                    <Th>Declared on</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--brand-line)]">
                  {completeness.people.map((p) => (
                    <tr key={p.id}>
                      <Td bold>
                        <Link
                          href={`/${slug}/hr/employees/${p.id}`}
                          className="hover:text-[var(--brand-red)] hover:underline"
                        >
                          {p.surname}
                        </Link>
                      </Td>
                      <Td>{p.names}</Td>
                      <Td>{p.designation}</Td>
                      <Td>{p.site}</Td>
                      <Td className="text-amber-700 text-xs">
                        {p.missing.map((m) => EE_MISSING_LABELS[m]).join(", ")}
                      </Td>
                      <Td>
                        {canWrite ? (
                          <InlineField
                            orgId={ctx.org.id}
                            slug={slug}
                            employeeId={p.id}
                            name="gender"
                            kind="select"
                            value={p.gender}
                            options={genderOptions()}
                            placeholder="Not declared"
                            width="w-32"
                          />
                        ) : (
                          <span>{labelOf(genderOptions(), p.gender)}</span>
                        )}
                      </Td>
                      <Td>
                        {canWrite ? (
                          <InlineField
                            orgId={ctx.org.id}
                            slug={slug}
                            employeeId={p.id}
                            name="population_group"
                            kind="select"
                            value={p.populationGroup}
                            options={populationGroupOptions()}
                            placeholder="Not declared"
                            width="w-32"
                          />
                        ) : (
                          <span>{labelOf(populationGroupOptions(), p.populationGroup)}</span>
                        )}
                      </Td>
                      <Td>
                        {canWrite ? (
                          <InlineField
                            orgId={ctx.org.id}
                            slug={slug}
                            employeeId={p.id}
                            name="disability"
                            kind="select"
                            value={disabilityValue(p.disability)}
                            options={disabilityOptions()}
                            placeholder="Not declared"
                            width="w-28"
                          />
                        ) : (
                          <span>{labelOf(disabilityOptions(), disabilityValue(p.disability))}</span>
                        )}
                      </Td>
                      <Td>
                        {canWrite ? (
                          <InlineField
                            orgId={ctx.org.id}
                            slug={slug}
                            employeeId={p.id}
                            name="occupational_level"
                            kind="select"
                            value={p.occupationalLevel}
                            options={occupationalLevelOptions()}
                            placeholder="Not set"
                            width="w-44"
                          />
                        ) : (
                          <span>{labelOf(occupationalLevelOptions(), p.occupationalLevel)}</span>
                        )}
                      </Td>
                      <Td mono>
                        {canWrite ? (
                          <InlineField
                            orgId={ctx.org.id}
                            slug={slug}
                            employeeId={p.id}
                            name="ee_declared_at"
                            kind="date"
                            value={p.eeDeclaredAt}
                            max={period.end}
                          />
                        ) : (
                          <span>{p.eeDeclaredAt ?? ""}</span>
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

      <Section
        title="Workforce profile"
        subtitle={`EEA2 section B. Everyone in service on ${period.end}${scope} by occupational level. Foreign nationals are counted only in the foreign national columns, as on the form.`}
      >
        {headcount === 0 ? (
          <EmptyBox>
            Nobody was in service on {period.end}
            {scope}. Start dates are captured on the employee form under Service and retirement.
          </EmptyBox>
        ) : (
          <div className="space-y-6">
            <MatrixTable matrix={report.profile} />
            <StackedBar
              title="Total workforce by population group"
              segments={[
                { label: "African", value: byGroup.african, colour: CHART_COLOURS.ink },
                { label: "Coloured", value: byGroup.coloured, colour: CHART_COLOURS.slate },
                { label: "Indian", value: byGroup.indian, colour: CHART_COLOURS.amber },
                { label: "White", value: byGroup.white, colour: CHART_COLOURS.sand },
                { label: "Not declared", value: byGroup.notDeclared, colour: "#E5E0D8" },
                { label: "Foreign nationals", value: byGroup.foreign, colour: CHART_COLOURS.green },
              ]}
            />
            <GroupedBars
              title="Male and female by occupational level"
              categories={byLevel.categories}
              series={[
                { name: "Male", colour: CHART_COLOURS.ink, values: byLevel.male },
                { name: "Female", colour: CHART_COLOURS.red, values: byLevel.female },
              ]}
            />
            <p className="text-xs text-[var(--brand-slate)]">
              {POPIA_NOTE} People with no occupational level sit in the Level not set row and are
              not in the chart until the level is captured.
            </p>
          </div>
        )}
      </Section>

      <Section
        title="Persons with disabilities"
        subtitle={`EEA2 section B, persons with disabilities only. People in service on ${period.end}${scope} who declared a disability.`}
      >
        {report.profileDisabled.totals.total === 0 ? (
          <EmptyBox>
            Nobody in service on {period.end}
            {scope} has declared a disability.
            {completeness.missingDisability > 0
              ? ` ${completeness.missingDisability} ${completeness.missingDisability === 1 ? "person has" : "people have"} no declaration yet; see Data completeness above.`
              : ""}
          </EmptyBox>
        ) : (
          <div className="space-y-3">
            <MatrixTable matrix={report.profileDisabled} />
            <p className="text-xs text-[var(--brand-slate)]">{POPIA_NOTE}</p>
          </div>
        )}
      </Section>

      <Section
        title="Workforce movements"
        subtitle={`EEA2 section C for the reporting year ${year.label}${scope}. Recruits by start date, terminations by last day of service. Promotions are not tracked in Certly and are not reported here.`}
      >
        <div className="space-y-6">
          <div>
            <h3 className="font-bold text-sm mb-2">Recruits</h3>
            {report.recruits.totals.total === 0 ? (
              <EmptyBox>
                No start dates fall in {year.label}
                {scope}. Start dates are captured on the employee form under Service and retirement.
              </EmptyBox>
            ) : (
              <MatrixTable matrix={report.recruits} />
            )}
          </div>
          <div>
            <h3 className="font-bold text-sm mb-2">Terminations</h3>
            {report.terminations.totals.total === 0 ? (
              <EmptyBox>
                No terminations fall in {year.label}
                {scope}. Terminations are recorded on the employee page under Leaving.
              </EmptyBox>
            ) : (
              <MatrixTable matrix={report.terminations} />
            )}
          </div>
        </div>
      </Section>
    </ReportShell>
  );
}

function labelOf(options: Array<{ value: string; label: string }>, value: string | null): string {
  if (!value) return "";
  return options.find((o) => o.value === value)?.label ?? value;
}

function MatrixTable({ matrix }: { matrix: EEMatrix }) {
  const groups: Array<{ name: string; span: number }> = [];
  for (const c of matrix.columns) {
    const last = groups[groups.length - 1];
    if (last && last.name === c.group) last.span += 1;
    else groups.push({ name: c.group, span: 1 });
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[var(--brand-cream)]">
          <tr>
            <Th>Occupational level</Th>
            {groups.map((g) => (
              <th
                key={g.name}
                colSpan={g.span}
                className="px-3 py-2 font-bold uppercase tracking-widest text-[10px] text-[var(--brand-slate)] text-center border-l border-[var(--brand-line)]"
              >
                {g.name}
              </th>
            ))}
            <Th right>Total</Th>
          </tr>
          <tr>
            <Th>{""}</Th>
            {matrix.columns.map((c) => (
              <Th key={c.key} right>
                {c.short}
              </Th>
            ))}
            <Th right>{""}</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--brand-line)]">
          {matrix.rows.map((r) => (
            <tr key={r.key} className={r.key === "total" ? "font-bold bg-[var(--brand-cream)]" : ""}>
              <Td className={r.key === "unset" ? "text-amber-700" : ""}>{r.shortLabel}</Td>
              {matrix.columns.map((c) => (
                <Td key={c.key} right className={r.cells[c.key] === 0 ? "text-[var(--brand-slate)]" : ""}>
                  {r.cells[c.key]}
                </Td>
              ))}
              <Td right bold>
                {r.total}
              </Td>
            </tr>
          ))}
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
