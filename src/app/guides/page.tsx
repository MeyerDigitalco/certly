import type { Metadata } from "next";
import Link from "next/link";
import { CertlyMark } from "@/components/CertlyMark";
import { SITE, jsonLd } from "@/lib/site";
import { GUIDES, longDate } from "@/lib/guides";

export const metadata: Metadata = {
  title: "Compliance guides for South African contractors",
  description:
    "Plain explanations of the South African deadlines contractors keep missing: the EEA2, the SETA skills reports, the letter of good standing and the safety file.",
  alternates: { canonical: `${SITE.domain}/guides` },
  openGraph: {
    title: "Compliance guides for South African contractors",
    description:
      "The employer deadlines contractors keep missing, explained in plain language.",
    url: `${SITE.domain}/guides`,
  },
};

const LIST_JSONLD = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Certly compliance guides",
  itemListElement: GUIDES.map((g, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: g.title,
    url: `${SITE.domain}/guides/${g.slug}`,
  })),
};

export default function GuidesIndexPage() {
  return (
    <div className="sheet">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(LIST_JSONLD) }}
      />

      <header className="pad masthead">
        <Link href="/" className="wordmark">
          <CertlyMark size={30} />
          Certly
        </Link>
        <nav className="navset">
          <Link href="/#file">Safety files</Link>
          <Link href="/#reports">Reports</Link>
          <Link href="/#price">Pricing</Link>
          <Link href="/login">Sign in</Link>
          <Link className="btn" href="/signup">
            Start free
          </Link>
        </nav>
      </header>

      <nav className="pad crumbs" aria-label="Breadcrumb">
        <Link href="/">Certly</Link>
        <span aria-hidden="true">/</span>
        <span>Guides</span>
      </nav>

      <section className="pad g-index">
        <p className="kicker">Compliance, in plain language</p>
        <h1>The deadlines nobody tells you about until you have missed one.</h1>
        <p className="g-lede">
          A South African contractor owes more returns than most of them
          realise, and the penalty is rarely a fine. It is a tender you cannot
          bid on, a grant you forfeit, or a crew standing at a gate. These are
          the ones we get asked about most, written for the person who has to
          do the paperwork rather than for a lawyer.
        </p>

        <div className="g-cards">
          {GUIDES.map((g) => (
            <Link key={g.slug} href={`/guides/${g.slug}`} className="g-card">
              <h2>{g.heading}</h2>
              <p>{g.blurb}</p>
              <p className="g-card-m">
                {g.deadline ? (
                  <>
                    <b>{g.deadline}</b>
                    {" · "}
                  </>
                ) : null}
                Checked {longDate(g.updated)}
              </p>
            </Link>
          ))}
        </div>

        <aside className="g-cta">
          <p className="g-cta-k">Why we wrote these</p>
          <p>
            Certly is a training and compliance register for South African
            contractors. Most of these returns are built from facts an employer
            already holds and cannot find: who is on the register, what they
            are trained on, when they started and when they left. We wrote the
            guides because we kept answering the same four questions.
          </p>
          <div className="g-cta-a">
            <Link className="btn" href="/signup">
              Start a 14-day trial
            </Link>
            <Link className="btn btn-o" href="/#reports">
              See the reports
            </Link>
          </div>
        </aside>
      </section>

      <footer className="pad">
        <div className="foot-r">
          <Link href="/" className="wordmark" style={{ fontSize: 19 }}>
            <CertlyMark size={20} />
            Certly
          </Link>
          <p className="formref">
            <Link href="/privacy">Privacy</Link> &nbsp;&middot;&nbsp;{" "}
            <Link href="/terms">Terms</Link> &nbsp;&middot;&nbsp;{" "}
            <Link href="/refunds">Refunds</Link> &nbsp;&middot;&nbsp;{" "}
            <Link href="/contact">Contact</Link> &nbsp;&middot;&nbsp; Built in
            South Africa
          </p>
        </div>
      </footer>
    </div>
  );
}
