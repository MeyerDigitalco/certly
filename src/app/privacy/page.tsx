import type { Metadata } from "next";
import { SITE } from "@/lib/site";
import LegalShell from "@/components/LegalShell";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "How Certly processes personal information under the Protection of Personal Information Act.",
  alternates: { canonical: `${SITE.domain}/privacy` },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalShell
      sectionNo="SEC 06"
      sectionTitle="Privacy"
      kicker="Protection of Personal Information Act 4 of 2013"
      title="Privacy policy"
    >
      <h3>1. Who this covers</h3>
      <p>
        Certly is operated by {SITE.legalEntity}. This policy explains how we
        handle personal information when you visit our website, open an account,
        and use the service.
      </p>

      <h3>2. Two different roles, and why it matters</h3>
      <p>
        Certly handles two kinds of personal information and our legal position is
        different for each.
      </p>
      <p>
        For your <b>account information</b>, the name and email address of the
        people who sign in and the billing details of the business, we are the
        responsible party. We decide why and how that information is processed.
      </p>
      <p>
        For your <b>register</b>, meaning the employee records, identity numbers,
        training records, medical competency records and certificate documents you
        load, we are an operator. Your business is the responsible party. You
        decide what goes in, why it is there and how long it stays. We process it
        only on your instruction and only to run the service for you.
      </p>
      <p>
        This means the obligations to your own employees under POPIA remain yours.
        Certly does not change who is accountable for the workforce data you hold.
      </p>

      <h3>3. What we process</h3>
      <p>
        Account information: full name, email address, hashed password, workspace
        name, role, and the times you signed in.
      </p>
      <p>
        Register information you supply: employee surname and names, their
        identity, passport or permit number and the country that issued it, site,
        superior, designation, training types, training and expiry dates, any
        certificate documents you attach, and a copy of the identity document
        itself where you choose to store one.
      </p>
      <p>
        Stored identity documents are held apart from certificates, in a separate
        private store that only owners and administrators of your workspace can
        open. Viewers cannot open them. You choose whether to store a copy at all;
        the identification details work without one.
      </p>
      <p>
        Technical information: IP address, browser type and pages visited,
        collected in aggregate for security and to understand how the site is used.
      </p>

      <h3>4. Special personal information</h3>
      <p>
        Certificates of medical fitness and similar records can amount to
        information about a person&rsquo;s health, which POPIA treats as special
        personal information. Where you load those into your register you are
        responsible for having a lawful basis to do so, ordinarily that processing
        is necessary to comply with an obligation of employment law or to protect a
        legitimate interest. Certly does not read, analyse or use the clinical
        content of those documents for any purpose of its own.
      </p>

      <h3>5. Why we process it</h3>
      <p>
        To create and secure your account, to provide the register and the
        documents you ask us to draft from it, to bill you, to answer support
        requests, to keep an audit trail of changes inside your workspace, and to
        meet our own legal obligations.
      </p>

      <h3>6. Where your information is stored</h3>
      <p>
        Certly runs on infrastructure hosted outside the Republic. Our database and
        stored certificate files sit in the {SITE.hostingRegion} region of our
        hosting provider. Application hosting and content delivery may process
        requests in other countries.
      </p>
      <p>
        Section 72 of POPIA permits a transfer of personal information outside the
        Republic where the recipient is subject to a law, binding corporate rules
        or a binding agreement that provides an adequate level of protection. We
        rely on contractual terms with our providers that impose data protection
        obligations comparable to POPIA. If your organisation requires that this
        data stay inside South Africa, tell us before you sign up, because our
        current infrastructure cannot meet that requirement.
      </p>

      <h3>7. Who else touches it</h3>
      <p>
        We use a small number of sub-operators to run the service: a managed
        database and file storage provider, an application hosting provider, an
        email delivery provider for account and notification email, and a privacy
        focused website analytics provider. Each is bound to process personal
        information only on our instruction. We do not sell personal information
        and we do not share it for advertising.
      </p>

      <h3>8. How long we keep it</h3>
      <p>
        Register information stays for as long as your workspace is active. When
        you close your account we delete your workspace and its stored files within
        30 days, except where we are required by law to keep a record for longer.
        Billing records are kept for the period required by tax law. You can export
        your register at any time before you close the account.
      </p>

      <h3>9. Security</h3>
      <p>
        Every workspace is isolated at the database using row level security, so a
        query issued by one workspace cannot return another workspace&rsquo;s rows.
        Certificate files are held in private storage and are served only through
        short lived signed links to signed in members of that workspace. Passwords
        are hashed and never stored in readable form. Traffic is encrypted in
        transit.
      </p>
      <p>
        No system is perfectly secure. If a breach affects your personal
        information we will notify you and the Information Regulator as required by
        section 22 of POPIA.
      </p>

      <h3>10. Your rights</h3>
      <p>
        You may ask what personal information we hold about you, ask us to correct
        or delete it, object to processing, and complain. Where the information sits
        in a customer&rsquo;s register, we will refer your request to that customer,
        because they are the responsible party and we may not alter their records
        on our own initiative.
      </p>
      <p>
        Send requests to {SITE.informationOfficerEmail}. We answer within a
        reasonable period and at most 30 days.
      </p>

      <h3>11. Cookies and analytics</h3>
      <p>
        We use a cookie to keep you signed in. That cookie is strictly necessary and
        the service does not work without it. Our website analytics does not use
        cookies, does not track you across sites and does not build a profile of
        you, which is why you are not asked to accept a banner.
      </p>

      <h3>12. Information Officer</h3>
      <p>
        Our Information Officer is {SITE.informationOfficer}, reachable at{" "}
        {SITE.informationOfficerEmail}.
      </p>

      <h3>13. Complaints</h3>
      <p>
        If you are not satisfied with how we have handled your personal information
        you may lodge a complaint with the Information Regulator of South Africa.
        Their contact details are published at inforegulator.org.za.
      </p>

      <h3>14. Changes</h3>
      <p>
        We will post any change on this page and update the effective date. If a
        change materially affects how we handle your information we will tell
        account holders by email before it takes effect.
      </p>
    </LegalShell>
  );
}
