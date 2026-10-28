import ExcelJS from "exceljs";

/**
 * One place that turns report data into a workbook, so every export carries
 * the same header styling, the same frozen title rows, the same number
 * formats, and the same footer that says which workspace and which month it
 * came from. A client who receives four Certly workbooks should not be able
 * to tell they were written by four different people.
 *
 * Charts are not written into the workbook. ExcelJS cannot author native
 * Excel charts, and embedding a rendered PNG needs a native rasteriser that is
 * unreliable on Vercel. The screen carries the charts; the workbook carries
 * the numbers under them, which is what anyone pasting into their own deck
 * actually wants.
 */

export type CellValue = string | number | null | undefined | Date;

export interface SheetColumn {
  header: string;
  key: string;
  width?: number;
  numFmt?: string;
  align?: "left" | "right" | "center";
}

export interface SheetSpec {
  name: string;
  title: string;
  subtitle?: string;
  columns: SheetColumn[];
  rows: Array<Record<string, CellValue>>;
  totals?: Record<string, CellValue>;
  notes?: string[];
}

export interface WorkbookSpec {
  organisation: string;
  period: string;
  generatedBy: string;
  sheets: SheetSpec[];
}

const INK = "FF161616";
const RED = "FFB91C1C";
const CREAM = "FFF5F1EA";
const LINE = "FFD9D2C7";
const WHITE = "FFFFFFFF";

/**
 * Excel caps a sheet name at 31 characters, forbids a handful of punctuation
 * marks, and compares names without regard to case. Truncating alone is not
 * enough: two names that differ only past the cap become the same name, and
 * ExcelJS throws rather than renaming, which loses the whole workbook instead
 * of one sheet title. Collisions are resolved here with a numeric suffix that
 * is itself kept inside the cap.
 */
function safeSheetName(name: string, taken: Set<string>): string {
  const base =
    name.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31).trim() || "Sheet";

  if (!taken.has(base.toLowerCase())) {
    taken.add(base.toLowerCase());
    return base;
  }

  for (let n = 2; n < 1000; n += 1) {
    const suffix = ` ${n}`;
    const candidate = `${base.slice(0, 31 - suffix.length).trim()}${suffix}`;
    if (!taken.has(candidate.toLowerCase())) {
      taken.add(candidate.toLowerCase());
      return candidate;
    }
  }

  const fallback = `Sheet ${taken.size + 1}`.slice(0, 31);
  taken.add(fallback.toLowerCase());
  return fallback;
}

export async function buildWorkbook(spec: WorkbookSpec): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Certly";
  wb.created = new Date();

  const takenSheetNames = new Set<string>();

  for (const sheet of spec.sheets) {
    const ws = wb.addWorksheet(safeSheetName(sheet.name, takenSheetNames), {
      views: [{ state: "frozen", ySplit: 4 }],
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
    });

    const colCount = Math.max(1, sheet.columns.length);

    ws.mergeCells(1, 1, 1, colCount);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = sheet.title;
    titleCell.font = { bold: true, size: 14, color: { argb: INK } };
    titleCell.alignment = { vertical: "middle" };
    ws.getRow(1).height = 24;

    ws.mergeCells(2, 1, 2, colCount);
    const subCell = ws.getCell(2, 1);
    subCell.value =
      [spec.organisation, spec.period, sheet.subtitle].filter(Boolean).join("  ·  ");
    subCell.font = { size: 10, color: { argb: "FF4B5563" } };

    ws.getRow(3).height = 6;

    ws.columns = sheet.columns.map((c) => ({
      key: c.key,
      width: c.width ?? Math.max(12, Math.min(48, c.header.length + 4)),
    }));

    const headerRow = ws.getRow(4);
    sheet.columns.forEach((c, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = c.header;
      cell.font = { bold: true, color: { argb: WHITE }, size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INK } };
      cell.alignment = {
        vertical: "middle",
        horizontal: c.align ?? (c.numFmt ? "right" : "left"),
        wrapText: true,
      };
      cell.border = { bottom: { style: "medium", color: { argb: RED } } };
    });
    headerRow.height = 30;

    for (const row of sheet.rows) {
      const r = ws.addRow(sheet.columns.map((c) => row[c.key] ?? null));
      sheet.columns.forEach((c, i) => {
        const cell = r.getCell(i + 1);
        if (c.numFmt) cell.numFmt = c.numFmt;
        cell.alignment = { horizontal: c.align ?? (c.numFmt ? "right" : "left") };
        cell.border = { bottom: { style: "hair", color: { argb: LINE } } };
      });
    }

    if (sheet.totals) {
      const r = ws.addRow(sheet.columns.map((c) => sheet.totals?.[c.key] ?? null));
      sheet.columns.forEach((c, i) => {
        const cell = r.getCell(i + 1);
        cell.font = { bold: true };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CREAM } };
        if (c.numFmt) cell.numFmt = c.numFmt;
        cell.alignment = { horizontal: c.align ?? (c.numFmt ? "right" : "left") };
        cell.border = { top: { style: "thin", color: { argb: INK } } };
      });
    }

    if (sheet.notes && sheet.notes.length > 0) {
      ws.addRow([]);
      for (const note of sheet.notes) {
        const r = ws.addRow([note]);
        ws.mergeCells(r.number, 1, r.number, colCount);
        r.getCell(1).font = { italic: true, size: 9, color: { argb: "FF6B7280" } };
        r.getCell(1).alignment = { wrapText: true };
      }
    }

    ws.addRow([]);
    const foot = ws.addRow([
      `Generated by Certly for ${spec.organisation} by ${spec.generatedBy} on ${new Date()
        .toISOString()
        .slice(0, 10)}. certly.co.za`,
    ]);
    ws.mergeCells(foot.number, 1, foot.number, colCount);
    foot.getCell(1).font = { size: 8, color: { argb: "FF9CA3AF" } };
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}

export function xlsxResponse(buffer: Buffer, filename: string): Response {
  const safe = filename.replace(/[^A-Za-z0-9._-]+/g, "-");
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(safe)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
