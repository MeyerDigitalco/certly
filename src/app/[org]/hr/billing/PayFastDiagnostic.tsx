import { FlaskConical } from "lucide-react";
import type { SignatureProbe } from "@/lib/billing/payfast";

/**
 * A sandbox-only panel for settling a signature rejection.
 *
 * PayFast answers a bad signature with one sentence and no detail, so every
 * theory otherwise costs a deployment to test. This panel removes that cost.
 * It prints the exact string being hashed, so field values and encoding can be
 * read off directly, and it offers one submit per candidate rule so the two
 * inputs that are not visible in the posted form, the hashing order and the
 * passphrase, can be identified by elimination in a single sitting.
 *
 * It renders only when the deployment is pointed at the sandbox, so it cannot
 * appear on a live merchant account, and only for an owner, because the page
 * that mounts it is already owner-only.
 */
export default function PayFastDiagnostic({
  action,
  probe,
  merchantId,
  sandbox,
}: {
  action: string;
  probe: SignatureProbe;
  merchantId: string;
  /** Alternative-signature test submissions are sandbox only. */
  sandbox: boolean;
}) {
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
            {sandbox
              ? "Sandbox. Nothing here is charged to anybody."
              : "Live merchant account. This panel only reads; it never submits anything. The merchant key and passphrase are shown as a shape, not a value."}
          </p>
        </div>
      </header>

      <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="font-bold">Posting to</dt>
        <dd className="font-mono break-all">{action}</dd>
        <dt className="font-bold">Merchant id</dt>
        <dd className="font-mono">{merchantId}</dd>
        <dt className="font-bold">Merchant key</dt>
        <dd className="font-mono">{probe.merchantKeyShape}</dd>
        <dt className="font-bold">Passphrase</dt>
        <dd className="font-mono">{probe.passphraseShape}</dd>
      </dl>

      <div>
        <p className="text-sm font-bold">
          The string the live button hashes
        </p>
        <pre className="mt-2 bg-white border border-[var(--brand-line)] rounded-md p-3 text-[11px] leading-relaxed whitespace-pre-wrap break-all font-mono">
          {probe.hashedString}
        </pre>
      </div>

      {!sandbox ? null : (
      <div className="space-y-3">
        <p className="text-sm font-bold">
          Open each in turn and write down the exact error
        </p>
        <p className="text-xs text-[var(--brand-slate)]">
          The wording matters more than whether it worked. A signature
          complaint, a merchant complaint and a field complaint are three
          different faults with three different fixes. Use a private window and
          do not sign in to the sandbox as the merchant.
        </p>

        {probe.variants.map((variant) => (
          <form
            key={variant.key}
            action={action}
            method="post"
            target="_blank"
            className="border border-[var(--brand-line)] bg-white rounded-md p-3"
          >
            {variant.fields.map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <input type="hidden" name="signature" value={variant.signature} />
            <button
              type="submit"
              className="text-sm font-bold underline hover:text-[var(--brand-red)] text-left"
            >
              {variant.key}. {variant.label}
            </button>
            <p className="text-xs text-[var(--brand-slate)] mt-1">
              {variant.explains}
            </p>
            <p className="text-[11px] font-mono text-[var(--brand-slate)] mt-1">
              {variant.fields.length} fields, signature {variant.signature}
            </p>
          </form>
        ))}
      </div>
      )}
    </section>
  );
}
