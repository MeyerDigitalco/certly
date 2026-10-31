import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";
import LegalShell from "@/components/LegalShell";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The terms on which Certly is provided to South African businesses.",
  alternates: { canonical: `${SITE.domain}/terms` },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <LegalShell
      sectionNo="SEC 07"
      sectionTitle="Terms"
      kicker="Agreement between you and us"
      title="Terms of service"
    >
      <h3>1. Who is agreeing</h3>
      <p>
        These terms are between {SITE.legalEntity}, which operates Certly, and the
        business that opens a workspace. If you accept these terms on behalf of a
        business you confirm that you are authorised to bind it.
      </p>

      <h3>2. What Certly is</h3>
      <p>
        Certly is a record keeping tool. It stores employee training and
        certification records that you supply, shows you what has expired or is
        about to, holds certificate documents you attach, and assembles those
        records into document packs on request.
      </p>

      <h3>3. What Certly is not</h3>
      <p>
        Certly does not certify compliance with the Occupational Health and Safety
        Act 85 of 1993, the Mine Health and Safety Act 29 of 1996, the Construction
        Regulations, or any client, mine or industry standard. It does not provide
        legal, safety or medical advice, and it does not replace a competent person,
        a registered safety practitioner, or any appointment required by law.
      </p>
      <p>
        Documents Certly drafts are drafts. Every pack must be reviewed and signed
        by your own appointed person before it is submitted to anyone. You remain
        solely responsible for the accuracy, completeness and legality of anything
        you submit, and for the safety of your people.
      </p>

      <h3>4. Your account</h3>
      <p>
        You are responsible for the accuracy of the records you load and for who you
        invite into your workspace. Owners and administrators can read, change and
        delete every record in the workspace. Keep credentials confidential and tell
        us promptly if you believe an account has been compromised.
      </p>

      <h3>5. Your data stays yours</h3>
      <p>
        You own the records you load. We claim no ownership of them. We process them
        only to run the service for you, as set out in our privacy policy, where we
        act as your operator under POPIA. Where your organisation requires a written
        operator agreement under sections 20 and 21 of POPIA, ask us and we will
        conclude one with you.
      </p>

      <h3>6. Trial and fees</h3>
      <p>
        New workspaces get a 14 day trial with no card required. After that the
        subscription is R999 per month for a register of up to 50 people, plus R10
        per month for each additional person on the register. Prices are in South
        African rand. {SITE.legalEntity} is not registered for VAT, so no VAT is
        charged and none is shown. Fees are billed monthly in advance by debit
        order through PayFast and are not refundable once taken.
      </p>
      <p>
        Full billing, cancellation and refund terms are in our{" "}
        <Link href="/refunds">refund and cancellation policy</Link>.
      </p>
      <p>
        We may change prices on 30 days written notice to the email address on the
        account. If you do not accept a price change you may cancel before it takes
        effect.
      </p>

      <h3>7. Acceptable use</h3>
      <p>
        Do not load personal information you have no lawful basis to hold, attempt
        to reach another workspace&rsquo;s data, probe or overload the service,
        resell access without our written agreement, or upload malicious files.
      </p>

      <h3>8. Availability</h3>
      <p>
        We work to keep Certly available but we do not promise uninterrupted
        service. We may take the service down for maintenance, and we will give
        notice where we reasonably can. We do not offer a service level agreement on
        the standard plan.
      </p>

      <h3>9. No warranty</h3>
      <p>
        Certly is provided as it is and as it is available. We do not warrant that
        it is free of errors, that it will meet any particular requirement of
        yours, that the records it holds are accurate, or that a pack it assembles
        will be accepted by any client, mine, regulator or SETA. Those records are
        the ones you loaded, and the judgement about whether a pack is complete is
        your appointed person&rsquo;s, not ours.
      </p>
      <p>
        To the fullest extent the law allows, all warranties, conditions and terms
        implied by statute or common law are excluded. Nothing in this section
        excludes anything that cannot lawfully be excluded, including under the
        Consumer Protection Act 68 of 2008 where it applies to you.
      </p>

      <h3>10. Liability</h3>
      <p>
        To the fullest extent the law allows, our total liability to you arising out
        of or in connection with this agreement, whether in contract, delict or
        otherwise, is limited to the fees you paid us in the three months before the
        event that gave rise to the claim.
      </p>
      <p>
        We are not liable for loss of profit, loss of contract, penalties imposed by
        a client or regulator, the cost of a crew being turned away or stood down, or
        any indirect or consequential loss. Nothing in these terms excludes liability
        that cannot lawfully be excluded, including under the Consumer Protection Act
        68 of 2008 where it applies to you.
      </p>

      <h3>11. Your indemnity</h3>
      <p>
        You decide whose personal information goes into your workspace and on what
        lawful basis. Under POPIA you are the responsible party for it and we are
        your operator, which means the duty to have a basis for holding it, to tell
        your people what you hold, and to keep your workspace&rsquo;s access
        correct, is yours.
      </p>
      <p>
        You therefore indemnify us against any claim, penalty, fine or reasonable
        cost brought by a third party, including one of your employees, a client or
        the Information Regulator, to the extent it arises from:
      </p>
      <ul>
        <li>
          personal information you loaded without a lawful basis, or kept after you
          no longer had one;
        </li>
        <li>
          access you granted, or failed to withdraw, to someone in your workspace;
        </li>
        <li>
          a document or report you submitted to a client, mine, regulator or SETA
          that was inaccurate or incomplete;
        </li>
        <li>your breach of the acceptable use section above.</li>
      </ul>
      <p>
        This does not apply to the extent the claim arises from our own breach of
        these terms, our negligence, or our failure to keep your workspace secure.
        We will tell you promptly about any claim we want to rely on this for, let
        you take over its defence if you want to, and not settle it without asking
        you first.
      </p>

      <h3>12. Suspension and cancellation</h3>
      <p>
        You may cancel at any time from the Billing screen in your workspace. No
        further debit order is taken, you keep full use until the end of the month
        already paid for, and after that the workspace becomes read only rather than
        closed. We may suspend a workspace for non payment after written notice, or
        immediately where use threatens the security or integrity of the service.
      </p>
      <p>
        An owner can also close a workspace outright from the Billing screen, which
        permanently deletes every record and file in it. See our{" "}
        <Link href="/refunds">refund and cancellation policy</Link> for the detail.
      </p>

      <h3>13. Getting your data out</h3>
      <p>
        You can export your register and download your certificate files at any time
        while the workspace is active. After cancellation we keep the workspace
        recoverable for 30 days, then delete it. Export before you cancel.
      </p>

      <h3>14. Changes to these terms</h3>
      <p>
        We may update these terms. Material changes will be notified by email to
        account holders at least 30 days before they take effect. Continuing to use
        Certly after that date means you accept the updated terms.
      </p>

      <h3>15. Governing law</h3>
      <p>
        These terms are governed by the law of the Republic of South Africa, and the
        courts of South Africa have jurisdiction. Notices to us go to {SITE.email}.
        Notices to you go to the email address on the account.
      </p>
    </LegalShell>
  );
}
