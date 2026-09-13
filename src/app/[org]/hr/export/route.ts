import type { NextRequest } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { isAdmin } from "@/lib/auth/roles";
import {
  getRegisterRows,
  listEmployees,
  getCompanyDocuments,
} from "@/lib/hr/queries";
import { idTypeLabel, countryLabel } from "@/lib/validation/identification";
import { companyCategoryLabel } from "@/lib/hr/company-documents";

export const dynamic = "force-dynamic";

type Dataset = "register" | "employees" | "documents";

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) lines.push(row.map(csvCell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
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

  const requested = request.nextUrl.searchParams.get("data");
  const dataset: Dataset =
    requested === "employees" || requested === "documents"
      ? requested
      : "register";

  let csv: string;

  if (dataset === "employees") {
    const employees = await listEmployees(ctx.org.id);
    csv = toCsv(
      [
        "Surname",
        "Names",
        "Document type",
        "Document number",
        "Issuing country",
        "Document expiry",
        "Certified on",
        "Site",
        "Superior",
        "Designation",
      ],
      employees.map((e) => [
        e.surname,
        e.names,
        idTypeLabel(e.id_type),
        e.id_number,
        countryLabel(e.id_country),
        e.id_expiry,
        e.id_certified_at,
        e.site,
        e.superior,
        e.designation,
      ]),
    );
  } else if (dataset === "documents") {
    const docs = await getCompanyDocuments(ctx.org.id);
    csv = toCsv(
      ["Category", "Title", "Issued", "Expires", "File on record"],
      docs.map((d) => [
        companyCategoryLabel(d.category),
        d.title,
        d.issued_at,
        d.expires_at,
        d.file_path ? "Yes" : "No",
      ]),
    );
  } else {
    const rows = await getRegisterRows(ctx.org.id, {});
    csv = toCsv(
      [
        "Surname",
        "Names",
        "Document type",
        "Document number",
        "Site",
        "Superior",
        "Training type",
        "Training date",
        "Expiry date",
        "Days left",
        "Status",
      ],
      rows.map((r) => [
        r.surname,
        r.names,
        idTypeLabel(r.id_type),
        r.id_number,
        r.site,
        r.superior,
        r.training_type,
        r.training_date,
        r.expiry_date,
        r.days_left,
        r.status,
      ]),
    );
  }

  const filename = `certly-${dataset}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
