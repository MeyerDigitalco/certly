import Link from "next/link";
import { CertlyMark } from "@/components/CertlyMark";
import { SITE } from "@/lib/site";
import { GUIDES, longDate, otherGuides, type Guide } from "@/lib/guides";

/**
 * The frame every guide sits in.
 *
 * It carries the masthead, the contents list, the structured data and the
 * one call to action, so a guide page is only its own prose. The FAQ is
 * rendered visibly and described in FAQPage structured data from the same
 * array, because Google will not show a rich result for an answer a reader
 * cannot see on the page.
 */

export interface GuideFaq {
  q: string;
  a: string;
}

export interface GuideSection {
  id: string;
  heading: string;
}

export default function GuideShell({
  guide,
  sections,
  faqs,
  children,
}: {
  guide: Guide;
  sections: GuideSection[];
  faqs: GuideFaq[];
  children: React.ReactNode;
}) {
  const url = `${SITE.domain}/guides/${guide.slug}`;
  const related = otherGuides(guide.slug);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    inLanguage: "en-ZA",
    dateModified: guide.updated,
    datePublished: guide.updated,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: { "@type": "Organization", name: SITE.legalEntity, url: SITE.domain },
    publisher: {
      "@type": "Organization",
      name: SITE.name,
      url: SITE.domain,
    },
    about: guide.keywords.join(", "),
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Certly", item: SITE.domain },
      { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE.domain}/guides` },
      { "@type": "ListItem", position: 3, name: guide.heading, item: url },
    ],
  };

  return (
    <div className="sheet">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <header className="pad masthead">
        <Link href="/" className="wordmark">
          <CertlyMark size={30} />
          Certly
        </Link>
        <nav className="navset">
          <Link href="/guides">Guides</Link>
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
        <Link href="/guides">Guides</Link>
        <span aria-hidden="true">/</span>
        <span>{guide.heading}</span>
      </nav>

      <article className="pad guide">
        <p className="kicker">South African compliance &middot; Guide</p>
        <h1>{guide.heading}</h1>
        <p className="g-lede">{guide.description}</p>
        <p className="g-meta">
          {guide.deadline ? (
            <>
              <b>{guide.deadline}</b>
              {" · "}
            </>
          ) : null}
          Checked {longDate(guide.updated)}
        </p>

        {sections.length > 0 ? (
          <nav className="g-toc" aria-label="On this page">
            <p className="g-toc-h">On this page</p>
            <ol>
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>{s.heading}</a>
                </li>
              ))}
              <li>
                <a href="#faq">Common questions</a>
              </li>
            </ol>
          </nav>
        ) : null}

        <div className="g-body">{children}</div>

        <section className="g-faq" id="faq">
          <h2>Common questions</h2>
          <dl>
            {faqs.map((f) => (
              <div key={f.q}>
                <dt>{f.q}</dt>
                <dd>{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <aside className="g-cta">
          <p className="g-cta-k">Where Certly fits</p>
          <p>
            Certly is a training and compliance register for South African
            contractors. It holds every certificate, medical and identity
            document your crew needs on site, and builds the monthly client
            pack, the EEA2 and the SETA training report from that same
            register, so the reports stop being a retyping exercise.
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

        {related.length > 0 ? (
          <section className="g-more">
            <h2>More guides</h2>
            <ul>
              {related.map((g) => (
                <li key={g.slug}>
                  <Link href={`/guides/${g.slug}`}>{g.heading}</Link>
                  <span>{g.blurb}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="g-fine">
          This guide is general information about South African compliance
          obligations, not legal advice, and the rules and dates change. Check
          the current position with the Department of Employment and Labour,
          your SETA or your own advisor before you rely on it. Certly organises
          records you supply and drafts documents from them; it does not certify
          compliance with any Act or client standard.
        </p>
      </article>

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
      </footer>
    </div>
  );
}

/** A pull-out box for the one number a reader came to find. */
export function KeyFact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <aside className="g-key">
      <p className="g-key-l">{label}</p>
      <div>{children}</div>
    </aside>
  );
}

/** A plain table that keeps the paper look without Tailwind classes. */
export function GuideTable({
  head,
  rows,
  caption,
}: {
  head: string[];
  rows: Array<Array<React.ReactNode>>;
  caption?: string;
}) {
  return (
    <div className="g-tablewrap">
      <table className="g-table">
        {caption ? <caption>{caption}</caption> : null}
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const GUIDE_COUNT = GUIDES.length;
