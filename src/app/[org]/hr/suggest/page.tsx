import { requireTenant } from "@/lib/tenant";
import PageHeader from "@/components/app/PageHeader";
import SuggestForm from "./SuggestForm";

export const metadata = { title: "Suggest an improvement" };
export const dynamic = "force-dynamic";

export default async function SuggestPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org: slug } = await params;
  const ctx = await requireTenant(slug);

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="Suggestions"
        title="Tell us what is wrong with it"
        lede="Certly is built by one person, for contractors who do this work every day. If something is slower than it should be, missing, or just wrong, this goes straight to them. Every role can send one, viewers included."
      />

      <div className="bg-white border border-[var(--brand-line)] rounded-2xl p-6 max-w-2xl">
        <SuggestForm orgId={ctx.org.id} />
      </div>

      <div className="max-w-2xl text-sm text-[var(--brand-slate)] space-y-2">
        <p>
          <strong className="text-[var(--brand-ink)]">
            What is sent with it.
          </strong>{" "}
          Your email address, your workspace name, and the screen you were on
          when you wrote it. Nothing from your register: no employee names, no
          identity numbers, no documents.
        </p>
        <p>
          <strong className="text-[var(--brand-ink)]">
            If it is urgent and it is broken,
          </strong>{" "}
          do not use this. WhatsApp 082 097 6115, because a suggestion is read
          when there is time and a fault is not.
        </p>
      </div>
    </div>
  );
}
