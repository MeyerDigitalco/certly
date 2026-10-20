import Link from "next/link";
import { requireTenant } from "@/lib/tenant";
import { isAdmin } from "@/lib/auth/roles";
import { parsePeriod, periodKey } from "@/lib/hr/operations";
import {
  getAbsences,
  getEmployeesForReports,
  getLabourPlans,
  getOnboardingCandidates,
  sitesFrom,
} from "@/lib/reports/data";
import {
  AVAILABILITY_NOTE,
  PLANNED_NOTE,
  REPEAT_MIN_SPELLS,
  REPEAT_WINDOW_DAYS,
  buildLabourUnavailability,
  formatDays,
  formatPct,
} from "@/lib/reports/labour-unavailability";
import ReportShell, { Section, Stat, Th, Td } from "@/components/reports/ReportShell";
import { GroupedBars, StackedBar, CHART_COLOURS } from "@/lib/reports/charts";

export const metadata = { title: "Labour unavailability" };
export const dynamic = "force-dynamic";

export default async function LabourUnavailabilityPage({
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

  const [employees, absences, plans, candidates] = await Promise.all([
    getEmployeesForReports(ctx.org.id),
    getAbsences(ctx.org.id),
    getLabourPlans(ctx.org.id),
    getOnboardingCandidates(ctx.org.id),
  ]);

  const report = buildLabourUnavailability(employees, absences, period, site);
  const {
    stats,
    sites,
    byReason,
    plannedSubtotal,
    unplannedSubtotal,
    grandTotal,
    bySite,
    bySiteTotal,
    trend,
    repeat,
    spells,
  } = report;
  const exportHref = `/${slug}/hr/reports/labour-unavailability/export?period=${periodKey(period)}${site ? `&site=${encodeURIComponent(site)}` : ""}`;
  const logHref = `/${slug}/hr/reports/labour-unavailability/log`;
  const scope = site ? ` at ${site}` : "";
  const canWrite = isAdmin(ctx.role);
  const availabilityTone =
    stats.availableManDays === 0
      ? undefined
      : stats.availabilityPct < 90
        ? "red"
        : stats.availabilityPct < 95
          ? "amber"
          : "green";

  return (
    <ReportShell
      slug={slug}
      orgName={ctx.org.name}
      reportKey="labour-unavailability"
      title="Labour unavailability"
      description={`Man-days the client could have had in ${period.label} against the days lost to absence, split by reason and site. Planned leave counts against availability but is not held against the contractor; unplanned absence is what the client reads.`}
      period={period}
      site={site || undefined}
      sites={sitesFrom(employees, plans, candidates)}
      exportHref={exportHref}
    >
      {canWrite ? (
        <div className="print:hidden flex flex-wrap items-center justify-between gap-3 bg-[var(--brand-cream)] border border-[var(--brand-line)] rounded-xl px-4 py-3 text-sm">
          <span className="text-[var(--brand-slate)]">
            Absences are captured on the absence log. Record a spell for one person or a whole crew in one go.
          </span>
          <Link href={logHref} className="font-bold text-[var(--brand-red)] hover:underline">
            Open the absence log
          </Link>
        </div>
      ) : null}

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <Stat label="In service" value={stats.inService} hint={`People on the register on ${period.end}`} />
        <Stat
          label="Available man-days"
          value={stats.availableManDays}
          hint={`${stats.inService} people x ${stats.calendarDays} calendar days`}
        />
        <Stat
          label="Days lost"
          value={formatDays(stats.daysLost)}
          tone={stats.daysLost > 0 ? "amber" : undefined}
          hint={`${stats.spellCount} ${stats.spellCount === 1 ? "spell" : "spells"} in ${period.label}`}
        />
        <Stat
          label="Availability"
          value={formatPct(stats.availabilityPct)}
          tone={availabilityTone}
          hint="Available less lost, over available"
        />
        <Stat
          label="Unplanned days lost"
          value={formatDays(stats.unplannedDaysLost)}
          tone={stats.unplannedDaysLost > 0 ? "red" : undefined}
          hint="Sick, family, injury, unpaid, AWOL, other"
        />
        <Stat
          label="AWOL days"
          value={formatDays(stats.awolDays)}
          tone={stats.awolDays > 0 ? "red" : undefined}
          hint="Absent without leave"
        />
      </div>

      {!report.hasAnyAbsence ? (
        <EmptyBox>
          No absences are recorded{scope}.{" "}
          {canWrite ? (
            <>
              Capture leave, sick days and no shows on the{" "}
              <Link href={logHref} className="font-bold text-[var(--brand-red)] hover:underline">
                absence log
              </Link>{" "}
              and this report fills in by itself. Until then availability reads 100% for everyone in service.
            </>
          ) : (
            <>
              An admin captures leave, sick days and no shows on the absence log at{" "}
              <span className="font-mono text-xs">{logHref}</span>. Until then availability reads 100% for
              everyone in service.
            </>
          )}
        </EmptyBox>
      ) : spells.length === 0 ? (
        <EmptyBox>
          No absence touched {period.label}
          {scope}, so availability is 100% for the {stats.inService} people in service.
          {canWrite ? (
            <>
              {" "}
              If a spell is missing, add it on the{" "}
              <Link href={logHref} className="font-bold text-[var(--brand-red)] hover:underline">
                absence log
              </Link>
              .
            </>
          ) : null}
        </EmptyBox>
      ) : null}

      <Section
        title="Days lost by reason"
        subtitle={`Calendar days of absence inside ${period.label}${scope}, per site. A half day counts 0.5. Every reason is listed so the shape stays the same month to month.`}
      >
        <div className="mb-5">
          <StackedBar
            title="Planned against unplanned"
            segments={[
              { label: "Planned", value: plannedSubtotal.total, colour: CHART_COLOURS.slate },
              { label: "Unplanned", value: unplannedSubtotal.total, colour: CHART_COLOURS.red },
            ]}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--brand-cream)]">
              <tr>
                <Th>Reason</Th>
                <Th>Class</Th>
                {sites.map((s) => (
                  <Th key={s} right>
                    {s}
                  </Th>
                ))}
                <Th right>Total</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--brand-line)]">
              {byReason
                .filter((r) => r.planned)
                .map((r) => (
                  <ReasonLine key={r.reason} label={r.label} planned={r.planned} bySite={r.bySite} total={r.total} />
                ))}
              <SubtotalLine label="Planned subtotal" bySite={plannedSubtotal.bySite} total={plannedSubtotal.total} />
              {byReason
                .filter((r) => !r.planned)
                .map((r) => (
                  <ReasonLine key={r.reason} label={r.label} planned={r.planned} bySite={r.bySite} total={r.total} />
                ))}
              <SubtotalLine
                label="Unplanned subtotal"
                bySite={unplannedSubtotal.bySite}
                total={unplannedSubtotal.total}
                red
              />
              <tr className="font-bold bg-[var(--brand-cream)]">
                <Td bold>Total days lost</Td>
                <Td>{""}</Td>
                {grandTotal.bySite.map((v, i) => (
                  <Td key={sites[i]} right bold>
                    {formatDays(v)}
                  </Td>
                ))}
                <Td right bold>
                  {formatDays(grandTotal.total)}
                </Td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="By site"
        subtitle={`Planned against unplanned days lost per site in ${period.label}${scope}. Availability is per site: that site's people in service times calendar days, less its days lost.`}
      >
        {sites.length === 0 ? (
          <EmptyBox>Nobody was in service on {period.end}{scope}, so there are no sites to show.</EmptyBox>
        ) : (
          <>
            <GroupedBars
              title="Days lost by site"
              categories={sites}
              series={[
                { name: "Planned", colour: CHART_COLOURS.slate, values: bySite.map((s) => s.planned) },
                { name: "Unplanned", colour: CHART_COLOURS.red, values: bySite.map((s) => s.unplanned) },
              ]}
            />
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm">
                <thead className="bg-[var(--brand-cream)]">
                  <tr>
                    <Th>Site</Th>
                    <Th right>In service</Th>
                    <Th right>Available man-days</Th>
                    <Th right>Planned</Th>
                    <Th right>Unplanned</Th>
                    <Th right>Days lost</Th>
                    <Th right>Availability</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--brand-line)]">
                  {bySite.map((s) => (
                    <tr key={s.site}>
                      <Td bold>{s.site}</Td>
                      <Td right>{s.inService}</Td>
                      <Td right>{s.availableManDays}</Td>
                      <Td right>{s.planned ? formatDays(s.planned) : ""}</Td>
                      <Td right className={s.unplanned > 0 ? "text-red-700 font-bold" : ""}>
                        {s.unplanned ? formatDays(s.unplanned) : ""}
                      </Td>
                      <Td right bold>
                        {formatDays(s.total)}
                      </Td>
                      <Td right bold>
                        {formatPct(s.availabilityPct)}
                      </Td>
                    </tr>
                  ))}
                  <tr className="font-bold bg-[var(--brand-cream)]">
                    <Td bold>Total</Td>
                    <Td right bold>
                      {bySiteTotal.inService}
                    </Td>
                    <Td right bold>
                      {bySiteTotal.availableManDays}
                    </Td>
                    <Td right bold>
                      {formatDays(bySiteTotal.planned)}
                    </Td>
                    <Td right bold className={bySiteTotal.unplanned > 0 ? "text-red-700" : ""}>
                      {formatDays(bySiteTotal.unplanned)}
                    </Td>
                    <Td right bold>
                      {formatDays(bySiteTotal.total)}
                    </Td>
                    <Td right bold>
                      {formatPct(bySiteTotal.availabilityPct)}
                    </Td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </Section>

      <Section
        title="Six month trend"
        subtitle={`Days lost and AWOL days per month for the six months ending ${period.label}${scope}. Each month counts the people in service at its own month end.`}
      >
        <GroupedBars
          title="Days lost and AWOL days by month"
          categories={trend.map((m) => m.shortLabel)}
          series={[
            { name: "Days lost", colour: CHART_COLOURS.ink, values: trend.map((m) => m.daysLost) },
            { name: "AWOL days", colour: CHART_COLOURS.red, values: trend.map((m) => m.awolDays) },
          ]}
        />
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead className="bg-[var(--brand-cream)]">
              <tr>
                <Th>Month</Th>
                <Th right>In service</Th>
                <Th right>Available man-days</Th>
                <Th right>Days lost</Th>
                <Th right>Unplanned</Th>
                <Th right>AWOL</Th>
                <Th right>Availability</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--brand-line)]">
              {trend.map((m) => (
                <tr key={m.key} className={m.key === periodKey(period) ? "font-bold" : ""}>
                  <Td bold>{m.label}</Td>
                  <Td right>{m.inService}</Td>
                  <Td right>{m.availableManDays}</Td>
                  <Td right>{formatDays(m.daysLost)}</Td>
                  <Td right>{formatDays(m.unplannedDaysLost)}</Td>
                  <Td right className={m.awolDays > 0 ? "text-red-700" : ""}>
                    {formatDays(m.awolDays)}
                  </Td>
                  <Td right>{formatPct(m.availabilityPct)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="Repeat unplanned absence"
        subtitle={`People in service on ${period.end}${scope} with ${REPEAT_MIN_SPELLS} or more unplanned spells in the ${REPEAT_WINDOW_DAYS} days ending ${period.end}. A pattern to discuss with the person, not a verdict.`}
      >
        {repeat.length === 0 ? (
          <EmptyBox>
            Nobody{scope} had {REPEAT_MIN_SPELLS} or more unplanned spells in the {REPEAT_WINDOW_DAYS} days
            ending {period.end}.
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
                  <Th right>Unplanned spells</Th>
                  <Th right>Days in window</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--brand-line)]">
                {repeat.map((r) => (
                  <tr key={r.id}>
                    <Td bold>
                      <Link href={`/${slug}/hr/employees/${r.id}`} className="hover:text-[var(--brand-red)] hover:underline">
                        {r.surname}
                      </Link>
                    </Td>
                    <Td>{r.names}</Td>
                    <Td>{r.designation}</Td>
                    <Td>{r.site}</Td>
                    <Td right bold className="text-red-700">
                      {r.spells}
                    </Td>
                    <Td right>{formatDays(r.days)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        title="Spells in the period"
        subtitle={`Every absence of a person in service that touched ${period.label}${scope}. Days in period counts only the days inside the month.`}
      >
        {spells.length === 0 ? (
          <EmptyBox>No absence touched {period.label}{scope}.</EmptyBox>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--brand-cream)]">
                <tr>
                  <Th>Surname</Th>
                  <Th>Names</Th>
                  <Th>Designation</Th>
                  <Th>Site</Th>
                  <Th>First day</Th>
                  <Th>Last day</Th>
                  <Th right>Days in period</Th>
                  <Th>Reason</Th>
                  <Th>Class</Th>
                  <Th>Notes</Th>
                  {canWrite ? (
                    <Th>
                      <span className="sr-only">Edit</span>
                    </Th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--brand-line)]">
                {spells.map((s) => (
                  <tr key={s.id}>
                    <Td bold>
                      <Link
                        href={`/${slug}/hr/employees/${s.employeeId}`}
                        className="hover:text-[var(--brand-red)] hover:underline"
                      >
                        {s.surname}
                      </Link>
                    </Td>
                    <Td>{s.names}</Td>
                    <Td>{s.designation}</Td>
                    <Td>{s.site}</Td>
                    <Td mono>{s.firstDay}</Td>
                    <Td mono>{s.lastDay}</Td>
                    <Td right bold>
                      {formatDays(s.daysInPeriod)}
                      {s.halfDay ? (
                        <span className="ml-1 text-[10px] uppercase tracking-widest font-normal text-[var(--brand-slate)]">
                          half
                        </span>
                      ) : null}
                    </Td>
                    <Td>{s.reasonLabel}</Td>
                    <Td>
                      <ClassPill planned={s.planned} />
                    </Td>
                    <td className="px-3 py-2 text-xs text-[var(--brand-slate)] max-w-xs truncate" title={s.notes}>
                      {s.notes}
                    </td>
                    {canWrite ? (
                      <Td>
                        <Link
                          href={`${logHref}?focus=${s.id}`}
                          className="print:hidden text-xs font-bold text-[var(--brand-red)] hover:underline"
                        >
                          Edit on the log
                        </Link>
                      </Td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="space-y-1 text-xs text-[var(--brand-slate)]">
        <p>{AVAILABILITY_NOTE}</p>
        <p>{PLANNED_NOTE}</p>
      </div>
    </ReportShell>
  );
}

function ReasonLine({
  label,
  planned,
  bySite,
  total,
}: {
  label: string;
  planned: boolean;
  bySite: number[];
  total: number;
}) {
  return (
    <tr className={total === 0 ? "text-[var(--brand-slate)]" : ""}>
      <Td>{label}</Td>
      <Td>
        <ClassPill planned={planned} />
      </Td>
      {bySite.map((v, i) => (
        <Td key={i} right>
          {v ? formatDays(v) : ""}
        </Td>
      ))}
      <Td right bold>
        {formatDays(total)}
      </Td>
    </tr>
  );
}

function SubtotalLine({
  label,
  bySite,
  total,
  red,
}: {
  label: string;
  bySite: number[];
  total: number;
  red?: boolean;
}) {
  const tone = red && total > 0 ? "text-red-700" : "";
  return (
    <tr className="bg-[var(--brand-cream)]/60">
      <Td bold className={tone}>
        {label}
      </Td>
      <Td>{""}</Td>
      {bySite.map((v, i) => (
        <Td key={i} right bold className={tone}>
          {formatDays(v)}
        </Td>
      ))}
      <Td right bold className={tone}>
        {formatDays(total)}
      </Td>
    </tr>
  );
}

function ClassPill({ planned }: { planned: boolean }) {
  return (
    <span
      className={`inline-block border rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
        planned
          ? "bg-[var(--brand-cream)] text-[var(--brand-ink)] border-[var(--brand-line)]"
          : "bg-red-50 text-red-800 border-red-200"
      }`}
    >
      {planned ? "Planned" : "Unplanned"}
    </span>
  );
}

function EmptyBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[var(--brand-cream)] border border-[var(--brand-line)] rounded-xl p-4 text-sm text-[var(--brand-slate)]">
      {children}
    </div>
  );
}
