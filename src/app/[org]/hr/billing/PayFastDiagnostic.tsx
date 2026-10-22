import { FlaskConical } from "lucide-react";
import type { PayFastField, SignatureProbe } from "@/lib/billing/payfast";

/**
 * A sandbox-only panel for settling a signature rejection.
 *
 * PayFast answers a bad signature with one sentence and no detail, so every
 * theory costs a deployment to test. This panel removes that cost. It prints
 * the exact string being hashed, in order, so the field values, their order
 * and the character encoding can all be read off directly, and it offers one
 * submit button per passphrase candidate so the only invisible input can be
 * identified by elimination in a single sitting.
 *
 * It renders only when the deployment is pointed at the sandbox, so it cannot
 * appear on a live merchant account, and only for an owner, because the page
 * that mounts it is already owner-only.
 */
export default function PayFastDiagnostic({
  action,
  fields,
  probe,
  merchantId,
}: {
  action: string;
  fields: PayFastField[];
  probe: SignatureProbe;
  merchantId: string;
}) {
  const unsigned = fields.filter(([key]) => key !== "signature");

  return (
    <section className="bg-[var(--brand-cream)] border-2 border-dashed border-[var(--brand-line)] rounded-2xl p-6 space-y-5">
      <header className="flex items-start gap-3">
        <FlaskConical
          size={20}
          className="text-[var(--brand-red)] mt-0.5 shrink-0"
        />
        <div>
          <h2 className="text-lg font-black">Signature diagnostic</h2>
          <p className="text-sm text-[var(--brand-slate)] mt-1">
            Sandbox only. This panel does not exist on a live merchant account.
            Nothing here is charged to anybody.
          </p>
        </div>
      </header>

      <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="font-bold">Posting to</dt>
        <dd className="font-mono break-all">{action}</dd>
        <dt className="font-bold">Merchant</dt>
        <dd className="font-mono">{merchantId}</dd>
        <dt className="font-bold">Passphrase</dt>
        <dd className="font-mono">{probe.passphraseShape}</dd>
      </dl>

      <div>
        <p className="text-sm font-bold">The string being hashed</p>
        <p className="text-xs text-[var(--brand-slate)] mt-1">
          Field order, values and encoding are all visible here. If PayFast
          disagrees about any of those, it will be a difference you can see in
          this line.
        </p>
        <pre className="mt-2 bg-white border border-[var(--brand-line)] rounded-md p-3 text-[11px] leading-relaxed whitespace-pre-wrap break-all font-mono">
          {probe.hashedString}
        </pre>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-bold">
          Try each one and note which gets past the signature check
        </p>
        <p className="text-xs text-[var(--brand-slate)]">
          Every field is identical in all of them. Only the passphrase used to
          compute the signature changes. Use a private window so you are not
          signed in to the sandbox as the merchant.
        </p>
        {probe.candidates.map((candidate) => (
          <form
            key={candidate.key}
            action={action}
            method="post"
            className="border border-[var(--brand-line)] bg-white rounded-md p-3"
          >
            {unsigned.map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <input type="hidden" name="signature" value={candidate.signature} />
            <button
              type="submit"
              className="text-sm font-bold underline hover:text-[var(--brand-red)] text-left"
            >
              {candidate.label}
            </button>
            <p className="text-[11px] font-mono text-[var(--brand-slate)] mt-1">
              {candidate.signature}
            </p>
          </form>
        ))}
      </div>
    </section>
  );
}
