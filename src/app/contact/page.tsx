import type { Metadata } from "next";
import Link from "next/link";
import { CertlyMark } from "@/components/CertlyMark";
import { SITE } from "@/lib/site";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Talk to Certly about site access compliance and safety files for your crews.",
  alternates: { canonical: `${SITE.domain}/contact` },
};

export default function ContactPage() {
  return (
    <div className="sheet">
      <header className="pad masthead">
        <Link href="/" className="wordmark" style={{ textDecoration: "none" }}>
          <CertlyMark size={26} />
          Certly
        </Link>
        <nav className="navset">
          <Link href="/">Home</Link>
          <Link href="/login">Sign in</Link>
          <Link className="btn" href="/signup">
            Start free
          </Link>
        </nav>
      </header>

      <div className="divider">
        <span className="no">SEC 01</span>
        <span className="ti">Enquiry</span>
      </div>

      <section className="pad band">
        <div className="hd">
          <p className="kicker kicker-bare">Straight to a person</p>
          <h2>Tell us what you are up against.</h2>
          <p>
            Fill this in and it opens WhatsApp with the message written. No call
            centre, no form that disappears into an inbox nobody reads.
          </p>
        </div>
        <div className="legal" style={{ marginTop: 32 }}>
          <ContactForm />
        </div>
      </section>

      <footer className="pad">
        <div className="foot-r">
          <Link href="/" className="wordmark" style={{ fontSize: 19 }}>
            <CertlyMark size={18} />
            Certly
          </Link>
          <p className="formref">
            <Link href="/privacy">Privacy</Link> &nbsp;&middot;&nbsp;{" "}
            <Link href="/terms">Terms</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
