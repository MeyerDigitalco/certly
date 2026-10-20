import Link from "next/link";
import { CertlyMark } from "@/components/CertlyMark";

export default function NotFound() {
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
          <Link className="btn" href="/login">
            Sign in
          </Link>
        </nav>
      </header>

      <div className="divider">
        <span className="no">ERR 404</span>
        <span className="ti">Access denied at this address</span>
      </div>

      <section className="pad band nf">
        <p className="kicker">Form SA-01 &middot; entry refused</p>
        <h1>
          No such
          <br />
          record.
        </h1>
        <p className="lede" style={{ marginTop: 26 }}>
          The page you asked for is not on this register. Either the address is
          wrong, or the record belongs to a workspace you are not a member of.
        </p>
        <p className="lede" style={{ marginTop: 14 }}>
          Certly treats those two cases identically on purpose. A workspace never
          reveals that it exists to someone outside it.
        </p>
        <div className="hero-actions">
          <Link className="btn btn-lg" href="/">
            Back to the front page
          </Link>
          <Link className="btn btn-o btn-lg" href="/login">
            Sign in
          </Link>
        </div>
        <div className="sigline">
          <div className="sig">Reference &middot; HTTP 404</div>
          <div className="sig">Action &middot; check the address</div>
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
            <Link href="/terms">Terms</Link> &nbsp;&middot;&nbsp;{" "}
            <Link href="/contact">Contact</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
