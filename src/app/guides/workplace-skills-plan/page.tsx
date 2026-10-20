import type { Metadata } from "next";
import { SITE } from "@/lib/site";
import { guideBySlug } from "@/lib/guides";
import GuideShell, { KeyFact, GuideTable, type GuideFaq, type GuideSection } from "@/components/guides/GuideShell";

/**
 * WSP and ATR guide.
 *
 * Written for a contractor who already pays the Skills Development Levy and
 * has never claimed the mandatory grant back. The money is the lede; the
 * April scramble is the honest part.
 */

const guide = guideBySlug("workplace-skills-plan")!;

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
  { id: "levy", heading: "The levy you are already paying" },
  { id: "wsp-atr", heading: "What the WSP and the ATR actually are" },
  { id: "deadline", heading: "30 April, and what missing it costs" },
  { id: "which-seta", heading: "Which SETA you belong to" },
  { id: "per-person", heading: "What the ATR asks for, per person" },
  { id: "bbbee", heading: "The same records feed your B-BBEE scorecard" },
  { id: "make-it-easy", heading: "Why April is hard, and how to fix it" },
];

const FAQS: GuideFaq[] = [
  {
    q: "When is the WSP and ATR deadline?",
    a: "30 April each year. The two documents are submitted together, covering the SETA financial year that ran from 1 April to 31 March. The MQA, the SETA for mining and minerals, states the date plainly as 30 April and accepts submissions only through its online system at sims.mqa.org.za. Other SETAs work to the same 30 April date, through their own portals.",
  },
  {
    q: "How much of the skills development levy comes back as the mandatory grant?",
    a: "The mandatory grant is 20 percent of the levy that employer paid. It is paid out by your SETA, not by SARS, and only to an employer who submitted a Workplace Skills Plan and an Annual Training Report by the deadline. It is not a reimbursement of training spend, so you are not claiming money back against invoices; you are claiming a share of a levy you have already paid.",
  },
  {
    q: "What happens if we miss the 30 April deadline?",
    a: "The mandatory grant for that year is gone and it is not recoverable. The money stays inside the SETA system and is redistributed, so there is no version of this where you submit in June and still get paid. You keep paying the levy every month in the meantime, which is what makes a missed year expensive rather than merely annoying.",
  },
  {
    q: "Do we have to pay the skills development levy at all?",
    a: "The levy is 1 percent of your total payroll, paid monthly to SARS on the EMP201 alongside PAYE. Employers whose annual payroll is under R500 000 are exempt. Above that threshold you are paying it whether or not you ever claim anything back.",
  },
  {
    q: "Which SETA do we submit to?",
    a: "The one that matches your own main business activity, not the sector your client operates in. A maintenance contractor working on a mine may sit with the MQA or with merSETA depending on what its own primary activity is. If you are unsure, confirm it in writing with the SETA before you register a Skills Development Facilitator, because the submission goes through that SETA's portal and nowhere else.",
  },
  {
    q: "Do site inductions and client access tickets count as training on the ATR?",
    a: "Generally not. SETAs do not usually regard a site induction or a client-specific access ticket as a reportable training intervention, so including them inflates your numbers with things that will not be credited. Record them, because site access depends on them, but keep them out of the ATR unless your SETA tells you otherwise.",
  },
  {
    q: "Can we use the same training records for B-BBEE?",
    a: "Yes, and you should. The skills development element of a B-BBEE scorecard measures training spend as a percentage of leviable amount and counts learnerships, apprenticeships and internships, including absorption of learners afterwards. The points depend on verified spend against your leviable amount, so the cost, provider and accreditation detail you need for the ATR is the same detail a verification agency asks for.",
  },
];

export default function Page() {
  return (
    <GuideShell guide={guide} sections={SECTIONS} faqs={FAQS}>
      <section id="levy">
        <h2>The levy you are already paying</h2>
        <p>
          If your annual payroll is above R500 000 you are paying the Skills
          Development Levy, and you are almost certainly paying it without
          looking at it. It is 1 percent of your total payroll, it goes to SARS
          every month on the EMP201 alongside PAYE, and from the inside it looks
          like one more line on a return your bookkeeper files. Employers with an
          annual payroll under R500 000 are exempt.
        </p>
        <p>
          That money does not stay with SARS. It moves into the SETA system, and
          a defined slice of it is set aside to come back to the employer who
          paid it, as the <strong>mandatory grant</strong>. The mandatory grant
          is 20 percent of what you paid. Your SETA pays it, not SARS, and it is
          only payable to an employer who has submitted a Workplace Skills Plan
          and an Annual Training Report by the deadline.
        </p>

        <KeyFact label="The date and the number">
          <p>
            <strong>30 April</strong> each year is the submission deadline for
            the WSP and ATR. Submit on time and your SETA pays a mandatory grant
            of <strong>20 percent</strong> of the levy you paid. Miss it and
            that year&rsquo;s grant is not recoverable.
          </p>
        </KeyFact>

        <p>
          That is the whole proposition, and it is why this is worth an afternoon
          of a contracts manager&rsquo;s time. A firm with 180 people on the
          payroll has already handed over 1 percent of it. A fifth of that is
          sitting in the system with its name on it, waiting for a form.
        </p>
      </section>

      <section id="wsp-atr">
        <h2>What the WSP and the ATR actually are</h2>
        <p>
          They are two halves of one submission, and they point in opposite
          directions in time. The SETA financial year runs from 1 April to 31
          March. The Annual Training Report looks backwards at the year that has
          just ended and says what training you actually delivered. The Workplace
          Skills Plan looks forward at the year about to start and says what you
          intend to deliver. You submit both together.
        </p>

        <GuideTable
          head={["Document", "Direction", "The period it covers"]}
          rows={[
            [
              "Annual Training Report (ATR)",
              "Backwards",
              "The SETA year that has just ended, 1 April to 31 March",
            ],
            [
              "Workplace Skills Plan (WSP)",
              "Forwards",
              "The SETA year about to start, 1 April to 31 March",
            ],
          ]}
          caption="Both are due on the same date, 30 April, in one submission."
        />

        <p>
          So the submission made by 30 April 2026 reported training delivered in
          the year to 31 March 2026 and planned training for the 2026/2027 year.
          The MQA, for example, worked to 30 April 2026 for the 2026/2027
          financial year.
        </p>
        <p>
          Two process requirements usually sit alongside the forms. A Skills
          Development Facilitator normally has to be appointed and registered
          with your SETA before anyone can submit on your behalf, and larger
          employers are generally expected to have a training committee that has
          been consulted on the plan. The detail of both varies between SETAs, so
          treat that as the shape of the requirement rather than the rule, and
          confirm the specifics with yours.
        </p>
      </section>

      <section id="deadline">
        <h2>30 April, and what missing it costs</h2>
        <p>
          The date is 30 April every year. SETAs state it plainly: the MQA, the
          SETA for mining and minerals, gives 30 April as the deadline and takes
          submissions only through its online system at sims.mqa.org.za. Other
          SETAs use the same 30 April date through their own portals, which is
          worth knowing because it means you cannot email a spreadsheet to
          someone on 2 May and expect it to be processed.
        </p>
        <p>
          Here is the part employers tend to find out the hard way. Missing the
          deadline does not delay the mandatory grant, it forfeits it. The money
          is not recoverable. It stays inside the SETA system and is
          redistributed. Meanwhile you keep paying 1 percent of payroll every
          month without interruption, which is what turns a missed submission
          from an administrative slip into a real cost you will never see an
          invoice for.
        </p>
      </section>

      <section id="which-seta">
        <h2>Which SETA you belong to</h2>
        <p>
          Your SETA is determined by your own main business activity, not by what
          your clients do. This trips up contractors constantly, because a firm
          doing mechanical maintenance on a mine feels like a mining business
          when it is standing on a mine. Depending on what its primary activity
          genuinely is, that firm may sit with the MQA or with merSETA.
        </p>

        <GuideTable
          head={["SETA", "Sector it covers"]}
          rows={[
            ["MQA", "Mining and minerals"],
            ["CETA", "Construction"],
            ["merSETA", "Manufacturing, engineering and related services"],
            ["EWSETA", "Energy and water"],
            ["TETA", "Transport"],
            ["CHIETA", "Chemical industries"],
            ["Services SETA", "Services"],
          ]}
          caption="The SETAs a mining or construction contractor most often lands in."
        />

        <p>
          If there is any genuine doubt, get it confirmed in writing before you
          register a Skills Development Facilitator. Registering with the wrong
          SETA wastes the only part of this process with a hard deadline, and the
          portals are not interchangeable.
        </p>
      </section>

      <section id="per-person">
        <h2>What the ATR asks for, per person</h2>
        <p>
          This is where an afternoon turns into a week. The ATR is not a total
          spend figure. It asks, for each training intervention, a set of
          questions about the people who went on it:
        </p>
        <ul>
          <li>Who was trained, by name, with gender, population group and disability status</li>
          <li>The occupational category, or the OFO code for the role</li>
          <li>
            The type of intervention: short course, skills programme, learnership,
            apprenticeship, internship or bursary
          </li>
          <li>Whether the training provider is accredited</li>
          <li>The NQF level, where one applies</li>
          <li>The cost</li>
        </ul>
        <p>
          Two things on that list cause most of the pain. The first is cost per
          course, which almost nobody holds per person, because the invoice was
          for a group and sat in the accounts system, not with the certificate.
          The second is the demographic detail, which is the same data the EEA2
          needs and is normally collected on the EEA1 form, so a designated
          employer already has it. If you are one, see our guide to the{" "}
          <a href="/guides/employment-equity-report">employment equity report</a>{" "}
          for how that data is gathered. Do not simply lift totals across,
          though: the employment equity reporting year and the SETA financial
          year cover different periods, so the same person&rsquo;s training can
          fall into one report and not the other.
        </p>
        <p>
          There is one exclusion worth getting right. Site inductions and
          client-specific access tickets are generally not regarded by SETAs as
          reportable training. They are access control, not skills development.
          Contractors include them because they are the most numerous training
          records in the business and the easiest to export, and the result is an
          ATR padded with hundreds of entries that earn nothing and make the real
          training harder to see.
        </p>
      </section>

      <section id="bbbee">
        <h2>The same records feed your B-BBEE scorecard</h2>
        <p>
          The grant is not the only reason to hold this data properly. The skills
          development element of a B-BBEE scorecard runs off the same
          information. It measures training spend as a percentage of leviable
          amount, and it counts learnerships, apprenticeships and internships,
          including whether learners were absorbed into employment afterwards.
        </p>
        <p>
          The points available depend on verified spend measured against your
          leviable amount, and the allocations are set by the codes rather than
          by your SETA, so confirm the current scorecard weightings with your
          verification agency rather than assuming last year&rsquo;s. The
          practical point stands regardless: a verification agency will ask for
          cost, provider, accreditation status and learner detail per
          intervention, which is the same list the ATR asks for. Build the record
          once and it serves both.
        </p>
      </section>

      <section id="make-it-easy">
        <h2>Why April is hard, and how to fix it</h2>
        <p>
          Almost every contractor already has the training records. Certificates
          are in a drawer or a shared folder, dates and names are on them, and
          the safety officer can produce them. What is missing is everything the
          form actually asks beyond the name and the date.
        </p>
        <p>
          The records live in three places. The certificates are with HR or the
          safety officer. The costs are in the accounts system, as supplier
          invoices with no link to the person who sat in the room. The
          demographics are in payroll, or in nobody&rsquo;s file at all. Every
          April somebody reassembles all three under time pressure, and the
          reassembly is the whole job. That is why submissions go in thin, go in
          late, or do not go in.
        </p>
        <p>
          The fix is not a bigger April. It is capturing four extra fields at the
          moment a course is booked, while someone still knows the answers:
        </p>
        <ol>
          <li>
            <strong>Cost per attendee.</strong> Take the invoice total and divide
            it at booking. Write it against each person, not against the course.
          </li>
          <li>
            <strong>Provider and accreditation status.</strong> Ask the provider
            once and record it. In April nobody can remember and the provider may
            not answer.
          </li>
          <li>
            <strong>Intervention type and NQF level.</strong> Short course,
            skills programme, learnership, apprenticeship, internship or bursary,
            plus the NQF level where one applies.
          </li>
          <li>
            <strong>A reportable flag.</strong> Mark inductions and client access
            tickets as not reportable when you file them, so the April export
            excludes them automatically.
          </li>
        </ol>
        <p>
          Do that and the ATR becomes an export rather than an investigation, the
          WSP becomes a conversation with your training committee about next year
          instead of a guess, and the 20 percent you have already paid for stops
          depending on whether anyone remembered the date.
        </p>
      </section>
    </GuideShell>
  );
}
