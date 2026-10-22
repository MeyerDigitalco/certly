import Link from "next/link";
import { CertlyMark } from "@/components/CertlyMark";
import { GateBoard, SafetyFilePack, ReportBoard, PriceCalculator } from "./LandingClient";

/**
 * The marketing home page is deliberately static. A signed-in visitor never
 * reaches it: the proxy redirects them to /workspace before this renders.
 * That keeps the one page search engines actually index out of the database
 * entirely.
 */

export default function Home() {
  return (
    <div className="sheet">
      <header className="pad masthead">
        <Link href="/" className="wordmark">
          <CertlyMark size={30} />
          Certly
        </Link>
        <nav className="navset">
          <a href="#file">Safety files</a>
          <a href="#reports">Monthly reports</a>
          <Link href="/guides">Guides</Link>
          <a href="#price">Pricing</a>
          <Link href="/contact">Contact</Link>
          <Link href="/login">Sign in</Link>
          <Link className="btn" href="/signup">
            Start free
          </Link>
        </nav>
      </header>

      <div
        className="pad"
        style={{
          borderBottom: "1px solid var(--rule)",
          paddingTop: 7,
          paddingBottom: 7,
        }}
      >
        <p className="formref">
          Form SA-01 &nbsp;&middot;&nbsp; Site access and competency register
          &nbsp;&middot;&nbsp; Rev 2026.1
        </p>
      </div>

      <section className="pad hero">
        <p className="kicker">
          Site access compliance &middot; Republic of South Africa
        </p>
        <h1>
          Nobody gets
          <br />
          turned away
          <br />
          at the gate.
        </h1>

        <div className="hero-grid">
          <div>
            <p className="lede">
              Certly holds every induction, medical, TEBA record and competency
              your crew needs to stand on a client&rsquo;s site, and it tells you
              who lapses <b>before the gate does</b>.
            </p>
            <p className="lede" style={{ marginTop: 14 }}>
              The same register drafts your safety file, builds the monthly HR pack
              your client asks for, and fills in the employment equity and training
              reports the law asks for. Drag the date. Watch your register break.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-lg" href="/signup">
                Start 14-day trial
              </Link>
              <a className="btn btn-o btn-lg" href="#file">
                See a safety file
              </a>
            </div>
            <p className="stamp">
              No card required
              <br />
              Mining or general industry, chosen at signup
              <br />
              Crew loaded in an afternoon
            </p>
          </div>

          <GateBoard />
        </div>
      </section>

      <div className="divider">
        <span className="no">SEC 02</span>
        <span className="ti">Safety files</span>
      </div>

      <section className="pad band band-2" id="file">
        <div className="hd">
          <p className="kicker kicker-bare">The part everyone does by hand</p>
          <h2>
            Draft the file.
            <br />
            Don&rsquo;t rebuild it.
          </h2>
          <p>
            Every client wants the pack their own way, and the employee half of it
            is stale the week after you submit it. Certly already holds that half.
            Pick the client and it drafts the sections it can prove, names the ones
            it cannot, and leaves the judgement calls to your appointed person.
          </p>
        </div>

        <div className="fgrid">
          <div>
            <SafetyFilePack />
          </div>
          <ul className="checks">
            <li>
              <span className="xbox" />
              <span>
                <b>Employee lists build themselves.</b> Names, ID numbers,
                designations and site, straight off your register.
              </span>
            </li>
            <li>
              <span className="xbox" />
              <span>
                <b>Certificates attach as evidence.</b> Every competency and
                medical you hold goes in as the scanned document, not as a
                promise.
              </span>
            </li>
            <li>
              <span className="xbox" />
              <span>
                <b>Gaps are named, not hidden.</b> A section Certly cannot prove is
                marked outstanding, with the person and the document it still
                needs.
              </span>
            </li>
            <li>
              <span className="xbox" />
              <span>
                <b>Next submission is a reprint.</b> The pack rebuilds off
                today&rsquo;s register, so re-approval takes minutes instead of a
                fortnight.
              </span>
            </li>
          </ul>
        </div>

        <div className="legend">
          <span>
            <span className="tg tg-a">Drafted</span> built from your register
          </span>
          <span>
            <span className="tg tg-s">Stored</span> uploaded once, reused every
            pack
          </span>
          <span>
            <span className="tg tg-y">Sign off</span> written and signed by your
            safety officer
          </span>
        </div>
      </section>

      <div className="divider">
        <span className="no">SEC 03</span>
        <span className="ti">Monthly reports</span>
      </div>

      <section className="pad band" id="reports">
        <div className="hd">
          <p className="kicker kicker-bare">The pack that is due again next month</p>
          <h2>
            Monthly reports,
            <br />
            not monthly
            <br />
            rework.
          </h2>
          <p>
            Head office wants staff movement, turnover, absenteeism and the labour
            plan every month. The Department of Employment and Labour wants your
            EEA2 by January. Your SETA wants the training report by April. Most
            contractors rebuild all of it in a spreadsheet from memory. Certly builds
            it from the register you are already keeping, so the numbers in the pack
            are the numbers on the ground.
          </p>
        </div>

        <div className="fgrid">
          <div>
            <ReportBoard />
          </div>
          <ul className="checks">
            <li>
              <span className="xbox" />
              <span>
                <b>Seven reports, one source.</b> Staff movement, fault terminations
                year on year, overdue retirement, labour plan and onboarding, labour
                unavailability, employment equity and skills development. Pick a month
                and they redraw themselves.
              </span>
            </li>
            <li>
              <span className="xbox" />
              <span>
                <b>Excel on every report.</b> One button gives you the workbook, with
                the figures behind each chart on their own sheet, ready to paste into
                the client&rsquo;s own deck.
              </span>
            </li>
            <li>
              <span className="xbox" />
              <span>
                <b>Fix the data where you find it.</b> A wrong reason or a missing
                start date gets corrected on the report page itself, and the employee
                record changes with it.
              </span>
            </li>
            <li>
              <span className="xbox" />
              <span>
                <b>The statutory ones are built too.</b> The EEA2 workforce profile
                and the Annual Training Report come off the same register, so the two
                submissions that carry a deadline stop being a January and April
                scramble.
              </span>
            </li>
          </ul>
        </div>

        <div className="deadlines">
          <div className="dl-h">What it saves you, and when it is due</div>
          <ul>
            <li>
              <span className="dl-when">15 January</span>
              <span className="dl-what">
                <b>Employment equity report, EEA2</b>
                <span>
                  Compulsory for every employer with fifty or more people. Submitted on
                  time, it is also what qualifies you for the compliance certificate a
                  state contract asks for.
                </span>
              </span>
            </li>
            <li>
              <span className="dl-when">30 April</span>
              <span className="dl-what">
                <b>Workplace Skills Plan and Annual Training Report</b>
                <span>
                  Miss your SETA deadline and the mandatory grant is gone, which is
                  twenty percent of the skills levy you already paid. Certly has the
                  training records; the report is a download.
                </span>
              </span>
            </li>
            <li>
              <span className="dl-when">Every month</span>
              <span className="dl-what">
                <b>The client pack</b>
                <span>
                  Staff movement, fault terminations, overdue retirement, labour plan
                  and unavailability, in a workbook you can hand over as it comes out.
                </span>
              </span>
            </li>
          </ul>
        </div>

        <div className="legend">
          <span>Charts on screen</span>
          <span>Numbers in Excel</span>
          <span>Print to PDF for the file</span>
          <span>No health or disciplinary records held</span>
        </div>
      </section>

      <div className="divider">
        <span className="no">SEC 04</span>
        <span className="ti">What you get on day one</span>
      </div>

      <section className="pad band">
        <div className="hd">
          <h2>A register that argues back.</h2>
        </div>
        <div className="caps">
          <div className="cap">
            <h3>One register, every certificate</h3>
            <p>
              Every person, every training type, every expiry date in one sortable
              view. Filter by site, by crew, or by what is about to fail.
            </p>
          </div>
          <div className="cap">
            <h3>Expiry finds you first</h3>
            <p>
              Expired, due in seven days, due in thirty. Grouped by urgency and by
              site, so you book the refresher before the gate books you.
            </p>
          </div>
          <div className="cap">
            <h3>The certificate itself, attached</h3>
            <p>
              Photograph the card and it lives on the record. Private storage,
              links that expire, no shared drive that half the yard can open.
            </p>
          </div>
          <div className="cap">
            <h3>The register remembers who left</h3>
            <p>
              Record a last day and a reason instead of deleting the person. Seats
              stop being billed, the live register drops them, and twelve months
              later the turnover report can still explain itself.
            </p>
          </div>
          <div className="cap">
            <h3>Your own documents expire too</h3>
            <p>
              A lapsed letter of good standing or B-BBEE certificate turns away the
              whole crew, not one person. Company documents sit in the same renewal
              list as the people, and in the same weekly email.
            </p>
          </div>
          <div className="cap">
            <h3>POPIA handled at the schema</h3>
            <p>
              You are holding ID numbers and medical competencies. Every workspace
              is walled off in the database itself, not by a filter someone might
              forget to write.
            </p>
          </div>
        </div>
      </section>

      <div className="divider">
        <span className="no">SEC 05</span>
        <span className="ti">Pricing</span>
      </div>

      <section className="pad band band-2" id="price">
        <div className="hd">
          <h2>
            R999 a month.
            <br />
            R10 a head after fifty.
          </h2>
          <p>
            One plan. No per-feature upsell, no annual lock-in, no call with sales.
          </p>
        </div>

        <div className="pgrid">
          <PriceCalculator />
          <ul className="checks">
            <li>
              <span className="xbox" />
              <span>
                <b>Fourteen days free.</b> No card, no demo call, no onboarding
                fee.
              </span>
            </li>
            <li>
              <span className="xbox" />
              <span>
                <b>Unlimited sites and admin users.</b> You pay for people on the
                register, not for the office staff who log in.
              </span>
            </li>
            <li>
              <span className="xbox" />
              <span>
                <b>Every report included.</b> Safety files and the full monthly HR
                pack are in the price, not a reporting add-on.
              </span>
            </li>
            <li>
              <span className="xbox" />
              <span>
                <b>Export whenever you want.</b> Your register, your workbooks and
                your files leave in a format you can open without us.
              </span>
            </li>
            <li>
              <span className="xbox" />
              <span>
                <b>One worker turned away costs more</b> than a month of this, and
                you have already paid for that shift.
              </span>
            </li>
          </ul>
        </div>
      </section>

      <div className="divider">
        <span className="no">SEC 06</span>
        <span className="ti">Start</span>
      </div>

      <section className="pad close">
        <h2>
          Load your crew.
          <br />
          See what expires
          <br />
          this month.
        </h2>
        <p>
          Fourteen days, your own people, your own certificates. Load the crew, pull
          a monthly report, and if it does not surface something you did not already
          know about, walk away.
        </p>
        <div className="hero-actions">
          <Link className="btn btn-lg" href="/signup">
            Create your workspace
          </Link>
          <Link className="btn btn-o btn-lg" href="/login">
            Sign in
          </Link>
        </div>
        <div className="sigline">
          <div className="sig">Appointed person &middot; signature</div>
          <div className="sig">Date</div>
        </div>
      </section>

      <footer className="pad">
        <div className="foot-r">
          <Link href="/" className="wordmark" style={{ fontSize: 19 }}>
            <CertlyMark size={20} />
            Certly
          </Link>
          <p className="formref">
            <Link href="/guides">Guides</Link> &nbsp;&middot;&nbsp;{" "}
            <Link href="/privacy">Privacy</Link> &nbsp;&middot;&nbsp;{" "}
            <Link href="/terms">Terms</Link> &nbsp;&middot;&nbsp;{" "}
            <Link href="/refunds">Refunds</Link> &nbsp;&middot;&nbsp;{" "}
            <Link href="/contact">Contact</Link> &nbsp;&middot;&nbsp; Built in
            South Africa
          </p>
        </div>
        <p className="fine">
          Certly organises records you supply and drafts documents from them. It
          does not certify compliance with the Occupational Health and Safety Act
          85 of 1993, the Mine Health and Safety Act 29 of 1996, or any client
          standard, and it does not replace a competent safety practitioner. Every
          pack is reviewed and signed by your own appointed person before
          submission. Client names refer to submission destinations only and do not
          imply affiliation or endorsement.
        </p>
      </footer>
    </div>
  );
}
