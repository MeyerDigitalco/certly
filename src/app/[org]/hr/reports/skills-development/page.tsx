import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { parsePeriod, periodKey, SETAS } from "@/lib/hr/operations";
import {
  getEmployeesForReports,
  getLabourPlans,
  getOnboardingCandidates,
  getTrainingDelivered,
  getTrainingPlans,
  getTrainingTypesForReports,
  sitesFrom,
} from "@/lib/reports/data";
import {
  buildSkillsDevelopment,
  DEMO_GROUP_COLUMNS,
  formatRands,
  type WspGroup,
} from "@/lib/reports/skills-development";
import ReportShell, { Section, Stat, Th, Td } from "@/components/reports/ReportShell";
import { GroupedBars, StackedBar, CHART_COLOURS } from "@/lib/reports/charts";
import { isAdmin } from "@/lib/auth/roles";
import ReportingSettings from "./ReportingSettings";

export const metadata = { title: "Skills development" };
export const dynamic = "force-dynamic";

const GROUP_COLOURS: string[] = [
  CHART_COLOURS.ink,
  CHART_COLOURS.red,
  CHART_COLOURS.amber,
  CHART_COLOURS.sand,
  CHART_COLOURS.slate,
  CHART_COLOURS.green,
];

export default async function SkillsDevelopmentPage({
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

  const [employees, types, delivered, trainingPlans, plans, candidates] = await Promise.all([
    getEmployeesForReports(ctx.org.id),
    getTrainingTypesForReports(ctx.org.id),
    getTrainingDelivered(ctx.org.id),
    getTrainingPlans(ctx.org.id),
    getLabourPlans(ctx.org.id),
    getOnboardingCandidates(ctx.org.id),
  ]);

  const report = buildSkillsDevelopment(employees, types, delivered, trainingPlans, period, site);
  const { year, nextYear, courses, courseTotals, demographics, bbbee, wsp, byCategory, readiness } =
    report;
  const exportHref = `/${slug}/hr/reports/skills-development/export?period=${periodKey(period)}${site ? `&site=${encodeURIComponent(site)}` : ""}`;
  const scope = site ? ` at ${site}` : "";
  const canWrite = isAdmin(ctx.role);
  const setaLabel = ctx.org.seta
    ? (SETAS.find((s) => s.value === ctx.org.seta)?.label ?? ctx.org.seta)
    : "SETA not set";
  const base = `/${slug}/hr/reports/skills-development`;
  const stackSegments = demographics.byGroup
    .filter((g) => g.value > 0)
    .map((g, i) => ({ label: g.label, value: g.value, colour: GROUP_COLOURS[i % GROUP_COLOURS.length] }));

  return (
    <ReportShell
      slug={slug}
      orgName={ctx.org.name}
      reportKey="skills-development"
      title="Skills development"
      description="The Annual Training Report for the SETA year this month falls in, the B-BBEE skills development inputs that come out of it, and the Workplace Skills Plan for the year after."
      period={period}
      site={site || undefined}
      sites={sitesFrom(employees, plans, candidates)}
      exportHref={exportHref}
    >
      <div className={`grid gap-4 ${canWrite ? "lg:grid-cols-[1fr_380px]" : ""} items-start`}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="SETA" value={setaLabel} hint={ctx.org.sdl_number ? `SDL ${ctx.org.sdl_number}` : "No SDL number"} />
          <Stat label="SETA year" value={String(year.year)} hint={year.label} />
          <Stat label="WSP and ATR due" value={year.due} hint="30 April after the year ends" />
          <Stat label="People trained" value={demographics.peopleTrained} hint={`Distinct people${scope}`} />
        </div>
        {canWrite ? (
          <ReportingSettings
            orgId={ctx.org.id}
            slug={slug}
            seta={ctx.org.seta}
            sdlNumber={ctx.org.sdl_number}
            eeReference={ctx.org.ee_reference}
            defaultRetirementAge={ctx.org.default_retirement_age}
          />
        ) : null}
      </div>

      <Section
        title="Annual Training Report by course"
        subtitle={`Training delivered between ${year.start} and ${year.end}${scope}: one line per course, counting each person once per course. Hours and cost are the course figures times the people trained.`}
      >
        {courses.length === 0 ? (
          <EmptyBox>
            No training that counts for the ATR was recorded between {year.start} and {year.end}
            {scope}. Certificates with a training date in that window feed this table. Only courses
            ticked as counting for the ATR are included; set that on the{" "}
            <Link href={`${base}/types`} className="text-[var(--brand-red)] font-bold hover:underline">
              course details page
            </Link>
            .
          </EmptyBox>
        ) : (
          <div className="space-y-5">
            <GroupedBars
              title="People by training category"
              categories={byCategory.categories}
              series={[
                { name: `Trained ${year.year}`, colour: CHART_COLOURS.ink, values: byCategory.trained },
                { name: `Planned ${nextYear.year}`, colour: CHART_COLOURS.sand, values: byCategory.planned },
              ]}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--brand-cream)]">
                  <tr>
                    <Th>Course</Th>
                    <Th>Category</Th>
                    <Th>Provider</Th>
                    <Th right>NQF</Th>
                    <Th>Accredited</Th>
                    <Th right>People</Th>
                    <Th right>Hours</Th>
                    <Th right>Cost</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--brand-line)]">
                  {courses.map((c) => (
                    <tr key={c.typeId}>
                      <Td bold>{c.course}</Td>
                      <Td>{c.categoryLabel}</Td>
                      <Td>{c.provider}</Td>
                      <Td right>{c.nqf ?? ""}</Td>
                      <Td>{c.accredited ? "Yes" : "No"}</Td>
                      <Td right>{c.people}</Td>
                      <Td right>{c.hours ?? ""}</Td>
                      <Td right mono>{formatRands(c.cost)}</Td>
                    </tr>
                  ))}
                  <tr className="font-bold bg-[var(--brand-cream)]">
                    <Td bold>Total</Td>
                    <Td>{""}</Td>
                    <Td>{""}</Td>
                    <Td>{""}</Td>
                    <Td>{""}</Td>
                    <Td right>{courseTotals.people}</Td>
                    <Td right>{courseTotals.hours}</Td>
                    <Td right mono>{formatRands(courseTotals.cost)}</Td>
                  </tr>
                </tbody>
              </table>
            </div>
            {!courseTotals.hoursComplete || !courseTotals.costComplete ? (
              <p className="text-xs text-amber-700">
                Some courses have no hours or no cost on record, so the totals understate the year.
                See data readiness at the bottom of this page.
              </p>
            ) : null}
          </div>
        )}
      </Section>

      <Section
        title="People trained"
        subtitle={`Distinct people trained between ${year.start} and ${year.end}${scope}, by population group and gender in the EEA2 column order. Foreign nationals are shown in their own column and not under a population group.`}
      >
        {demographics.peopleTrained === 0 ? (
          <EmptyBox>Nobody was trained in the year{scope}, so there is nothing to break down.</EmptyBox>
        ) : (
          <div className="space-y-5">
            {stackSegments.length > 0 ? (
              <StackedBar title="By population group" segments={stackSegments} />
            ) : null}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--brand-cream)]">
                  <tr>
                    <Th>Gender</Th>
                    {DEMO_GROUP_COLUMNS.map((c) => (
                      <Th key={c.key} right>
                        {c.label}
                      </Th>
                    ))}
                    <Th right>Total</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--brand-line)]">
                  {demographics.rows.map((r) => (
                    <tr
                      key={r.key}
                      className={r.key === "total" ? "font-bold bg-[var(--brand-cream)]" : ""}
                    >
                      <Td bold={r.key === "total"}>{r.label}</Td>
                      {DEMO_GROUP_COLUMNS.map((c) => (
                        <Td key={c.key} right>
                          {r.cells[c.key]}
                        </Td>
                      ))}
                      <Td right>{r.total}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-[var(--brand-slate)]">
              Population group, gender and disability are the person&apos;s own EEA1 declaration as
              captured on the employee form. Certly never infers or defaults them.
            </p>
          </div>
        )}
      </Section>

      <Section
        title="B-BBEE skills development inputs"
        subtitle="The figures a verification agency asks for under the skills development element. Black people means African, Coloured and Indian, as the B-BBEE Act defines the term. Certly does not check citizenship."
      >
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Total training spend" value={formatRands(bbbee.totalSpend)} hint={`Course cost times people, ${year.label}`} />
            <Stat label="Spend on black people" value={formatRands(bbbee.blackSpend)} />
            <Stat label="Black people trained" value={bbbee.blackPeople} hint={`${bbbee.blackWomen} black women`} />
            <Stat label="With a disability" value={bbbee.disabledPeople} hint="People trained who declared a disability" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--brand-cream)]">
                <tr>
                  <Th>Input</Th>
                  <Th right>Value</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--brand-line)]">
                <tr>
                  <Td>Total training spend</Td>
                  <Td right mono>{formatRands(bbbee.totalSpend)}</Td>
                </tr>
                <tr>
                  <Td>Training spend on black people</Td>
                  <Td right mono>{formatRands(bbbee.blackSpend)}</Td>
                </tr>
                <tr>
                  <Td>Black people trained</Td>
                  <Td right>{bbbee.blackPeople}</Td>
                </tr>
                <tr>
                  <Td>Black women trained</Td>
                  <Td right>{bbbee.blackWomen}</Td>
                </tr>
                <tr>
                  <Td>People with disabilities trained</Td>
                  <Td right>{bbbee.disabledPeople}</Td>
                </tr>
                <tr>
                  <Td>Learnerships, apprenticeships and internships</Td>
                  <Td right>{bbbee.programmes}</Td>
                </tr>
                <tr>
                  <Td>Of which black people</Td>
                  <Td right>{bbbee.programmesBlack}</Td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[var(--brand-slate)]">
            Scorecard points depend on the leviable amount and on verified spend, neither of which
            Certly holds. Take these figures to the verification agency with the payroll numbers.
            {!bbbee.costComplete ? " Some courses have no cost on record, so spend is understated." : ""}
          </p>
        </div>
      </Section>

      <Section
        title={`Workplace Skills Plan ${nextYear.year}`}
        subtitle={`Planned training for ${nextYear.label}${scope}, by course and site, next to what was delivered this year so the plan can be checked against reality.`}
      >
        {wsp.groups.length === 0 ? (
          <EmptyBox>
            No plan rows for SETA year {nextYear.year}
            {scope}.
            {canWrite ? (
              <>
                {" "}
                Capture them in the{" "}
                <Link href={`${base}/plan?year=${nextYear.year}`} className="text-[var(--brand-red)] font-bold hover:underline">
                  plan editor
                </Link>
                , one row per course per site.
              </>
            ) : (
              " An admin captures them in the plan editor, one row per course per site."
            )}
          </EmptyBox>
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--brand-cream)]">
                  <tr>
                    <Th>Course</Th>
                    <Th>Category</Th>
                    <Th>Site</Th>
                    <Th right>Planned people</Th>
                    <Th right>Planned cost</Th>
                    <Th>Cost from</Th>
                    <Th right>Delivered {year.year}</Th>
                    <Th>Notes</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--brand-line)]">
                  {wsp.groups.map((g) => (
                    <WspGroupRows key={g.typeId} group={g} year={year.year} />
                  ))}
                  <tr className="font-bold bg-[var(--brand-cream)]">
                    <Td bold>Total</Td>
                    <Td>{""}</Td>
                    <Td>{""}</Td>
                    <Td right>{wsp.totals.people}</Td>
                    <Td right mono>{formatRands(wsp.totals.cost)}</Td>
                    <Td>{""}</Td>
                    <Td right>{courseTotals.people}</Td>
                    <Td>{""}</Td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-[var(--brand-slate)]">
              Cost from &quot;course&quot; means the plan row has no cost of its own and the course cost
              times the planned people is used instead.
              {wsp.totals.uncostedRows > 0
                ? ` ${wsp.totals.uncostedRows} ${wsp.totals.uncostedRows === 1 ? "row has" : "rows have"} no cost at all.`
                : ""}
              {canWrite ? (
                <>
                  {" "}
                  <Link href={`${base}/plan?year=${nextYear.year}`} className="text-[var(--brand-red)] font-bold hover:underline print:hidden">
                    Edit the plan
                  </Link>
                </>
              ) : null}
            </p>
          </div>
        )}
      </Section>

      <Section
        title="Data readiness"
        subtitle="What still needs to be captured before the ATR and WSP can be submitted with confidence."
      >
        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-bold">Courses missing hours or cost</h3>
            {readiness.typesIncomplete.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--brand-slate)]">
                Every active course that counts for the ATR has hours and a cost.
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-[var(--brand-slate)]">
                  {readiness.typesIncomplete.length}{" "}
                  {readiness.typesIncomplete.length === 1 ? "course counts" : "courses count"} for the
                  ATR without full details.
                  {canWrite ? (
                    <>
                      {" "}
                      <Link href={`${base}/types`} className="text-[var(--brand-red)] font-bold hover:underline print:hidden">
                        Complete the course details
                      </Link>
                    </>
                  ) : (
                    " An admin completes them on the course details page."
                  )}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--brand-cream)]">
                      <tr>
                        <Th>Course</Th>
                        <Th>Category</Th>
                        <Th>Missing</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--brand-line)]">
                      {readiness.typesIncomplete.map((t) => (
                        <tr key={t.id}>
                          <Td bold>{t.name}</Td>
                          <Td>{t.categoryLabel}</Td>
                          <Td>
                            {[t.missingHours ? "Hours" : null, t.missingCost ? "Cost" : null]
                              .filter(Boolean)
                              .join(", ")}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold">People trained without a declaration</h3>
            {readiness.undeclared.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--brand-slate)]">
                Everyone trained in the year{scope} has a population group and gender on record.
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-[var(--brand-slate)]">
                  {readiness.undeclared.length}{" "}
                  {readiness.undeclared.length === 1 ? "person has" : "people have"} no population
                  group or gender recorded. Capture the person&apos;s own EEA1 declaration on the
                  employee form under Employment equity.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--brand-cream)]">
                      <tr>
                        <Th>Surname</Th>
                        <Th>Names</Th>
                        <Th>Site</Th>
                        <Th>Missing</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--brand-line)]">
                      {readiness.undeclared.map((u) => (
                        <tr key={u.id}>
                          <Td bold>
                            <Link
                              href={`/${slug}/hr/employees/${u.id}`}
                              className="hover:text-[var(--brand-red)] hover:underline"
                            >
                              {u.surname}
                            </Link>
                          </Td>
                          <Td>{u.names}</Td>
                          <Td>{u.site}</Td>
                          <Td>
                            {[u.missingGroup ? "Population group" : null, u.missingGender ? "Gender" : null]
                              .filter(Boolean)
                              .join(", ")}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </Section>
    </ReportShell>
  );
}

function WspGroupRows({
  group,
  year,
}: {
  group: WspGroup;
  year: number;
}) {
  return (
    <>
      {group.rows.map((r, i) => (
        <tr key={r.planId}>
          <Td bold>{i === 0 ? group.course : ""}</Td>
          <Td>{i === 0 ? group.categoryLabel : ""}</Td>
          <Td>{r.site}</Td>
          <Td right>{r.plannedPeople}</Td>
          <Td right mono>{formatRands(r.plannedCost)}</Td>
          <Td className="text-xs text-[var(--brand-slate)]">
            {r.costSource === "plan" ? "Plan row" : r.costSource === "type" ? "Course" : "None"}
          </Td>
          <Td right>{r.deliveredAtSite}</Td>
          <Td className="text-xs text-[var(--brand-slate)]">{r.notes}</Td>
        </tr>
      ))}
      {group.rows.length > 1 ? (
        <tr className="text-xs text-[var(--brand-slate)]">
          <Td>{""}</Td>
          <Td>{""}</Td>
          <Td>All sites</Td>
          <Td right>{group.plannedPeople}</Td>
          <Td right mono>{formatRands(group.plannedCost)}</Td>
          <Td>{""}</Td>
          <Td right>{group.delivered} in {year}</Td>
          <Td>{""}</Td>
        </tr>
      ) : null}
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
