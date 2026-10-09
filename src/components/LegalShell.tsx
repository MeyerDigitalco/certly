import Link from "next/link";
import { CertlyMark } from "@/components/CertlyMark";
import { SITE } from "@/lib/site";

export default function LegalShell({
  sectionNo,
  sectionTitle,
  kicker,
  title,
  children,
}: {
  sectionNo: string;
  sectionTitle: string;
  kicker: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="sheet">
      <header className="pad masthead">
        <Link href="/" className="wordmark" style={{ textDecoration: "none" }}>
          <CertlyMark size={26} />
          Certly
        </Link>
        <nav className="navset">
          <Link href="/">Home</Link>
          <Link href="/contact">Contact</Link>
          <Link className="btn" href="/signup">
            Start free
          </Link>
        </nav>
      </header>

      <div className="divider">
        <span className="no">{sectionNo}</span>
        <span className="ti">{sectionTitle}</span>
      </div>

      <section className="pad band">
        <div className="hd">
          <p className="kicker kicker-bare">{kicker}</p>
          <h2>{title}</h2>
        </div>
        <p className="formref" style={{ marginTop: 20 }}>
          Effective {SITE.effectiveDate} &nbsp;&middot;&nbsp; {SITE.legalEntity}{" "}
          &nbsp;&middot;&nbsp; {SITE.addressLine}
        </p>
        <div className="legal">{children}</div>
      </section>

      <footer className="pad">
        <div className="foot-r">
          <div className="wordmark" style={{ fontSize: 19 }}>
            <CertlyMark size={18} />
            Certly
          </div>
          <p className="formref">
            <Link href="/privacy">Privacy</Link> &nbsp;&middot;&nbsp;{" "}
            <Link href="/terms">Terms</Link> &nbsp;&middot;&nbsp;{" "}
            <Link href="/refunds">Refunds</Link> &nbsp;&middot;&nbsp;{" "}
            <Link href="/contact">Contact</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
