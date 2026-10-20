import type { Metadata } from "next";
import { SITE } from "@/lib/site";
import { guideBySlug } from "@/lib/guides";
import GuideShell, { KeyFact, GuideTable, type GuideFaq, type GuideSection } from "@/components/guides/GuideShell";

/**
 * COIDA letter of good standing.
 *
 * Written for a contractor who has already been turned away from a gate, so
 * the page leads with the renewal cycle and the gate consequence rather than
 * with the Act. Every figure the Compensation Fund calculates per employer
 * is left unstated on purpose.
 */

const guide = guideBySlug("letter-of-good-standing")!;

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
  { id: "what-it-proves", heading: "What the letter actually proves" },
  { id: "who-needs-one", heading: "Who needs one, and when you must register" },
  { id: "how-it-expires", heading: "How it expires" },
  { id: "good-standing", heading: "What good standing actually requires" },
  { id: "when-it-lapses", heading: "What happens when it lapses" },
  { id: "other-documents", heading: "The other documents on the same shelf" },
  { id: "stop-it-happening", heading: "How to stop it happening again" },
];

const FAQS: GuideFaq[] = [
  {
    q: "Does a letter of good standing cost anything?",
    a: "The letter itself is free to issue and free to download from the Compensation Fund. What you pay is the COIDA assessment that the letter certifies you have settled, which is calculated from your declared earnings. Agents and consultants who handle the paperwork on your behalf charge their own fee, and that fee is optional.",
  },
  {
    q: "How long is a letter of good standing valid for?",
    a: "It is valid for a limited period and is renewed annually, tied to the Return of Earnings cycle. When the new cycle opens the previous letter lapses, so a letter that was accepted on a site in March may be refused later in the same year. Check the date printed on your own copy rather than assuming a standard period.",
  },
  {
    q: "Do I need a letter of good standing if I have no employees?",
    a: "No. The letter certifies that a registered employer is up to date with the Compensation Fund, so a business with no employees has nothing to register and no letter to obtain. If a client insists on one, the honest answer is to explain your position in writing rather than to try to register for cover you do not need. The moment you take on your first employee you must register within seven days.",
  },
  {
    q: "What happens if I submit my Return of Earnings late?",
    a: "A late submission attracts a ten percent penalty plus interest that runs until the assessment is settled, and you cannot download a valid letter in the meantime. Work that requires a valid letter is put on hold until you have caught up. The penalty is usually the smaller cost, because the idle crew and the delayed invoice are more expensive.",
  },
  {
    q: "How long does it take to get a letter of good standing?",
    a: "A clean annual renewal, where you are already registered and the assessment is paid, can be done in a matter of days. A first time registration, or a payment that clears slowly, can stretch to weeks. That gap is exactly why leaving the renewal until a client asks for the letter is the expensive mistake.",
  },
  {
    q: "Can a client stop my crew working because the letter expired?",
    a: "In practice yes, and most will. The principal contractor's own compliance depends on holding a valid letter for every contractor on site, so an expired copy is their problem as much as yours. It does not stop one person, it stops the whole crew, and it usually stops the invoice for that work as well.",
  },
  {
    q: "Is the letter of good standing part of the safety file?",
    a: "Yes. Clients expect to find a valid copy in the contractor health and safety file alongside your proof of registration and your employee records. Because the file is usually assembled once and then reused, an expired letter tends to sit in it unnoticed until someone at the gate checks the date.",
  },
];

export default function Page() {
  return (
    <GuideShell guide={guide} sections={SECTIONS} faqs={FAQS}>
      <section id="what-it-proves">
        <h2>What the letter actually proves</h2>
        <p>
          A letter of good standing is a certificate issued by the Compensation
          Fund, which sits under the Department of Employment and Labour. It
          confirms two things about your business: that you are registered for
          workplace injury cover under COIDA, the Compensation for Occupational
          Injuries and Diseases Act 130 of 1993, and that you are up to date on
          your assessment payments.
        </p>
        <p>
          That is all it says, and it is worth being precise about it, because
          clients treat the letter as shorthand for something broader. It is
          not a safety certificate. It says nothing about your training
          records, your risk assessments or your incident history. What it does
          say is that if one of your employees is injured on their site, the
          injury is covered by the Fund rather than becoming a claim against
          the client. That is why a principal contractor cares about it more
          than you might expect, and why they will not take your word for it.
        </p>
        <KeyFact label="The short version">
          <p>
            The letter is <strong>free to issue and free to download</strong>.
            It is <strong>renewed annually</strong>, tied to the Return of
            Earnings cycle. And without a valid one,{" "}
            <strong>the whole crew stops</strong>, not one person.
          </p>
        </KeyFact>
      </section>

      <section id="who-needs-one">
        <h2>Who needs one, and when you must register</h2>
        <p>
          Registered employers need one. If you employ anybody, you must
          register with the Compensation Fund within seven days of taking on
          your first employee. If you have no employees, you have nothing to
          register and no letter to obtain, and no client can conjure one into
          existence for you. That situation is worth putting in writing to the
          client early rather than arguing about it on the day.
        </p>
        <p>
          Beyond the legal obligation to register, the letter has become a
          commercial gate. Most South African tenders ask for a valid copy as
          part of the submission pack. Principal contractors ask for it before
          they issue site access. Large clients ask for it before they load you
          as a vendor. None of that is in the Act; it is procurement practice
          built on top of the Act, and it is stricter than the Act because the
          client is protecting its own position.
        </p>
        <p>
          It is also one of the documents a client expects to find in your{" "}
          <a href="/guides/contractor-safety-file">contractor safety file</a>,
          filed next to your proof of registration. That matters later, because
          a safety file is assembled once and reused, which is a good way for
          an expired letter to sit in a folder looking official.
        </p>
      </section>

      <section id="how-it-expires">
        <h2>How it expires</h2>
        <p>
          The letter is valid for a limited period and is renewed every year on
          the Return of Earnings cycle. The Return of Earnings, form W.As.8, is
          the annual declaration every registered employer submits to the Fund.
          When the new cycle opens, your previous letter lapses. There is no
          grace period that a client is obliged to honour and no notification
          that lands on your desk at the right moment.
        </p>
        <p>
          The submission window shifts from year to year. For 2026 it ran from
          1 April to 30 June. Do not plan next year around that, and do not
          plan around a date you read in an article, including this one: check
          the current window with the Department of Employment and Labour or on
          the Fund&rsquo;s own system before you diarise anything.
        </p>
        <p>
          This is the heart of the trap, and it is worth naming plainly. The
          letter costs nothing, so nobody internally owns it the way somebody
          owns an insurance renewal or a vehicle licence. It renews once a year
          on a cycle that is not in anyone&rsquo;s calendar. And the renewal
          depends on a payment clearing, which is not instant. Three small
          things, none of them difficult, which is exactly why they go unnoticed
          until a gate guard asks for the document.
        </p>
      </section>

      <section id="good-standing">
        <h2>What good standing actually requires</h2>
        <p>
          To be in good standing you need three things to be true at the same
          time. You must be registered with the Compensation Fund. You must
          have submitted your Return of Earnings for the current cycle. And
          your assessment must be paid, either in full or under an arrangement
          to pay in instalments.
        </p>
        <p>
          The Return of Earnings declares the earnings you actually paid your
          employees in the year just ended, plus an estimate of what you expect
          to pay in the year ahead. The Fund uses that declaration to calculate
          your assessment. Once the assessment is paid, or the instalment
          arrangement is in place, the letter can be downloaded.
        </p>
        <p>
          The assessment is a percentage of your declared earnings, and the
          rate depends on your industry. Construction, manufacturing and
          transport sit at the higher end, which is unsurprising given the
          injury risk, and there is a minimum amount payable regardless of how
          small the declared earnings are. We deliberately do not publish a
          rate or an amount here, because the figure that applies to you only
          appears once the Fund has processed your Return of Earnings. Treat any
          number you are quoted in advance, by anyone, as an estimate.
        </p>
        <p>
          The instalment route is the part most contractors do not know about.
          If the assessment lands larger than expected, an arrangement to pay
          it off can still put you in good standing, which means the letter is
          not strictly gated on having the full amount in the bank on the day.
        </p>
      </section>

      <section id="when-it-lapses">
        <h2>What happens when it lapses</h2>
        <p>
          Submitting the Return of Earnings late attracts a penalty of ten
          percent, plus interest that keeps running until the assessment is
          settled. That is the visible cost, and it is the smaller one.
        </p>
        <p>
          The real cost is the gate. An expired letter does not inconvenience
          one person, it turns the whole crew away, because the principal
          contractor cannot show a valid copy for you in its own compliance
          pack. Everyone who travelled to site goes home. Work scheduled for
          that week does not happen. And because the work did not happen, the
          invoice does not go out, which turns a free document into a cash flow
          problem two weeks later.
        </p>
        <p>
          At tender stage it is cleaner and worse: a submission without a valid
          letter is simply non compliant, and no amount of explaining fixes it
          after the closing date. Several contractors discover their letter
          expired three months ago at precisely that moment.
        </p>
        <p>
          Timing is the thing to be realistic about. A clean renewal, where you
          are registered and the money is available, can be done in days. A
          first time registration, or a payment that takes its time clearing,
          can run into weeks. There is no version of this that you can
          reliably complete on the morning a client asks.
        </p>
      </section>

      <section id="other-documents">
        <h2>The other documents on the same shelf</h2>
        <p>
          The letter of good standing is not unusual. It is just the most
          visible member of a group of company documents that expire quietly on
          their own cycles and get forgotten in exactly the same way. Each one
          gates something different, and each one is cheap to maintain and
          expensive to lose.
        </p>
        <GuideTable
          caption="Company documents that expire, and what each one gates"
          head={["Document", "Validity", "What it gates"]}
          rows={[
            [
              "COIDA letter of good standing",
              "Annual, tied to the ROE cycle",
              "Site access, and in practice your invoice for that work",
            ],
            [
              "B-BBEE certificate or sworn affidavit",
              "Own cycle, check with the issuer",
              "Tender scoring and preferential procurement points",
            ],
            [
              "Tax compliance status PIN from SARS",
              "Own cycle, check with SARS",
              "Tender submissions and client vendor onboarding",
            ],
            [
              "Public liability insurance",
              "Own cycle, check with your broker",
              "Contract award and access to larger sites",
            ],
            [
              "CIPC annual returns",
              "Own cycle, check with CIPC",
              "Your company remaining registered at all",
            ],
          ]}
        />
        <p>
          We have not put validity periods against the others on purpose. They
          each run on their own cycle, and in some cases the cycle depends on
          your own year end or on the insurer you use. Note also that SARS no
          longer issues a paper tax clearance certificate: you get a tax
          compliance status PIN, which a client verifies online, so the thing
          you file in a folder is not the thing the client actually checks.
        </p>
        <p>
          The point of the table is not the detail of any single row. It is
          that these five expire independently, and that a contractor who only
          tracks the one a client shouted about last time will be caught by a
          different one next time.
        </p>
      </section>

      <section id="stop-it-happening">
        <h2>How to stop it happening again</h2>
        <p>
          There is no clever system required here. There are four habits, and
          they are all boring.
        </p>
        <ol>
          <li>
            Put the expiry date of your current letter in a calendar, with a
            reminder at least two months earlier. Two months, not two weeks,
            because a payment that clears slowly eats the two weeks.
          </li>
          <li>
            Give the document an owner by name. Free documents drift because
            nobody is accountable for them. Someone should be able to answer
            &ldquo;when does our letter expire&rdquo; without opening a
            cupboard.
          </li>
          <li>
            Check the current Return of Earnings window each year rather than
            assuming last year&rsquo;s dates, and submit early in the window
            instead of at the end of it.
          </li>
          <li>
            Track all five documents in the table on one list, with one expiry
            date each. A single list that someone looks at monthly beats five
            separate reminders that each get dismissed.
          </li>
        </ol>
        <p>
          If a client has already turned you away, the sequence is: confirm
          whether your registration is current, submit the outstanding Return
          of Earnings, settle the assessment or arrange instalments, then
          download the new letter and send it to every client who holds a copy
          of the old one. That last step is the one people skip, and it is why
          the same contractor gets stopped twice at two different gates with the
          same document.
        </p>
      </section>
    </GuideShell>
  );
}
