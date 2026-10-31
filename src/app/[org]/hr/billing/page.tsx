import { publicOrigin } from "@/lib/origin";
import { notFound } from "next/navigation";
import { Users, Receipt, ShieldCheck, AlertTriangle, Clock } from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { isOwner } from "@/lib/auth/roles";
import { getBillingState } from "@/lib/billing/access";
import {
  formatRands,
  payfastAmount,
  INCLUDED_SEATS,
  EXTRA_SEAT_CENTS,
  BASE_MONTHLY_CENTS,
} from "@/lib/billing/plan";
import {
  payfastConfig,
  checkoutFields,
  signatureProbe,
} from "@/lib/billing/payfast";
import PayFastForm from "./PayFastForm";
import PayFastDiagnostic from "./PayFastDiagnostic";
import CloseAccount from "./CloseAccount";
import CancelSubscription from "./CancelSubscription";
import PageHeader from "@/components/app/PageHeader";
import { SITE } from "@/lib/site";

export const metadata = { title: "Billing" };
export const dynamic = "force-dynamic";


export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{
    paid?: string;
    cancelled?: string;
    debug?: string;
  }>;
}) {
  const { org: slug } = await params;
  const sp = await searchParams;
  const ctx = await requireTenant(slug);

  // Admins run the register. What the workspace pays is the owner's business.
  if (!isOwner(ctx.role)) notFound();

  const state = await getBillingState(ctx.org.id);
  const config = payfastConfig();
  const origin = await publicOrigin();

  const checkout =
    config && origin
      ? checkoutFields({
          config,
          origin,
          orgId: ctx.org.id,
          orgName: ctx.org.name,
          slug,
          billingEmail: ctx.userEmail,
          amount: payfastAmount(state.quote.totalCents),
          seats: state.seats,
        })
      : null;

  // Readable on a live account too, because a signature rejection there is
  // exactly as opaque as in the sandbox. The two secrets inside the string,
  // the merchant key and the passphrase, are replaced by their shape, and the
  // alternative-signature test submissions stay sandbox only so nothing here
  // can start a real debit order.
  const diagnostic =
    checkout && config && sp.debug === "signature"
      ? signatureProbe(
          checkout.fields.filter(([key]) => key !== "signature"),
          config.passphrase,
        )
      : null;

  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader
        kicker="Workspace"
        title="Billing"
        lede={
          <>
            One plan. {formatRands(BASE_MONTHLY_CENTS)} a month covers{" "}
            {INCLUDED_SEATS} people on the register, then{" "}
            {formatRands(EXTRA_SEAT_CENTS)} for each person above that. No setup
            fee, no contract, cancel whenever.
          </>
        }
        back={{ href: `/${slug}/hr`, label: "Back to overview" }}
      />

      {/* Returned from PayFast. The old message said the same thing whether
          the confirmation had arrived, failed or never been sent, which reads
          as reassurance exactly when something has gone wrong. It now says
          which of the two happened. */}
      {sp.paid === "1" && state.state === "subscribed" ? (
        <p className="bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl px-4 py-3 text-sm">
          Thanks, your subscription is active.
        </p>
      ) : null}
      {sp.paid === "1" &&
      (state.state === "trialing" || state.state === "trial_expired") ? (
        <div className="bg-amber-50 border border-amber-300 text-amber-950 rounded-xl px-4 py-3 text-sm space-y-2">
          <p className="font-bold">
            We have not had PayFast&apos;s confirmation yet.
          </p>
          <p>
            PayFast confirms in the background and it usually takes seconds, so
            refresh this page once. If it still says trial after a minute, the
            confirmation did not reach us and your workspace will not go active
            on its own.
          </p>
          <p>
            If money has left your account, nothing is lost and you will not be
            charged twice. Email{" "}
            <a className="underline font-bold" href={`mailto:${SITE.email}`}>
              {SITE.email}
            </a>{" "}
            with the date and amount and we will sort it out, including
            stopping the debit order if one was set up.
          </p>
        </div>
      ) : null}
      {sp.cancelled === "1" ? (
        <p className="bg-[var(--brand-cream)] border border-[var(--brand-line)] rounded-xl px-4 py-3 text-sm">
          Nothing was charged. Your workspace carries on as it was.
        </p>
      ) : null}

      <Status
        state={state}
        orgId={ctx.org.id}
        slug={slug}
        periodEnd={ctx.org.current_period_end}
      />

      <section className="bg-white border border-[var(--brand-line)] rounded-2xl p-6 space-y-4">
        <header className="flex items-start gap-3">
          <Receipt size={20} className="text-[var(--brand-red)] mt-0.5 shrink-0" />
          <div>
            <h2 className="text-lg font-black">What you would pay today</h2>
            <p className="text-sm text-[var(--brand-slate)] mt-1">
              Calculated from the people on your register right now, not from a
              seat count you have to maintain by hand.
            </p>
          </div>
        </header>

        <table className="w-full text-sm">
          <tbody>
            <Line
              label={`Base, includes ${INCLUDED_SEATS} people`}
              value={formatRands(state.quote.baseCents)}
            />
            <Line
              label={
                state.quote.extraSeats === 0
                  ? `Additional people (none, you have ${state.seats})`
                  : `${state.quote.extraSeats} additional ${
                      state.quote.extraSeats === 1 ? "person" : "people"
                    } at ${formatRands(EXTRA_SEAT_CENTS)}`
              }
              value={formatRands(state.quote.extraCents)}
              muted={state.quote.extraSeats === 0}
            />
            <tr className="border-t border-[var(--brand-ink)]">
              <td className="py-3 font-black">Per month</td>
              <td className="py-3 font-black text-right font-mono">
                {formatRands(state.quote.totalCents)}
              </td>
            </tr>
          </tbody>
        </table>

        <p className="text-xs text-[var(--brand-slate)]">
          Certly is not registered for VAT, so no VAT is charged and none is
          shown. Prices are in rand.
        </p>
      </section>

      <section className="bg-white border border-[var(--brand-line)] rounded-2xl p-6 space-y-4">
        <header className="flex items-start gap-3">
          <Users size={20} className="text-[var(--brand-red)] mt-0.5 shrink-0" />
          <div>
            <h2 className="text-lg font-black">Your register</h2>
            <p className="text-sm text-[var(--brand-slate)] mt-1">
              {state.seats} {state.seats === 1 ? "person" : "people"}.
              Certificates are unlimited; only headcount moves the price.
            </p>
          </div>
        </header>
      </section>

      {state.state === "subscribed" || state.state === "exempt" ? null : checkout ? (
        <section className="bg-white border border-[var(--brand-line)] rounded-2xl p-6">
          <PayFastForm
            action={checkout.action}
            fields={checkout.fields}
            total={formatRands(state.quote.totalCents)}
          />
        </section>
      ) : (
        <section className="bg-[var(--brand-cream)] border border-[var(--brand-line)] rounded-2xl p-6">
          <p className="text-sm font-bold">Payments are not connected yet.</p>
          <p className="mt-1 text-sm text-[var(--brand-slate)]">
            The PayFast merchant credentials are not set on this deployment, so
            nobody can subscribe. Nothing is broken for your customers; they
            simply cannot pay yet.
          </p>
        </section>
      )}

      {diagnostic && checkout && config ? (
        <PayFastDiagnostic
          action={checkout.action}
          probe={diagnostic}
          merchantId={config.merchantId}
          sandbox={config.sandbox}
        />
      ) : null}

      <CloseAccount
        orgId={ctx.org.id}
        orgName={ctx.org.name}
        orgSlug={ctx.org.slug}
        seats={state.seats}
      />
    </div>
  );
}

function Status({
  state,
  orgId,
  slug,
  periodEnd,
}: {
  state: Awaited<ReturnType<typeof getBillingState>>;
  orgId: string;
  slug: string;
  periodEnd: string | null;
}) {
  // An internal or comped workspace is never billed, so it is shown no
  // countdown, no price and no subscribe button. Those would be asking it for
  // money it is exempt from.
  if (state.state === "exempt") {
    return (
      <section className="bg-[var(--brand-cream)] border border-[var(--brand-line)] rounded-2xl p-6 flex items-start gap-3">
        <ShieldCheck size={20} className="text-[var(--brand-slate)] mt-0.5 shrink-0" />
        <div>
          <p className="font-black">Internal workspace</p>
          <p className="text-sm text-[var(--brand-slate)] mt-1">
            This workspace is not billed and does not expire. Everything stays
            writable with no subscription.
          </p>
        </div>
      </section>
    );
  }

  if (state.state === "subscribed") {
    return (
      <section className="bg-emerald-50 border border-emerald-300 rounded-2xl p-6 flex items-start gap-3">
        <ShieldCheck size={20} className="text-emerald-700 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="font-black text-emerald-900">Subscribed</p>
          <p className="text-sm text-emerald-900 mt-1">
            {state.daysLeft !== null
              ? `Next debit order in ${state.daysLeft} day${state.daysLeft === 1 ? "" : "s"}.`
              : "Your subscription is active."}{" "}
            Cancel whenever you like. Your workspace stays readable afterwards
            and nothing is deleted.
          </p>
          <CancelSubscription orgId={orgId} slug={slug} periodEnd={periodEnd} />
        </div>
      </section>
    );
  }

  if (state.state === "trialing") {
    const days = state.daysLeft ?? 0;
    return (
      <section className="bg-[var(--brand-cream)] border border-[var(--brand-line)] rounded-2xl p-6">
        <p className="font-black">
          {days <= 0
            ? "Your trial ends today."
            : `${days} day${days === 1 ? "" : "s"} left on your trial.`}
        </p>
        <p className="text-sm text-[var(--brand-slate)] mt-1">
          When it ends the workspace goes read only. Nothing is deleted. You
          keep the register, the exports and the safety file packs; you just
          cannot add or change anything until you subscribe.
        </p>
      </section>
    );
  }

  // Cancelled but still inside the paid period is not a fault and needs
  // nothing from anybody. Shouting "Action needed" in red at someone who just
  // chose to cancel, and who still has everything they paid for, reads like
  // the cancellation failed.
  if (state.state === "cancelled" && state.canWrite) {
    return (
      <section className="bg-[var(--brand-cream)] border border-[var(--brand-line)] rounded-2xl p-6 flex items-start gap-3">
        <Clock size={20} className="text-[var(--brand-slate)] mt-0.5 shrink-0" />
        <div>
          <p className="font-black">Cancelled</p>
          <p className="text-sm text-[var(--brand-slate)] mt-1">
            {state.reason} Nothing more will be debited, and you can subscribe
            again whenever you like.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start gap-3">
      <AlertTriangle size={20} className="text-red-700 mt-0.5 shrink-0" />
      <div>
        <p className="font-black text-red-900">
          {state.canWrite ? "Action needed" : "Read only"}
        </p>
        <p className="text-sm text-red-900 mt-1">{state.reason}</p>
      </div>
    </section>
  );
}

function Line({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <tr className="border-t border-[var(--brand-line)]">
      <td className={`py-3 ${muted ? "text-[var(--brand-slate)]" : ""}`}>
        {label}
      </td>
      <td
        className={`py-3 text-right font-mono ${muted ? "text-[var(--brand-slate)]" : ""}`}
      >
        {value}
      </td>
    </tr>
  );
}
