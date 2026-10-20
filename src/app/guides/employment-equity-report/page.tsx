import type { Metadata } from "next";
import { SITE } from "@/lib/site";
import { guideBySlug } from "@/lib/guides";
import GuideShell, {
  KeyFact,
  GuideTable,
  type GuideFaq,
  type GuideSection,
} from "@/components/guides/GuideShell";

/**
 * Guide: the employment equity report (EEA2).
 *
 * Written for a mining or construction contractor between 50 and 300
 * employees who has either just crossed the threshold or has been filing
 * badly for years. The two things it has to land are that the turnover test
 * is gone, and that the compliance certificate is what gates state work.
 */

const guide = guideBySlug("employment-equity-report")!;

export const metadata: Metadata = {
  title: guide.title,
  description: guide.description,
  keywords: guide.keywords,
  alternates: { canonical: `${SITE.domain}/guides/${guide.slug}` },
  openGraph: {
    type: "article",
    title: guide.title,
    description: guide.description,
    url: `${SITE.domain}/guides/${guide.slug}`,
    images: [`${SITE.domain}/guides/opengraph-image`],
  },
};

const SECTIONS: GuideSection[] = [
  { id: "who-must-report", heading: "Who has to report now" },
  { id: "the-forms", heading: "The forms, and what each one is for" },
  { id: "deadlines", heading: "The deadlines, and why manual filers start in September" },
  { id: "workforce-profile", heading: "What the workforce profile actually asks for" },
  { id: "sectoral-targets", heading: "Sectoral targets and what progress means now" },
  { id: "compliance-certificate", heading: "The compliance certificate and state contracts" },
  { id: "what-goes-wrong", heading: "What trips employers up" },
];

const FAQS: GuideFaq[] = [
  {
    q: "Do I have to submit an EEA2 if I have fewer than 50 employees?",
    a: "No. An employer with fewer than 50 employees is not a designated employer, so it does not prepare an EE Plan and does not submit an annual report. The Act's anti-discrimination and equal pay provisions still apply to you in full, whatever your size. Organs of state are designated regardless of headcount.",
  },
  {
    q: "Has the turnover threshold for designated employers been scrapped?",
    a: "Yes. The Employment Equity Amendment Act 2022 took effect on 1 January 2025 and removed the turnover test from the definition of a designated employer. Headcount is now the only test for a private employer: 50 or more employees means designated. Employers who were previously exempt because their turnover was below the sector figure are now in scope purely on headcount.",
  },
  {
    q: "What is the deadline for the employment equity report?",
    a: "The online EE reporting system opens on 1 September and closes on 15 January. Manual submissions open on the same day but close on 1 October, three and a half months earlier. For the cycle that opened on 1 September 2026, the online deadline is 15 January 2027.",
  },
  {
    q: "Where do foreign nationals go on the EEA2 workforce profile?",
    a: "Foreign nationals are counted in their own separate male and female columns, not inside the African, Coloured, Indian or White population group columns. Putting them in the population group columns is one of the most common errors on the form and it distorts both your profile and your reported progress. Every employee still has to sit against an occupational level.",
  },
  {
    q: "Do I need an EE compliance certificate to win government work?",
    a: "In practice, yes. A state contract requires an EE compliance certificate, which the Department of Employment and Labour has issued since 1 September 2025 and which is valid for 12 months. To qualify you must have submitted your annual EE report on time, show progress toward the sectoral targets or give justifiable reasons for falling short, have complied with the National Minimum Wage Act for the previous 12 months, and have no CCMA rulings against you for unfair discrimination in the last year.",
  },
  {
    q: "Can I work out an employee's population group myself if they will not complete an EEA1?",
    a: "No. Population group and disability status are special personal information under section 26 of POPIA, and the employee declares them on the EEA1. You may process that information because the Employment Equity Act requires it, but you must never guess or infer it from a name, a photograph or an accent. If an employee declines to declare, record that they declined rather than filling the gap yourself.",
  },
  {
    q: "Is the employment equity reporting year the same as the SETA training year?",
    a: "No, and this catches people out every year. Workforce movements on the EEA2, meaning recruits, promotions and terminations, are counted from 1 September to 31 August. Your SETA skills reporting runs over a different period with its own 30 April deadline, so the two reports cover different windows and cannot be filled in from the same extract.",
  },
];

export default function Page() {
  return (
    <GuideShell guide={guide} sections={SECTIONS} faqs={FAQS}>
      <section id="who-must-report">
        <h2>Who has to report now</h2>
        <p>
          The Employment Equity Amendment Act 2022 took effect on 1 January
          2025, and it changed the one thing that decides whether the rest of
          this page applies to you: the definition of a designated employer.
          Before that date you were designated if you had 50 or more employees,
          or if you were smaller but your annual turnover crossed a figure set
          for your sector. The turnover test is gone. If you employ 50 or more
          people, you are a designated employer, and turnover no longer rescues
          anybody or catches anybody.
        </p>

        <KeyFact label="The two numbers that matter">
          <p>
            <strong>50 or more employees</strong> makes you a designated
            employer, regardless of turnover. Online EEA2 submissions open on 1
            September and close on <strong>15 January</strong>.
          </p>
        </KeyFact>

        <p>
          For a contractor this cuts both ways. A civils firm with heavy revenue
          and 30 people on the books may have been designated on turnover before
          and is not designated now. A labour-heavy outfit with 60 or 200 people
          and thin margins was often outside the net on the old turnover test
          and is now squarely inside it. Most of the employers who have quietly
          never filed an EEA2 are in that second group, and the first they hear
          about it is when a client asks for a compliance certificate.
        </p>
        <p>
          Below 50 employees you do not prepare an EE Plan and you do not submit
          annual reports. That is the whole of the exemption. The Act's
          anti-discrimination provisions and its equal pay for work of equal
          value provisions apply to every employer in the country, so a
          nine-person firm can still be taken to the CCMA for unfair
          discrimination. Organs of state are designated regardless of
          headcount.
        </p>
        <p>
          If your headcount sits near 50 and moves with the contract book, have
          the count checked against the Act's definition of an employee rather
          than against whatever your payroll report shows on the day. Fixed-term
          crew, seasonal labour and people placed through a third party are
          where the argument happens, so ask your advisor before you decide you
          are exempt.
        </p>
      </section>

      <section id="the-forms">
        <h2>The forms, and what each one is for</h2>
        <p>
          Four documents carry the whole system. Three are familiar. The fourth,
          the EEA1, is the one employers skip, which is why their EEA2 never
          balances.
        </p>

        <GuideTable
          head={["Document", "What it is", "Where it goes"]}
          rows={[
            [
              "EEA1",
              "The form on which an employee declares their own gender, population group and disability status.",
              "You keep it on file. It is not submitted.",
            ],
            [
              "EEA2",
              "The annual report: workforce profile, progress against the targets, and workforce movements.",
              "Department of Employment and Labour.",
            ],
            [
              "EEA4",
              "The income differential statement, submitted together with the EEA2.",
              "Goes to the National Minimum Wage Commission.",
            ],
            [
              "EE Plan",
              "A five-year plan with a workforce analysis, numerical goals, an affirmative action strategy and monitoring. The current cycle runs 1 September 2025 to 31 August 2030.",
              "You keep it and produce it when an inspector asks.",
            ],
          ]}
          caption="The employment equity paperwork set"
        />

        <p>
          The EEA1 is the foundation and it is the cheapest thing on this list
          to get right. Population group and disability status are special
          personal information under section 26 of POPIA. You are allowed to
          process them because section 27(1)(b) permits processing that a law
          requires, and the Employment Equity Act requires it. What you are not
          allowed to do is decide for the employee. The declaration is theirs to
          make on the EEA1, and inferring it from a surname, an ID number, a
          photograph or an accent is both a POPIA problem and a data quality
          problem, because you will be wrong often enough to make your profile
          meaningless.
        </p>
      </section>

      <section id="deadlines">
        <h2>The deadlines, and why manual filers start in September</h2>
        <p>
          There is one reporting window with two very different closing dates,
          and the gap between them is where small employers lose a year.
        </p>

        <GuideTable
          head={["Channel", "Opens", "Closes"]}
          rows={[
            ["Online EE reporting system", "1 September", "15 January"],
            ["Manual submission", "1 September", "1 October"],
          ]}
          caption="The annual reporting window"
        />

        <p>
          Manual filers get one month. Online filers get four and a half. If you
          intend to submit on paper, your preparation has to be finished before
          the window opens, because 1 October arrives three and a half months
          earlier than the date everybody quotes. For the cycle that opened on 1
          September 2026, the online deadline is 15 January 2027. Register for
          the online system if you have the choice, and do it early rather than
          in December, because a login problem in the first week of January is
          not something a weekend of work will fix.
        </p>
        <p>
          The reporting year for workforce movements, meaning recruits,
          promotions and terminations, runs from 1 September to 31 August. That
          is not your financial year and it is not your SETA year either. The{" "}
          <a href="/guides/workplace-skills-plan">
            Workplace Skills Plan and Annual Training Report
          </a>{" "}
          cover a different period with their own 30 April deadline, so you
          cannot fill in one report from the extract you pulled for the other.
          Employers who try end up with movement figures that do not reconcile
          to either report.
        </p>
      </section>

      <section id="workforce-profile">
        <h2>What the workforce profile actually asks for</h2>
        <p>
          The workforce profile on the EEA2 is a matrix, and once you see it as a
          grid the work becomes clerical rather than mysterious. The rows are
          occupational levels:
        </p>
        <ul>
          <li>Top management</li>
          <li>Senior management</li>
          <li>
            Professionally qualified and experienced specialists and
            mid-management
          </li>
          <li>
            Skilled technical and academically qualified workers, including
            junior management and supervisors
          </li>
          <li>Semi-skilled and discretionary decision making</li>
          <li>Unskilled and defined decision making</li>
        </ul>
        <p>
          The columns are population group, African, Coloured, Indian and White,
          each split into male and female. Foreign nationals are counted in
          their own separate male and female columns rather than inside the
          population group columns. Every employee has to land in exactly one
          cell, which means every employee needs a declared population group and
          gender and an assigned occupational level. A site foreman who has
          never been slotted into a level is not a rounding error on this form,
          he is a person the matrix cannot place.
        </p>
        <p>
          Occupational level is where contractors struggle most, because trade
          titles do not map cleanly onto the Act's six levels and nobody in the
          business has ever had to make the call. Make it once, write it down
          against each role rather than each person, and keep it stable between
          years, otherwise your progress figures will move for reasons that have
          nothing to do with hiring. Download the current EEA2 from
          labour.gov.za each cycle rather than reusing last year's spreadsheet,
          because the form's layout and the detail it asks for do change between
          versions.
        </p>
      </section>

      <section id="sectoral-targets">
        <h2>Sectoral targets and what progress means now</h2>
        <p>
          This is the second big change and it reframes what the report is for.
          The Department of Employment and Labour set five-year sector-specific
          numerical targets, published in the Government Gazette on 15 April
          2025 and running from 1 September 2025 to 31 August 2030. They replace
          the previous arrangement where each employer set its own targets in
          its own EE Plan. You no longer get to choose a number you are
          comfortable with and report against it.
        </p>
        <p>
          The targets vary by sector and by occupational level, so there is no
          single figure to quote and anyone who gives you one without asking what
          sector you are in is guessing. Find the gazetted targets for your
          sector on labour.gov.za and read the rows for your own occupational
          levels. The one change that applies across every sector is disability:
          the employment target for people with disabilities rose from 2 percent
          to 3 percent.
        </p>
        <p>
          Progress now means movement toward the targets set for your sector, or
          a justifiable reason for not getting there. That second half is real
          and it is worth using honestly. A genuine skills shortage in your
          region, a workforce that barely turned over because you lost a
          contract, or a plant mothballed for seven months are reasons, provided
          your records show them. A blank box is not a
          reason, and neither is a paragraph written in January about a year you
          did nothing to plan for.
        </p>
      </section>

      <section id="compliance-certificate">
        <h2>The compliance certificate and state contracts</h2>
        <p>
          The EE compliance certificate is the part of this that has teeth, and
          it is the reason employers who ignored employment equity for a decade
          are suddenly asking about it. The Department of Employment and Labour
          has issued these certificates since 1 September 2025 and each one is
          valid for 12 months. For a contractor the practical point is simple: a
          state contract requires this certificate. No certificate, no state
          work, whatever your price looks like.
        </p>
        <p>To qualify, an employer must:</p>
        <ul>
          <li>have submitted the annual EE report on time;</li>
          <li>
            show progress toward the sectoral targets, or give justifiable
            reasons for not doing so;
          </li>
          <li>
            have complied with the National Minimum Wage Act for the previous 12
            months;
          </li>
          <li>
            have no CCMA rulings against it for unfair discrimination in the last
            year.
          </li>
        </ul>
        <p>
          Both designated and non-designated employers may apply, so a 20-person
          subcontractor chasing public sector work is not shut out by being too
          small. Look hard at the first condition: on time means on time, so a
          late EEA2 does not simply attract a rebuke, it
          costs you the certificate and with it a year of tender eligibility.
          That single line is the strongest argument for filing online in
          September rather than scrambling in January.
        </p>
      </section>

      <section id="what-goes-wrong">
        <h2>What trips employers up</h2>
        <p>
          The failures are boringly consistent, and almost none of them are
          about discrimination. They are about record keeping.
        </p>
        <ul>
          <li>
            <strong>Declarations never collected.</strong> No EEA1 on file for
            half the crew, so the profile is built from guesswork or from
            whatever the payroll system happens to hold.
          </li>
          <li>
            <strong>Employees with no occupational level.</strong> People hired
            against a job title that was never mapped to one of the six levels,
            who then cannot be placed in the matrix at all.
          </li>
          <li>
            <strong>Foreign nationals in the wrong column.</strong> Counted
            inside a population group instead of in their own separate male and
            female columns, which quietly misstates both the profile and the
            progress figures.
          </li>
          <li>
            <strong>Employers guessing special personal information.</strong>{" "}
            Inferring population group or disability from a name or an
            appearance, which is a POPIA breach and bad data at the same time.
          </li>
          <li>
            <strong>The manual deadline missed.</strong> Working to 15 January
            while intending to file on paper, and arriving to find the channel
            closed on 1 October.
          </li>
          <li>
            <strong>An EE Plan that exists only as a file.</strong> A five-year
            plan with numerical goals that nobody monitored, consulted on or
            used to make a single hiring decision, which makes the progress
            section of the EEA2 impossible to write truthfully.
          </li>
          <li>
            <strong>National Minimum Wage compliance treated as separate.</strong>{" "}
            It is one of the four certificate conditions, so a wage problem
            twelve months old can sink an otherwise clean application.
          </li>
        </ul>
        <p>
          None of this is difficult work. It is twelve months of small, timely
          record keeping compressed into a form, and the employers who find
          January painful are the ones who started in January. Collect the EEA1s
          when people are inducted, assign an occupational level when a role is
          created, and keep your movements register current through the year, and
          the EEA2 becomes a transcription job rather than an investigation.
        </p>
      </section>
    </GuideShell>
  );
}
