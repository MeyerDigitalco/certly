import {
  PDFDocument,
  PDFFont,
  PDFPage,
  StandardFonts,
  degrees,
  rgb,
} from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import {
  getSafetyFileData,
  getCompanyDocuments,
  type SafetyFilePerson,
} from "@/lib/hr/queries";
import { companyCategoryLabel } from "@/lib/hr/company-documents";
import type { CompanyDocument } from "@/lib/types/database";
import { idTypeLabel, countryLabel } from "@/lib/validation/identification";
import { todayIso } from "@/lib/certifications/status";
import { certifiedCopyStatus } from "@/lib/hr/certified-copy";

/* eslint-disable @typescript-eslint/no-explicit-any */

const A4_W = 595.28;
const A4_H = 841.89;
const MARGIN = 34;
const INK = rgb(0.06, 0.09, 0.16);
const SLATE = rgb(0.36, 0.39, 0.45);
const RULE = rgb(0.81, 0.78, 0.72);
const RED = rgb(0.77, 0.12, 0.12);
const AMBER = rgb(0.55, 0.33, 0.02);
const GREEN = rgb(0.09, 0.44, 0.32);
const CREAM = rgb(0.96, 0.95, 0.92);

const MAX_EVIDENCE_BYTES = 60 * 1024 * 1024;

export interface SafetyFilePdfOptions {
  client: string;
  site?: string;
  project?: string;
  includeIdentityDocuments: boolean;
  organisationName: string;
  dueSoonDays: number;
  compiledBy: string;
}

interface EvidenceItem {
  person: string;
  label: string;
  kind: "identity" | "certification" | "company";
  bytes: Uint8Array | null;
  ext: string;
  pageCount: number;
  note: string | null;
}

/**
 * Strip anything the PDF standard fonts cannot encode.
 *
 * pdf-lib throws rather than substituting when a glyph is missing from
 * WinAnsi, so one Nama or Xhosa click character in a surname would fail the
 * whole pack. Diacritics are folded to their base letter, which keeps Afrikaans
 * and Portuguese names readable, and anything still unencodable becomes a
 * question mark rather than an exception.
 */
function safe(input: string | null | undefined): string {
  if (input === null || input === undefined) return "";
  const text = String(input);
  let out = "";
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code >= 32 && code <= 126) {
      out += char;
      continue;
    }
    if (code >= 160 && code <= 255) {
      out += char;
      continue;
    }
    const folded = char
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "");
    if (folded && folded.charCodeAt(0) >= 32 && folded.charCodeAt(0) <= 255) {
      out += folded;
    } else if (code === 9 || code === 10 || code === 13) {
      out += " ";
    } else {
      out += "?";
    }
  }
  return out;
}

function fitText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string {
  const clean = safe(text);
  if (font.widthOfTextAtSize(clean, size) <= maxWidth) return clean;
  let truncated = clean;
  while (
    truncated.length > 1 &&
    font.widthOfTextAtSize(`${truncated}...`, size) > maxWidth
  ) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}...`;
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const words = safe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}


function formatDay(iso: string | null): string {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

interface Ctx {
  pdf: PDFDocument;
  regular: PDFFont;
  bold: PDFFont;
  opts: SafetyFilePdfOptions;
}

function addPage(ctx: Ctx, landscape: boolean): PDFPage {
  return ctx.pdf.addPage(landscape ? [A4_H, A4_W] : [A4_W, A4_H]);
}

function sectionHeader(
  ctx: Ctx,
  page: PDFPage,
  number: string,
  title: string,
  y: number,
): number {
  const width = page.getWidth() - MARGIN * 2;
  const barHeight = 16;
  const numberWidth =
    ctx.bold.widthOfTextAtSize(safe(number), 8) + 14;

  page.drawRectangle({
    x: MARGIN,
    y: y - barHeight,
    width: numberWidth,
    height: barHeight,
    color: RED,
  });
  page.drawText(safe(number), {
    x: MARGIN + 7,
    y: y - barHeight + 5,
    size: 8,
    font: ctx.bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(safe(title.toUpperCase()), {
    x: MARGIN + numberWidth + 9,
    y: y - barHeight + 5,
    size: 8.5,
    font: ctx.bold,
    color: INK,
  });
  page.drawLine({
    start: { x: MARGIN, y: y + 1 },
    end: { x: MARGIN + width, y: y + 1 },
    thickness: 1,
    color: INK,
  });
  page.drawLine({
    start: { x: MARGIN, y: y - barHeight },
    end: { x: MARGIN + width, y: y - barHeight },
    thickness: 1,
    color: INK,
  });
  return y - barHeight - 16;
}

function drawCover(ctx: Ctx, totals: { people: number; records: number }): void {
  const page = addPage(ctx, false);
  const { opts } = ctx;
  let y = A4_H - MARGIN - 20;

  page.drawText(safe("CONTRACTOR SAFETY FILE"), {
    x: MARGIN,
    y,
    size: 9,
    font: ctx.bold,
    color: RED,
  });
  y -= 8;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: A4_W - MARGIN, y },
    thickness: 2,
    color: INK,
  });

  y -= 52;
  for (const line of wrapText(opts.organisationName, ctx.bold, 30, A4_W - MARGIN * 2)) {
    page.drawText(line, { x: MARGIN, y, size: 30, font: ctx.bold, color: INK });
    y -= 34;
  }

  y -= 10;
  page.drawText(safe("Employee and competency section"), {
    x: MARGIN,
    y,
    size: 12,
    font: ctx.regular,
    color: SLATE,
  });

  y -= 46;
  const rows: Array<[string, string]> = [
    ["Client", opts.client],
    ["Site", opts.site ?? "All sites"],
    ["Project", opts.project ?? "-"],
    ["Compiled on", formatDay(todayIso())],
    ["Compiled by", opts.compiledBy],
    ["People included", String(totals.people)],
    ["Certification records", String(totals.records)],
    [
      "Identity copies",
      opts.includeIdentityDocuments ? "Bound into this pack" : "Not included",
    ],
  ];

  for (const [label, value] of rows) {
    page.drawText(safe(label.toUpperCase()), {
      x: MARGIN,
      y,
      size: 7.5,
      font: ctx.bold,
      color: SLATE,
    });
    page.drawText(fitText(value, ctx.bold, 11, A4_W - MARGIN * 2 - 150), {
      x: MARGIN + 150,
      y: y - 1,
      size: 11,
      font: ctx.bold,
      color: INK,
    });
    y -= 13;
    page.drawLine({
      start: { x: MARGIN, y: y + 4 },
      end: { x: A4_W - MARGIN, y: y + 4 },
      thickness: 0.5,
      color: RULE,
    });
    y -= 11;
  }

  y = MARGIN + 150;
  page.drawLine({
    start: { x: MARGIN, y: y + 20 },
    end: { x: A4_W - MARGIN, y: y + 20 },
    thickness: 1,
    color: INK,
  });
  const disclaimer =
    "This section was compiled from the training register on the date shown and reflects the records held on that date. " +
    "It does not by itself constitute compliance with the Occupational Health and Safety Act 85 of 1993, the Mine Health " +
    "and Safety Act 29 of 1996, or any client standard. It does not replace the statutory appointments, the hazard " +
    "identification and risk assessment, the method statement, or any other document that completes a safety file. " +
    "It must be reviewed and signed by the appointed person before submission.";
  let dy = y;
  for (const line of wrapText(disclaimer, ctx.regular, 7.5, A4_W - MARGIN * 2)) {
    page.drawText(line, { x: MARGIN, y: dy, size: 7.5, font: ctx.regular, color: SLATE });
    dy -= 10;
  }
}

function drawCompanyDocuments(ctx: Ctx, docs: CompanyDocument[]): void {
  const page = addPage(ctx, false);
  let y = A4_H - MARGIN - 14;
  y = sectionHeader(ctx, page, "01-09", "Company documents", y);

  if (docs.length === 0) {
    page.drawText(
      safe(
        "No company documents are on file. Policies, registration, the letter of good standing and public liability are still to be attached by hand.",
      ),
      { x: MARGIN, y, size: 8.5, font: ctx.regular, color: AMBER },
    );
    return;
  }

  const today = todayIso();
  const columns: Array<{ label: string; width: number }> = [
    { label: "Category", width: 130 },
    { label: "Title", width: 200 },
    { label: "Issued", width: 62 },
    { label: "Expires", width: 62 },
    { label: "Bound", width: 60 },
  ];

  let x = MARGIN;
  page.drawRectangle({
    x: MARGIN,
    y: y - 14,
    width: A4_W - MARGIN * 2,
    height: 14,
    color: CREAM,
  });
  for (const col of columns) {
    page.drawText(safe(col.label.toUpperCase()), {
      x: x + 2,
      y: y - 10,
      size: 6.5,
      font: ctx.bold,
      color: SLATE,
    });
    x += col.width;
  }
  y -= 14;

  for (const doc of docs) {
    const lapsed = doc.expires_at !== null && doc.expires_at < today;
    const values = [
      companyCategoryLabel(doc.category),
      doc.title,
      formatDay(doc.issued_at),
      formatDay(doc.expires_at),
      doc.file_path ? "Yes" : "No",
    ];
    x = MARGIN;
    values.forEach((value, i) => {
      page.drawText(fitText(value, ctx.regular, 7.5, columns[i].width - 4), {
        x: x + 2,
        y: y - 10,
        size: 7.5,
        font: i === 1 ? ctx.bold : ctx.regular,
        color: lapsed && i === 3 ? RED : INK,
      });
      x += columns[i].width;
    });
    y -= 14;
    page.drawLine({
      start: { x: MARGIN, y: y + 2 },
      end: { x: A4_W - MARGIN, y: y + 2 },
      thickness: 0.4,
      color: RULE,
    });
  }

  const lapsedCount = docs.filter(
    (d) => d.expires_at !== null && d.expires_at < today,
  ).length;
  if (lapsedCount > 0) {
    y -= 14;
    page.drawText(
      safe(
        `${lapsedCount} company document${lapsedCount === 1 ? " has" : "s have"} expired. A lapsed letter of good standing fails a pack on its own.`,
      ),
      { x: MARGIN, y, size: 8, font: ctx.bold, color: RED },
    );
  }
}

function drawEmployeeList(ctx: Ctx, people: SafetyFilePerson[]): void {
  const columns: Array<{ label: string; width: number; get: (p: SafetyFilePerson, i: number) => string }> = [
    { label: "#", width: 22, get: (_p, i) => String(i + 1) },
    { label: "Surname", width: 96, get: (p) => p.surname },
    { label: "Names", width: 96, get: (p) => p.names },
    { label: "Document", width: 88, get: (p) => idTypeLabel(p.id_type) },
    { label: "Number", width: 96, get: (p) => p.id_number },
    { label: "Country", width: 74, get: (p) => countryLabel(p.id_country) || "-" },
    { label: "Doc expiry", width: 62, get: (p) => formatDay(p.id_expiry) },
    { label: "Designation", width: 100, get: (p) => p.designation ?? "-" },
    { label: "Site", width: 86, get: (p) => p.site ?? "-" },
    { label: "ID copy", width: 52, get: (p) => (p.id_file_path ? "Yes" : "No") },
  ];

  const rowHeight = 14;
  let page = addPage(ctx, true);
  let y = A4_W - MARGIN - 14;
  y = sectionHeader(ctx, page, "11", "List of employees on this project", y);

  function header(): void {
    let x = MARGIN;
    page.drawRectangle({
      x: MARGIN,
      y: y - rowHeight + 3,
      width: A4_H - MARGIN * 2,
      height: rowHeight,
      color: CREAM,
    });
    for (const col of columns) {
      page.drawText(fitText(col.label.toUpperCase(), ctx.bold, 6.5, col.width - 4), {
        x: x + 2,
        y: y - rowHeight + 8,
        size: 6.5,
        font: ctx.bold,
        color: SLATE,
      });
      x += col.width;
    }
    y -= rowHeight;
  }

  header();

  people.forEach((p, index) => {
    if (y < MARGIN + 30) {
      page = addPage(ctx, true);
      y = A4_W - MARGIN - 14;
      y = sectionHeader(ctx, page, "11", "List of employees, continued", y);
      header();
    }
    let x = MARGIN;
    for (const col of columns) {
      page.drawText(fitText(col.get(p, index), ctx.regular, 7.5, col.width - 4), {
        x: x + 2,
        y: y - 10,
        size: 7.5,
        font: col.label === "Surname" ? ctx.bold : ctx.regular,
        color: INK,
      });
      x += col.width;
    }
    y -= rowHeight;
    page.drawLine({
      start: { x: MARGIN, y: y + 2 },
      end: { x: A4_H - MARGIN, y: y + 2 },
      thickness: 0.4,
      color: RULE,
    });
  });
}

function drawMatrix(
  ctx: Ctx,
  people: SafetyFilePerson[],
  columns: Array<{ id: string; name: string }>,
): void {
  if (columns.length === 0) {
    const page = addPage(ctx, false);
    let y = A4_H - MARGIN - 14;
    y = sectionHeader(ctx, page, "24 / 25 / 28", "Certificates of competency", y);
    page.drawText(safe("No certification records for this selection."), {
      x: MARGIN,
      y,
      size: 9,
      font: ctx.regular,
      color: SLATE,
    });
    return;
  }

  const nameWidth = 130;
  const colWidth = 24;
  const usable = A4_H - MARGIN * 2 - nameWidth;
  const perPage = Math.max(1, Math.floor(usable / colWidth));
  const chunks: Array<Array<{ id: string; name: string }>> = [];
  for (let i = 0; i < columns.length; i += perPage) {
    chunks.push(columns.slice(i, i + perPage));
  }

  const headerHeight = 104;
  const rowHeight = 13;

  chunks.forEach((chunk, chunkIndex) => {
    let page = addPage(ctx, true);
    let y = A4_W - MARGIN - 14;
    y = sectionHeader(
      ctx,
      page,
      "24 / 25 / 28",
      chunks.length > 1
        ? `Competency matrix, sheet ${chunkIndex + 1} of ${chunks.length}`
        : "Certificates of competency, medical fitness and training",
      y,
    );

    function header(): void {
      page.drawText(safe("EMPLOYEE"), {
        x: MARGIN + 2,
        y: y - headerHeight + 6,
        size: 6.5,
        font: ctx.bold,
        color: SLATE,
      });
      chunk.forEach((col, i) => {
        const x = MARGIN + nameWidth + i * colWidth;
        page.drawText(fitText(col.name.toUpperCase(), ctx.bold, 6, headerHeight - 12), {
          x: x + colWidth / 2 + 2,
          y: y - headerHeight + 6,
          size: 6,
          font: ctx.bold,
          color: INK,
          rotate: degrees(90),
        });
        page.drawLine({
          start: { x, y: y - headerHeight },
          end: { x, y: MARGIN },
          thickness: 0.3,
          color: RULE,
        });
      });
      y -= headerHeight;
      page.drawLine({
        start: { x: MARGIN, y: y + 2 },
        end: { x: A4_H - MARGIN, y: y + 2 },
        thickness: 1,
        color: INK,
      });
    }

    header();

    for (const p of people) {
      if (y < MARGIN + 24) {
        page = addPage(ctx, true);
        y = A4_W - MARGIN - 14;
        y = sectionHeader(ctx, page, "24 / 25 / 28", "Competency matrix, continued", y);
        header();
      }
      page.drawText(
        fitText(`${p.surname}, ${p.names.charAt(0)}.`, ctx.bold, 7, nameWidth - 6),
        { x: MARGIN + 2, y: y - 9, size: 7, font: ctx.bold, color: INK },
      );
      chunk.forEach((col, i) => {
        const cert = p.certs[col.id];
        const x = MARGIN + nameWidth + i * colWidth;
        if (!cert) {
          page.drawText("-", {
            x: x + colWidth / 2 - 2,
            y: y - 9,
            size: 6.5,
            font: ctx.regular,
            color: RULE,
          });
          return;
        }
        const colour =
          cert.status === "expired"
            ? RED
            : cert.status === "due_soon"
              ? AMBER
              : GREEN;
        const label = cert.expiry_date
          ? cert.expiry_date.slice(2).replace(/-/g, "")
          : "n/a";
        page.drawText(label, {
          x: x + 2,
          y: y - 9,
          size: 6,
          font: ctx.bold,
          color: colour,
        });
      });
      y -= rowHeight;
      page.drawLine({
        start: { x: MARGIN, y: y + 2 },
        end: { x: A4_H - MARGIN, y: y + 2 },
        thickness: 0.3,
        color: RULE,
      });
    }

    page.drawText(
      safe(
        `Cells show the expiry date as YYMMDD. Red is expired, amber is due within ${ctx.opts.dueSoonDays} days, green is valid, n/a means the training does not expire, a dash means no record held.`,
      ),
      { x: MARGIN, y: MARGIN - 6, size: 6.5, font: ctx.regular, color: SLATE },
    );
  });
}

function drawOutstanding(
  ctx: Ctx,
  people: SafetyFilePerson[],
  columns: Array<{ id: string; name: string }>,
): void {
  const items: Array<{ person: string; item: string; note: string }> = [];
  for (const p of people) {
    for (const col of columns) {
      const cert = p.certs[col.id];
      if (cert && cert.status === "expired") {
        items.push({
          person: `${p.surname}, ${p.names}`,
          item: col.name,
          note: `expired ${formatDay(cert.expiry_date)}`,
        });
      }
    }
    if (p.id_expiry && p.id_expiry < todayIso()) {
      items.push({
        person: `${p.surname}, ${p.names}`,
        item: idTypeLabel(p.id_type),
        note: `expired ${formatDay(p.id_expiry)}`,
      });
    }
    // A certified copy older than three months is rejected at the client's
    // desk as readily as a lapsed ticket is at the gate, and it is the
    // failure nobody sees coming, because the document itself is still valid.
    const copy = certifiedCopyStatus(
      p.id_certified_at,
      Boolean(p.id_file_path),
    );
    if (p.id_file_path && copy.state === "stale") {
      items.push({
        person: `${p.surname}, ${p.names}`,
        item: `Certified copy of ${idTypeLabel(p.id_type).toLowerCase()}`,
        note: `certified ${formatDay(p.id_certified_at)}`,
      });
    }
  }

  let page = addPage(ctx, false);
  let y = A4_H - MARGIN - 14;
  y = sectionHeader(ctx, page, "OUT", "Outstanding items", y);

  if (items.length === 0) {
    page.drawText(
      safe("Nothing expired in this selection on the date of compiling."),
      { x: MARGIN, y, size: 9, font: ctx.regular, color: INK },
    );
  } else {
    page.drawText(
      safe(
        `${items.length} item${items.length === 1 ? "" : "s"} had lapsed when this pack was compiled. Each one is a person who cannot pass a gate check today.`,
      ),
      { x: MARGIN, y, size: 8.5, font: ctx.regular, color: RED },
    );
    y -= 20;
    for (const item of items) {
      if (y < MARGIN + 20) {
        page = addPage(ctx, false);
        y = A4_H - MARGIN - 14;
        y = sectionHeader(ctx, page, "OUT", "Outstanding items, continued", y);
      }
      page.drawText(fitText(item.person, ctx.bold, 8, 190), {
        x: MARGIN,
        y,
        size: 8,
        font: ctx.bold,
        color: INK,
      });
      page.drawText(fitText(item.item, ctx.regular, 8, 220), {
        x: MARGIN + 200,
        y,
        size: 8,
        font: ctx.regular,
        color: INK,
      });
      page.drawText(fitText(item.note, ctx.bold, 8, 100), {
        x: A4_W - MARGIN - 100,
        y,
        size: 8,
        font: ctx.bold,
        color: RED,
      });
      y -= 13;
      page.drawLine({
        start: { x: MARGIN, y: y + 4 },
        end: { x: A4_W - MARGIN, y: y + 4 },
        thickness: 0.4,
        color: RULE,
      });
      y -= 4;
    }
  }

  y -= 40;
  if (y < MARGIN + 120) {
    page = addPage(ctx, false);
    y = A4_H - MARGIN - 40;
  }
  y = sectionHeader(ctx, page, "DEC", "Declaration and signature", y);

  const declaration =
    "I confirm that I have reviewed the employee records in this section, that they reflect the training and " +
    "identification records held by this contractor, and that any outstanding items listed above have been " +
    "addressed or disclosed to the client before submission.";
  for (const line of wrapText(declaration, ctx.regular, 8.5, A4_W - MARGIN * 2)) {
    page.drawText(line, { x: MARGIN, y, size: 8.5, font: ctx.regular, color: INK });
    y -= 12;
  }

  y -= 48;
  const half = (A4_W - MARGIN * 2 - 30) / 2;
  for (const [i, label] of [
    "Appointed person, full name and signature",
    "Date",
  ].entries()) {
    const x = MARGIN + i * (half + 30);
    page.drawLine({
      start: { x, y },
      end: { x: x + half, y },
      thickness: 1,
      color: INK,
    });
    page.drawText(safe(label.toUpperCase()), {
      x,
      y: y - 11,
      size: 6.5,
      font: ctx.bold,
      color: SLATE,
    });
  }
}

async function collectEvidence(
  people: SafetyFilePerson[],
  columns: Array<{ id: string; name: string }>,
  companyDocs: CompanyDocument[],
  opts: SafetyFilePdfOptions,
): Promise<EvidenceItem[]> {
  const supabase: any = await createClient();
  const items: EvidenceItem[] = [];
  let budget = MAX_EVIDENCE_BYTES;

  async function pull(
    bucket: string,
    path: string,
    person: string,
    label: string,
    kind: EvidenceItem["kind"],
  ): Promise<void> {
    const ext = (path.split(".").pop() ?? "").toLowerCase();
    const base: EvidenceItem = {
      person,
      label,
      kind,
      bytes: null,
      ext,
      pageCount: 1,
      note: null,
    };

    if (!["pdf", "jpg", "jpeg", "png"].includes(ext)) {
      items.push({
        ...base,
        note:
          ext === "doc" || ext === "docx"
            ? "Word document, cannot be bound into a PDF. Attach it separately."
            : `File type .${ext} cannot be bound into a PDF. Attach it separately.`,
      });
      return;
    }

    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error || !data) {
      items.push({ ...base, note: "The stored file could not be read." });
      return;
    }
    const bytes = new Uint8Array(await data.arrayBuffer());
    if (bytes.byteLength > budget) {
      items.push({ ...base, note: "Skipped, the pack reached its size limit." });
      return;
    }
    budget -= bytes.byteLength;

    let pageCount = 1;
    if (ext === "pdf") {
      try {
        const probe = await PDFDocument.load(bytes, { ignoreEncryption: true });
        pageCount = probe.getPageCount();
      } catch {
        items.push({ ...base, note: "The PDF could not be opened." });
        return;
      }
    }
    items.push({ ...base, bytes, pageCount });
  }

  for (const doc of companyDocs) {
    if (!doc.file_path) continue;
    await pull(
      "company-documents",
      doc.file_path,
      companyCategoryLabel(doc.category),
      doc.title,
      "company",
    );
  }

  for (const p of people) {
    const person = `${p.surname}, ${p.names}`;
    if (opts.includeIdentityDocuments && p.id_file_path) {
      await pull(
        "identity-documents",
        p.id_file_path,
        person,
        idTypeLabel(p.id_type),
        "identity",
      );
    }
    for (const col of columns) {
      const cert = p.certs[col.id];
      if (!cert?.cert_file_path) continue;
      await pull("certificates", cert.cert_file_path, person, col.name, "certification");
    }
  }

  return items;
}

function drawEvidenceIndex(
  ctx: Ctx,
  items: EvidenceItem[],
  startPage: number,
  indexPages: number,
): void {
  const rowsPerPage = 32;
  let cursor = startPage + indexPages;
  let itemIndex = 0;

  for (let sheet = 0; sheet < indexPages; sheet += 1) {
    const page = addPage(ctx, false);
    let y = A4_H - MARGIN - 14;
    y = sectionHeader(
      ctx,
      page,
      "EVD",
      sheet === 0 ? "Evidence index" : "Evidence index, continued",
      y,
    );
    if (sheet === 0) {
      page.drawText(
        safe(
          "Documents bound into this pack, in order. Page numbers refer to this file.",
        ),
        { x: MARGIN, y, size: 8, font: ctx.regular, color: SLATE },
      );
      y -= 18;
    }

    for (let row = 0; row < rowsPerPage && itemIndex < items.length; row += 1) {
      const item = items[itemIndex];
      page.drawText(fitText(item.person, ctx.bold, 8, 180), {
        x: MARGIN,
        y,
        size: 8,
        font: ctx.bold,
        color: INK,
      });
      page.drawText(fitText(item.label, ctx.regular, 8, 170), {
        x: MARGIN + 190,
        y,
        size: 8,
        font: ctx.regular,
        color: INK,
      });
      if (item.bytes) {
        page.drawText(safe(`page ${cursor}`), {
          x: A4_W - MARGIN - 60,
          y,
          size: 8,
          font: ctx.bold,
          color: INK,
        });
        cursor += item.pageCount;
      } else {
        page.drawText(safe("not bound"), {
          x: A4_W - MARGIN - 60,
          y,
          size: 8,
          font: ctx.bold,
          color: AMBER,
        });
        cursor += 1;
      }
      y -= 12;
      page.drawLine({
        start: { x: MARGIN, y: y + 4 },
        end: { x: A4_W - MARGIN, y: y + 4 },
        thickness: 0.4,
        color: RULE,
      });
      itemIndex += 1;
    }
  }
}

async function appendEvidence(ctx: Ctx, items: EvidenceItem[]): Promise<void> {
  for (const item of items) {
    if (!item.bytes) {
      const page = addPage(ctx, false);
      let y = A4_H - MARGIN - 14;
      y = sectionHeader(ctx, page, "EVD", "Attachment not bound", y);
      page.drawText(fitText(item.person, ctx.bold, 13, A4_W - MARGIN * 2), {
        x: MARGIN,
        y,
        size: 13,
        font: ctx.bold,
        color: INK,
      });
      y -= 18;
      page.drawText(fitText(item.label, ctx.regular, 10, A4_W - MARGIN * 2), {
        x: MARGIN,
        y,
        size: 10,
        font: ctx.regular,
        color: SLATE,
      });
      y -= 24;
      for (const line of wrapText(
        item.note ?? "This document could not be included.",
        ctx.regular,
        9,
        A4_W - MARGIN * 2,
      )) {
        page.drawText(line, { x: MARGIN, y, size: 9, font: ctx.regular, color: AMBER });
        y -= 12;
      }
      continue;
    }

    if (item.ext === "pdf") {
      try {
        const source = await PDFDocument.load(item.bytes, { ignoreEncryption: true });
        const copied = await ctx.pdf.copyPages(source, source.getPageIndices());
        for (const page of copied) ctx.pdf.addPage(page);
      } catch {
        const page = addPage(ctx, false);
        const y = sectionHeader(ctx, page, "EVD", "Attachment failed to bind", A4_H - MARGIN - 14);
        page.drawText(fitText(`${item.person} - ${item.label}`, ctx.bold, 11, A4_W - MARGIN * 2), {
          x: MARGIN,
          y,
          size: 11,
          font: ctx.bold,
          color: INK,
        });
      }
      continue;
    }

    const page = addPage(ctx, false);
    try {
      const image =
        item.ext === "png"
          ? await ctx.pdf.embedPng(item.bytes)
          : await ctx.pdf.embedJpg(item.bytes);
      const maxW = A4_W - MARGIN * 2;
      const maxH = A4_H - MARGIN * 2 - 30;
      const scale = Math.min(maxW / image.width, maxH / image.height, 1);
      const w = image.width * scale;
      const h = image.height * scale;
      page.drawImage(image, {
        x: (A4_W - w) / 2,
        y: (A4_H - h) / 2 - 10,
        width: w,
        height: h,
      });
      page.drawText(fitText(`${item.person} - ${item.label}`, ctx.bold, 8, maxW), {
        x: MARGIN,
        y: A4_H - MARGIN - 8,
        size: 8,
        font: ctx.bold,
        color: SLATE,
      });
    } catch {
      page.drawText(safe("The image could not be embedded."), {
        x: MARGIN,
        y: A4_H / 2,
        size: 10,
        font: ctx.regular,
        color: AMBER,
      });
    }
  }
}

function stampFooters(ctx: Ctx): void {
  const pages = ctx.pdf.getPages();
  const total = pages.length;
  const stamp = safe(
    `${ctx.opts.organisationName} | ${ctx.opts.client} | compiled ${formatDay(todayIso())}`,
  );
  pages.forEach((page, index) => {
    const width = page.getWidth();
    page.drawLine({
      start: { x: MARGIN, y: 22 },
      end: { x: width - MARGIN, y: 22 },
      thickness: 0.4,
      color: RULE,
    });
    page.drawText(fitText(stamp, ctx.regular, 6.5, width - MARGIN * 2 - 70), {
      x: MARGIN,
      y: 13,
      size: 6.5,
      font: ctx.regular,
      color: SLATE,
    });
    page.drawText(safe(`Page ${index + 1} of ${total}`), {
      x: width - MARGIN - 62,
      y: 13,
      size: 6.5,
      font: ctx.bold,
      color: SLATE,
    });
  });
}

/**
 * Build the whole pack as a single PDF: cover, employee list, competency
 * matrix, outstanding items, declaration, an evidence index with real page
 * numbers, and every bindable attachment appended behind it.
 *
 * The evidence is collected before anything is drawn so the index can carry
 * correct page numbers on the first pass, rather than being inserted afterwards
 * and shifting everything behind it.
 */
export async function buildSafetyFilePdf(
  orgId: string,
  opts: SafetyFilePdfOptions,
): Promise<Uint8Array> {
  const data = await getSafetyFileData(orgId, {
    site: opts.site,
    dueSoonDays: opts.dueSoonDays,
  });

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Safety file - ${opts.organisationName} - ${opts.client}`);
  pdf.setProducer("Certly");
  pdf.setCreator("Certly");
  pdf.setCreationDate(new Date());

  const ctx: Ctx = {
    pdf,
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    opts,
  };

  const companyDocs = await getCompanyDocuments(orgId);
  const evidence = await collectEvidence(
    data.people,
    data.columns,
    companyDocs,
    opts,
  );

  drawCover(ctx, data.totals);
  drawCompanyDocuments(ctx, companyDocs);
  drawEmployeeList(ctx, data.people);
  drawMatrix(ctx, data.people, data.columns);
  drawOutstanding(ctx, data.people, data.columns);

  if (evidence.length > 0) {
    const indexPages = Math.max(1, Math.ceil(evidence.length / 32));
    const startPage = pdf.getPageCount() + 1;
    drawEvidenceIndex(ctx, evidence, startPage, indexPages);
    await appendEvidence(ctx, evidence);
  }

  stampFooters(ctx);
  return pdf.save();
}
