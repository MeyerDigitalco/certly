import type { NextRequest } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { isAdmin } from "@/lib/auth/roles";
import { buildSafetyFilePdf } from "@/lib/hr/safety-file-pdf";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function slugSegment(value: string, fallback: string): string {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  return cleaned.length > 0 ? cleaned : fallback;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ org: string }> },
) {
  const { org: slug } = await params;
  const ctx = await requireTenant(slug);

  if (!isAdmin(ctx.role)) {
    return new Response("Not found", { status: 404 });
  }

  const sp = request.nextUrl.searchParams;
  const client = (sp.get("client") ?? "Generic OHS Act").slice(0, 120);
  const site = sp.get("site")?.slice(0, 120) || undefined;
  const project = sp.get("project")?.slice(0, 120) || undefined;
  const includeIdentityDocuments = sp.get("ids") !== "0";

  try {
    const bytes = await buildSafetyFilePdf(ctx.org.id, {
      client,
      site,
      project,
      includeIdentityDocuments,
      organisationName: ctx.org.name,
      dueSoonDays: ctx.org.due_soon_days,
      compiledBy: ctx.userEmail,
    });

    const filename = `safety-file-${slugSegment(client, "client")}-${
      site ? slugSegment(site, "site") : "all-sites"
    }-${new Date().toISOString().slice(0, 10)}.pdf`;

    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The pack could not be built.";
    return new Response(`The safety file could not be built. ${message}`, {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
