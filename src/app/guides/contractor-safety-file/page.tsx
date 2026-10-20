import type { Metadata } from "next";
import { SITE } from "@/lib/site";
import { guideBySlug } from "@/lib/guides";
import GuideShell, { KeyFact, GuideTable, type GuideFaq, type GuideSection } from "@/components/guides/GuideShell";

/**
 * Contractor safety file.
 *
 * Written for someone who already knows what a safety file is and has had one
 * sent back. The argument of the page is structural: the file has a write-once
 * half and a snapshot half, and only the second one causes rejections.
 */

const guide = guideBySlug("contractor-safety-file")!;

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
  { id: "what-it-is", heading: "What a safety file is, and who decides what goes in it" },
  { id: "specification", heading: "The client's health and safety specification is the real checklist" },
  { id: "contents", heading: "What is typically expected in the pack" },
  { id: "two-halves", heading: "The two halves of the file, and why one of them rots" },
  { id: "expiry", heading: "Certified copies and the things that expire quietly" },
  { id: "rejection", heading: "What a rejection actually costs you" },
  { id: "reprint", heading: "Building it so the next submission is a reprint" },
];

const FAQS: GuideFaq[] = [
  {
    q: "Is there a standard list of what must be in a contractor safety file?",
    a: "No. There is no single statutory checklist that applies to every job. The Occupational Health and Safety Act and the Construction Regulations set the duties, and the client or principal contractor turns those duties into a health and safety specification for that particular site. Your file and your site-specific health and safety plan have to answer that specification, which is why two clients in the same industry will want two different packs.",
  },
  {
    q: "When does the safety file have to be on site?",
    a: "Before construction work begins. A principal contractor must give the client a documented, coherent and site-specific health and safety plan, and the file that supports it needs to be available on site from the start rather than assembled once work is underway. Treat the gate date, not the start date, as your deadline, because many clients will not induct a crew until the pack is approved.",
  },
  {
    q: "Why does my safety file keep getting sent back when nothing has changed?",
    a: "Usually because the employee half has changed even though the documents half has not. Training certificates, medical certificates of fitness, licences and inductions all expire on their own dates, and the crew on the new job is rarely the crew from the last one. The policies and procedures you reused are fine. It is the people pages that went stale.",
  },
  {
    q: "How recent does a certified copy of an identity document have to be?",
    a: "South African clients commonly ask for a certified copy no older than three months, and many reject anything older without reading the rest of the pack. That three month rule comes from the client's own document standard rather than from the Act, so confirm it in the health and safety specification or with the safety officer before you send a crew to a police station. Where the specification is silent, assume three months and you will seldom be wrong.",
  },
  {
    q: "What does a rejected pack cost in practice?",
    a: "Mostly time you cannot recover. A pack turned back for one expired induction or one stale certified copy normally rejoins the client's approval queue at the back, and that queue can run for weeks while your crew waits off site. The document itself takes an afternoon to replace. The queue is the expensive part.",
  },
  {
    q: "Does a mining client use the same rules as a construction client?",
    a: "The structure of the file is similar but the governing law is not. Construction sites run under the Occupational Health and Safety Act and the Construction Regulations, while mines run under the Mine Health and Safety Act, and mine standards for medicals, inductions and permits are usually stricter. Read the specification for the site you are entering rather than assuming your last pack transfers.",
  },
  {
    q: "Does having a complete safety file mean I am compliant?",
    a: "No. A file is evidence that you have thought about the risks and can show records for them. It does not prove that the work on site matches what the documents say, and no file or software can certify compliance on your behalf. Inspectors and client auditors look at the site first and the file second.",
  },
];

export default function Page() {
  return (
    <GuideShell guide={guide} sections={SECTIONS} faqs={FAQS}>
      <section id="what-it-is">
        <h2>What a safety file is, and who decides what goes in it</h2>
        <p>
          A contractor safety file is the evidence pack you hand a client to
          show that the work you are about to do has been thought about: the
          hazards identified, the procedures written, the people trained and
          medically fit, the appointments made in writing. On a construction
          site the duties behind it come from the Occupational Health and Safety
          Act and the Construction Regulations made under it. On a mine they
          come from the Mine Health and Safety Act instead, which is stricter in
          most of the places that matter to you.
        </p>
        <p>
          What those laws do not do is hand you a list. They set duties, and
          then they leave it to the client and the principal contractor to say
          what satisfying those duties looks like on their site. That is the
          part most contractors learn the hard way, usually on the second or
          third client.
        </p>
        <KeyFact label="The thing to understand first">
          <p>
            There is no universal safety file checklist. The authority on what
            goes in your file is the client&rsquo;s own health and safety
            specification, issued by the client or principal contractor for that
            site. Your file and your site-specific health and safety plan exist
            to answer it.
          </p>
        </KeyFact>
      </section>

      <section id="specification">
        <h2>The client&rsquo;s health and safety specification is the real checklist</h2>
        <p>
          The principal contractor issues a health and safety specification for
          the work. It describes the site, the hazards the client already knows
          about, the standards they expect and the documents they want to see.
          Your safety file, and the site-specific health and safety plan inside
          it, must answer that document point by point. A principal contractor
          has to give the client a documented, coherent and site-specific plan,
          and the file has to be on site before construction work begins.
        </p>
        <p>
          So the first move on a new job is not to open last year&rsquo;s file.
          It is to get the specification in writing and read it with a pen. If
          the client has not sent one, ask for it, and ask the safety officer
          what their document standard is for certified copies, inductions and
          medicals. Ten minutes of that conversation saves a resubmission.
        </p>
        <p>
          It also explains the thing that frustrates everybody: no two clients
          want the same pack. They are not being difficult and they are not
          applying different law. They are applying different specifications to
          different sites.
        </p>
      </section>

      <section id="contents">
        <h2>What is typically expected in the pack</h2>
        <p>
          With that caveat in place, there is a recognisable shape to most
          files. Treat the following as the usual contents rather than a
          statutory checklist, and check each item against the specification you
          were given:
        </p>
        <ul>
          <li>Baseline and task-specific risk assessments</li>
          <li>The health and safety plan for the site</li>
          <li>A fall protection and rescue plan where work at height applies</li>
          <li>Contractual documents</li>
          <li>Safe operating procedures for the work and the equipment</li>
          <li>
            Emergency contact numbers, evacuation plans and emergency procedures
          </li>
          <li>Incident reporting and investigation procedures</li>
          <li>
            COIDA documents, including the{" "}
            <a href="/guides/letter-of-good-standing">letter of good standing</a>
          </li>
          <li>
            Employee details: identity documents, driver&rsquo;s licences,
            training certificates and medical certificates of fitness
          </li>
          <li>Registers and checklists for plant and equipment</li>
          <li>
            Records of daily safety talks, planned task observations and daily
            inspections
          </li>
          <li>The company health and safety policy</li>
          <li>Legal appointments</li>
          <li>Any further management plans relevant to the work</li>
        </ul>
        <p>
          A client may want more, may want it in a particular order, and may
          want an index that matches their own numbering. None of that is
          negotiable from your side, and arguing it costs more than complying
          with it.
        </p>
      </section>

      <section id="two-halves">
        <h2>The two halves of the file, and why one of them rots</h2>
        <p>
          Here is the structural point that makes the whole job easier to
          manage. That list is not one kind of document. It is two, and they
          behave completely differently.
        </p>
        <p>
          The first half is written once and reused with light edits. Your
          policy, your procedures, your risk assessment methodology, your
          emergency arrangements: these change when the work changes or when a
          client asks for something specific, not every month. The second half
          is a snapshot of people on a particular day. Who is on site. What each
          of them is trained on. When each certificate expires. Whose medical is
          current. Whose certified identity document copy is recent enough.
        </p>
        <p>
          The second half is stale almost immediately, and it is the half that
          gets a pack sent back.
        </p>
        <GuideTable
          caption="The same file, split by how fast it goes out of date"
          head={["Write once, reuse with edits", "Snapshot of a given day"]}
          rows={[
            ["Company health and safety policy", "Who is actually on this site"],
            [
              "Baseline risk assessment methodology",
              "Training certificates and their expiry dates",
            ],
            [
              "Safe operating procedures",
              "Medical certificates of fitness",
            ],
            [
              "Incident reporting and investigation procedures",
              "Site inductions and permits",
            ],
            [
              "Emergency procedures and evacuation plans",
              "Certified copies of identity documents",
            ],
            [
              "Fall protection and rescue plan template",
              "Driver licences and operator authorisations",
            ],
            [
              "Contractual documents and appointment templates",
              "Letter of good standing and COIDA status",
            ],
            [
              "Plant and equipment checklist formats",
              "Completed registers, inspections and safety talk records",
            ],
          ]}
        />
        <p>
          Once you see the file this way, the sensible response is obvious. Stop
          rebuilding the left column. It is already correct, and rewriting it is
          how typing errors get in. Spend the effort on the right column, which
          is the only part that is genuinely different on every submission.
        </p>
      </section>

      <section id="expiry">
        <h2>Certified copies and the things that expire quietly</h2>
        <p>
          The right-hand column fails in a particular way: nothing announces
          itself. A certificate does not stop working on its expiry date, it
          just stops being acceptable to a reviewer, and you find out when the
          pack comes back.
        </p>
        <p>
          Certified copies are the classic example. South African clients
          commonly require a certified copy of an identity document to be
          recent, often within three months. That requirement comes from the
          client rather than from the Act, so it is commonly required rather
          than legally fixed, and it varies. What does not vary is the
          consequence: a copy certified eight months ago is a rejected page, no
          matter how valid the identity document behind it is.
        </p>
        <p>
          The same quiet expiry applies to medical certificates of fitness, site
          inductions, licences and operator authorisations, and to your letter
          of good standing, which runs on an annual cycle of its own. Each of
          those has a different date. That is the real problem. Nobody forgets
          one deadline; they lose track of forty of them across a crew of
          fifteen employees.
        </p>
        <p>
          A practical habit: keep one list of every person on your books with
          every expiry date against their name, sorted by date, and look at it
          before you promise a client a submission date. If three medicals
          expire next month, you want to know that while you still have time to
          book them.
        </p>
      </section>

      <section id="rejection">
        <h2>What a rejection actually costs you</h2>
        <p>
          It is worth being blunt about this, because the cost is not the
          document. A pack rejected for one expired induction or one stale
          certified copy goes back to the start of the client&rsquo;s approval
          queue. That queue can take weeks, and your crew waits while it moves.
        </p>
        <p>
          So the arithmetic is lopsided in a way that is easy to miss when you
          are in a hurry. Replacing one certificate is an afternoon. Rejoining
          the queue behind everybody else is a fortnight of employees not
          earning and a client whose next call goes to someone else. The
          expensive failure is almost always a small, boring, completely
          preventable one.
        </p>
        <p>
          Which is the argument for checking the perishable half twice and the
          permanent half not at all.
        </p>
      </section>

      <section id="reprint">
        <h2>Building it so the next submission is a reprint</h2>
        <p>
          The goal is to get to a point where producing a safety file is
          printing, not writing. That takes three things.
        </p>
        <p>
          <strong>Separate the two halves physically.</strong> Keep the
          write-once documents as a maintained master set that you version when
          something genuinely changes, not a folder you copy and overwrite per
          client. Keep the people records somewhere they can be read as a live
          list rather than as a stack of scanned pages.
        </p>
        <p>
          <strong>Track expiry dates as data, not as paper.</strong> Every
          training certificate, medical, licence, induction and certified copy
          has a date. If those dates live only on the documents, the only way to
          check them is to open every file. If they live in one register, you
          can see in a minute who is current and who is not, and you can see it
          a month early instead of on the day the client asks.
        </p>
        <p>
          <strong>Start every submission from the specification.</strong> Read
          the client&rsquo;s health and safety specification, build the index to
          match it, and then pull the write-once documents in behind that index.
          Assembling to the client&rsquo;s order rather than your own removes
          most of the back-and-forth, because the reviewer can find each item
          where they expect it.
        </p>
        <p>
          Do that, and a new client stops being a week of scanning. It becomes
          an afternoon: confirm the specification, pull the master documents,
          refresh anything in the perishable column that has gone out of date,
          and submit. The file still proves nothing about what happens on site,
          and no file or system makes you compliant. But it stops being the
          reason your crew is standing at a gate.
        </p>
      </section>
    </GuideShell>
  );
}
