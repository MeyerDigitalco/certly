import type { NextRequest } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { getCertification, getEmployee } from "@/lib/hr/queries";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Streams a certificate attachment through the app rather than handing the
// browser a storage URL. The certification is looked up under the workspace
// filter first, so an id from another workspace is a 404 here even before the
// storage policy gets a say. The signed URL is short-lived and never leaves
// the server.

export const dynamic = "force-dynamic";

const CERT_BUCKET = "certificates";
const SIGNED_URL_SECONDS = 60;

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
};

/** Reduce a name to something safe for a Content-Disposition filename. */
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
  { params }: { params: Promise<{ org: string; id: string }> },
) {
  const { org: slug, id } = await params;
  const ctx = await requireTenant(slug);

  const certification = await getCertification(ctx.org.id, id);
  if (!certification || !certification.cert_file_path) {
    return new Response("Not found", { status: 404 });
  }

  const supabase: any = await createClient();
  const { data: signed, error: signError } = await supabase.storage
    .from(CERT_BUCKET)
    .createSignedUrl(certification.cert_file_path, SIGNED_URL_SECONDS);
  if (signError || !signed?.signedUrl) {
    return new Response("Not found", { status: 404 });
  }

  const upstream = await fetch(signed.signedUrl);
  if (!upstream.ok || !upstream.body) {
    return new Response("Not found", { status: 404 });
  }

  const ext = (certification.cert_file_path.split(".").pop() ?? "").toLowerCase();
  const contentType =
    CONTENT_TYPES[ext] ??
    upstream.headers.get("content-type") ??
    "application/octet-stream";

  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);

  if (request.nextUrl.searchParams.get("download") === "1") {
    const [employee, typeName] = await Promise.all([
      getEmployee(ctx.org.id, certification.employee_id),
      trainingTypeName(ctx.org.id, certification.training_type_id),
    ]);
    const person = employee
      ? slugSegment(`${employee.surname} ${employee.names}`, "employee")
      : "employee";
    const training = slugSegment(typeName, "certificate");
    const filename = ext
      ? `${person}-${training}.${ext}`
      : `${person}-${training}`;
    headers.set(
      "Content-Disposition",
      `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
  } else {
    headers.set("Content-Disposition", "inline");
  }

  return new Response(upstream.body, { status: 200, headers });
}

/** Training type name, scoped to the workspace. Empty string if not found. */
async function trainingTypeName(orgId: string, id: string): Promise<string> {
  const supabase: any = await createClient();
  const { data } = await supabase
    .from("training_types")
    .select("name")
    .eq("organisation_id", orgId)
    .eq("id", id)
    .maybeSingle();
  return (data?.name as string | undefined) ?? "";
}
