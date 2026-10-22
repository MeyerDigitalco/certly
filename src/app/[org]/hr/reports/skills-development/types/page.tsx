import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import PageHeader from "@/components/app/PageHeader";
import { isAdmin } from "@/lib/auth/roles";
import { getTrainingTypesForReports } from "@/lib/reports/data";
import TrainingTypeDetails from "./TrainingTypeDetails";

export const metadata = { title: "Course details" };
export const dynamic = "force-dynamic";

export default async function TrainingTypesPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org: slug } = await params;
  const ctx = await requireTenant(slug);
  if (!isAdmin(ctx.role)) notFound();

  const types = await getTrainingTypesForReports(ctx.org.id);
  const ordered = [...types].sort(
    (a, b) =>
      Number(b.active) - Number(a.active) ||
      a.sort_order - b.sort_order ||
      a.name.localeCompare(b.name),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Skills development"
        title="Course details"
        lede={
          <>
          What the SETA asks about each course: category, hours, cost per person, provider,
          NQF level and accreditation. Each change saves on its own as you make it. Untick
          counts for ATR on site inductions and anything else that is not training in the
          SETA sense, so it stays out of the Annual Training Report.
          </>
        }
        back={{ href: `/${slug}/hr/reports/skills-development`, label: "Back to report" }}
      />

      <TrainingTypeDetails orgId={ctx.org.id} slug={slug} types={ordered} />
    </div>
  );
}
