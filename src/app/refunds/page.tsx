import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";
import LegalShell from "@/components/LegalShell";

export const metadata: Metadata = {
  title: "Refund and cancellation policy",
  description:
    "How Certly subscriptions are billed, how to cancel, and why payments already taken are not refunded.",
  alternates: { canonical: `${SITE.domain}/refunds` },
  robots: { index: true, follow: true },
};

export default function RefundsPage() {
  return (
    <LegalShell
      sectionNo="SEC 08"
      sectionTitle="Refunds"
      kicker="Billing, cancellation and refunds"
      title="Refund and cancellation policy"
    >
      <h3>1. Try it before you pay anything</h3>
      <p>
        Every new workspace gets a 14 day trial. No card is asked for and no
        card is stored. Nothing is charged during the trial, and if you do
        nothing at the end of it, nothing is charged after it either. The
        workspace simply becomes read only.
      </p>
      <p>
        This is deliberate, and it is the reason the rest of this policy is
        short. You only ever pay Certly after you have used it for two weeks
        with your own people and your own certificates on the register.
      </p>

      <h3>2. What a subscription costs</h3>
      <p>
        R999 per month covers up to 50 people on your register. Each person
        above 50 adds R10 per month. The figure is worked out from the number
        of people on your register, not from a seat count you have to maintain
        by hand, so it moves up and down as your crew does.
      </p>
      <p>
        {SITE.legalEntity} is not registered for VAT, so no VAT is charged and
        none is shown. All prices are in South African rand.
      </p>

      <h3>3. How billing works</h3>
      <p>
        Subscriptions are monthly and are billed in advance by debit order
        through PayFast. The first payment is taken on the day you subscribe,
        and then on the same date each month until you cancel. There is no
        setup fee, no minimum term and no annual contract.
      </p>
      <p>
        Your monthly amount is recalculated from your headcount before each
        billing date. If your register has grown past 50 people the amount
        goes up accordingly, and if it has shrunk the amount comes down. We do
        not charge you for people who have left.
      </p>

      <h3>4. How to cancel</h3>
      <p>
        Open <strong>Billing</strong> in your workspace and choose{" "}
        <strong>Cancel subscription</strong>. It takes effect immediately, in
        the sense that no further debit order is taken. You do not need to
        phone anyone, email anyone, or give a reason.
      </p>
      <p>
        You keep full use of the workspace until the end of the month you have
        already paid for. After that date the workspace becomes read only: you
        can still sign in, read your register, download your CSV exports and
        build safety file packs, but you cannot add or change records until
        you subscribe again.
      </p>
      <p>
        You can also cancel the debit order directly from your own PayFast
        account. If you do it that way, tell us as well, because a cancellation
        made outside Certly can take a little longer to reach us.
      </p>

      <h3>5. Refunds</h3>
      <p>
        <strong>
          Payments are not refunded once they have been taken.
        </strong>{" "}
        The month is billed in advance and you keep full use of the service
        for the whole of it, so cancelling on day 20 gives you the remaining
        10 days rather than 10 days back. There is no part month refund and no
        change of mind refund.
      </p>
      <p>
        This is why the trial exists and why it asks for no card. You get 14
        days with your own crew on the register before you are asked to pay
        anything, which is the point at which to decide.
      </p>
      <p>
        A charge that should never have been taken is a billing error, not a
        refund, and we correct those in full. That means:
      </p>
      <ul>
        <li>
          you were charged after cancelling, or charged more than once for the
          same month;
        </li>
        <li>
          you were charged an amount that does not match the headcount on your
          register on the billing date;
        </li>
        <li>
          you were charged in error for any other reason attributable to us.
        </li>
      </ul>
      <p>
        We correct these whether or not you ask, as soon as we find them.
      </p>

      <h3>6. How to report a charge you think is wrong</h3>
      <p>
        Email <a href={`mailto:${SITE.email}`}>{SITE.email}</a> or WhatsApp us
        on 082 097 6115, with the workspace name and the date of the charge.
        We reply within two business days. Corrections are paid back to the
        account the debit order came from, normally within 10 business days,
        depending on PayFast and your bank.
      </p>
      <p>
        If you are not satisfied with how we have handled a charge, you can take
        it up with PayFast through their dispute process, or with your own
        bank.
      </p>

      <h3>7. If we cancel</h3>
      <p>
        We may suspend or cancel a workspace for non payment after written
        notice, or immediately where use threatens the security of the service
        or breaches the acceptable use section of our{" "}
        <Link href="/terms">terms of service</Link>. Where we cancel for any
        reason other than your breach, we refund the unused part of the month
        you have paid for.
      </p>

      <h3>8. Your data when you leave</h3>
      <p>
        Cancelling does not delete anything. The workspace stays readable and
        exportable, and we keep it recoverable for 30 days after the paid
        period ends before it is deleted.
      </p>
      <p>
        If you want everything removed sooner, an owner can close the
        workspace from the Billing screen, which permanently deletes every
        record, every certificate file and every identity document in it. That
        is immediate and cannot be undone, so export first.
      </p>

      <h3>9. Statutory rights</h3>
      <p>
        Nothing in this policy limits any right you have that cannot lawfully
        be limited, including under the Consumer Protection Act 68 of 2008 and
        the Electronic Communications and Transactions Act 25 of 2002, where
        those apply to you.
      </p>

      <h3>10. Contact</h3>
      <p>
        {SITE.legalEntity}, {SITE.addressLine}. Billing questions and refund
        requests: <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
      </p>
    </LegalShell>
  );
}
