import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CertlyMark } from "@/components/CertlyMark";
import { GateBoard, SafetyFilePack, PriceCalculator } from "./LandingClient";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase: any = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: mem } = await supabase
      .from("org_members")
      .select("organisations(slug)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    const slug = mem?.organisations?.slug as string | undefined;
    if (slug) redirect(`/${slug}/hr`);
  }

  return (
    <div className="sheet">
      <header className="pad masthead">
        <div className="wordmark">
          <CertlyMark size={30} />
          Certly
        </div>
        <nav className="navset">
          <a href="#file">Safety files</a>
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
              Drag the date. Watch your register break.
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
        <span className="no">SEC 04</span>
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
                <b>Export whenever you want.</b> Your register and your files leave
                in a format you can open without us.
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
        <span className="no">SEC 05</span>
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
          Fourteen days, your own people, your own certificates. If it does not
          surface something you did not already know about, walk away.
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
          <div className="wordmark" style={{ fontSize: 19 }}>
            <CertlyMark size={20} />
            Certly
          </div>
          <p className="formref">
            <Link href="/privacy">Privacy</Link> &nbsp;&middot;&nbsp;{" "}
            <Link href="/terms">Terms</Link> &nbsp;&middot;&nbsp;{" "}
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
