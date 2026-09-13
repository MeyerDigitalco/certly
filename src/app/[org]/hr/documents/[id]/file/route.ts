import type { NextRequest } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { getCompanyDocument } from "@/lib/hr/queries";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const dynamic = "force-dynamic";

const COMPANY_BUCKET = "company-documents";
const SIGNED_URL_SECONDS = 60;

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

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

  const doc = await getCompanyDocument(ctx.org.id, id);
  if (!doc || !doc.file_path) {
    return new Response("Not found", { status: 404 });
  }

  const supabase: any = await createClient();
  const { data: signed, error: signError } = await supabase.storage
    .from(COMPANY_BUCKET)
    .createSignedUrl(doc.file_path, SIGNED_URL_SECONDS);
  if (signError || !signed?.signedUrl) {
    return new Response("Not found", { status: 404 });
  }

  const upstream = await fetch(signed.signedUrl);
  if (!upstream.ok || !upstream.body) {
    return new Response("Not found", { status: 404 });
  }

  const ext = (doc.file_path.split(".").pop() ?? "").toLowerCase();
  const headers = new Headers();
  headers.set(
    "Content-Type",
    CONTENT_TYPES[ext] ??
      upstream.headers.get("content-type") ??
      "application/octet-stream",
  );
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);

  if (request.nextUrl.searchParams.get("download") === "1") {
    const filename = ext
      ? `${slugSegment(doc.title, "document")}.${ext}`
      : slugSegment(doc.title, "document");
    headers.set(
      "Content-Disposition",
      `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
  } else {
    headers.set("Content-Disposition", "inline");
  }

  return new Response(upstream.body, { status: 200, headers });
}
