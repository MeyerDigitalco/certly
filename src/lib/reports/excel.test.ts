import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import {
  buildWorkbook,
  xlsxResponse,
  type SheetSpec,
  type WorkbookSpec,
} from "./excel";

/**
 * buildWorkbook is the last step of every statutory export and had no test.
 * The report builders were well covered and stopped exactly where the bytes
 * get made, so a null reaching a numeric column, or two sheets colliding on a
 * truncated name, would have surfaced in a customer's download and nowhere
 * else.
 */

function sheet(over: Partial<SheetSpec> = {}): SheetSpec {
  return {
    name: "People",
    title: "People on the register",
    subtitle: "October 2026",
    columns: [
      { header: "Surname", key: "surname", width: 24 },
      { header: "Site", key: "site", width: 18 },
      { header: "Headcount", key: "headcount", width: 12, numFmt: "0" },
    ],
    rows: [
      { surname: "Nxumalo", site: "Shaft 1", headcount: 3 },
      { surname: "Botha", site: "Yard", headcount: 1 },
    ],
    ...over,
  };
}

function spec(over: Partial<WorkbookSpec> = {}): WorkbookSpec {
  return {
    organisation: "MDC",
    period: "2026-10",
    generatedBy: "owner@example.co.za",
    sheets: [sheet()],
    ...over,
  };
}

async function load(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  return wb;
}

describe("buildWorkbook", () => {
  it("produces a workbook a spreadsheet can open", async () => {
    const buffer = await buildWorkbook(spec());
    expect(buffer.length).toBeGreaterThan(2000);
    // Every xlsx is a zip, so the first two bytes are the local file header.
    expect(buffer.subarray(0, 2).toString("latin1")).toBe("PK");

    const wb = await load(buffer);
    expect(wb.worksheets).toHaveLength(1);
    expect(wb.getWorksheet("People")).toBeDefined();
  });

  it("writes every row, not only the first", async () => {
    const rows = Array.from({ length: 120 }, (_, i) => ({
      surname: `Person ${i}`,
      site: "Yard",
      headcount: i,
    }));
    const wb = await load(await buildWorkbook(spec({ sheets: [sheet({ rows })] })));
    const ws = wb.getWorksheet("People")!;

    const found = new Set<string>();
    ws.eachRow((row) => {
      for (const cell of (row.values as unknown[]).slice(1)) {
        if (typeof cell === "string" && cell.startsWith("Person ")) found.add(cell);
      }
    });
    expect(found.size).toBe(120);
  });

  it("survives nulls and undefined in a numeric column", async () => {
    const rows = [
      { surname: "Nxumalo", site: null, headcount: null },
      { surname: null, site: "Yard", headcount: undefined },
      { surname: undefined, site: undefined, headcount: 0 },
    ];
    const buffer = await buildWorkbook(spec({ sheets: [sheet({ rows })] }));
    expect(buffer.length).toBeGreaterThan(2000);
    await expect(load(buffer)).resolves.toBeDefined();
  });

  it("handles an empty sheet without producing a broken file", async () => {
    const buffer = await buildWorkbook(spec({ sheets: [sheet({ rows: [] })] }));
    const wb = await load(buffer);
    expect(wb.getWorksheet("People")).toBeDefined();
  });

  it("keeps sheets distinct when their names collide after truncation", async () => {
    // Excel caps a sheet name at 31 characters, so two long names that share
    // a prefix become the same name and the workbook is rejected on open.
    const a = sheet({ name: "Employment equity by occupational level" });
    const b = sheet({ name: "Employment equity by occupation group" });
    const wb = await load(await buildWorkbook(spec({ sheets: [a, b] })));

    expect(wb.worksheets).toHaveLength(2);
    const names = wb.worksheets.map((w) => w.name);
    expect(new Set(names).size).toBe(2);
    for (const name of names) {
      expect(name.length).toBeLessThanOrEqual(31);
      expect(name).not.toMatch(/[[\]*?/\\:]/);
    }
  });

  it("writes each sheet in a multi-sheet workbook", async () => {
    const sheets = ["One", "Two", "Three"].map((n) => sheet({ name: n }));
    const wb = await load(await buildWorkbook(spec({ sheets })));
    expect(wb.worksheets.map((w) => w.name)).toEqual(["One", "Two", "Three"]);
  });

  it("carries totals and notes through to the sheet", async () => {
    const s = sheet({
      totals: { surname: "Total", site: "", headcount: 4 },
      notes: ["Population group is the person's own EEA1 declaration."],
    });
    const wb = await load(await buildWorkbook(spec({ sheets: [s] })));
    const ws = wb.getWorksheet("People")!;

    let sawTotal = false;
    let sawNote = false;
    ws.eachRow((row) => {
      for (const cell of (row.values as unknown[]).slice(1)) {
        if (cell === "Total") sawTotal = true;
        if (typeof cell === "string" && cell.includes("EEA1")) sawNote = true;
      }
    });
    expect(sawTotal).toBe(true);
    expect(sawNote).toBe(true);
  });

  it("does not throw on text a spreadsheet treats specially", async () => {
    const rows = [
      { surname: "=cmd|'/c calc'!A1", site: "Shaft 1, North", headcount: 1 },
      { surname: 'He said "no"', site: "line\nbreak", headcount: 2 },
      { surname: "ǁKhoeǀ", site: "Yard", headcount: 3 },
    ];
    const buffer = await buildWorkbook(spec({ sheets: [sheet({ rows })] }));
    await expect(load(buffer)).resolves.toBeDefined();
  });
});

describe("xlsxResponse", () => {
  it("sends a downloadable spreadsheet that is never cached", async () => {
    const res = xlsxResponse(await buildWorkbook(spec()), "employment-equity.xlsx");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("spreadsheetml");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Content-Disposition")).toContain("employment-equity.xlsx");
  });

  it("strips a filename that could break the header or the filesystem", () => {
    const res = xlsxResponse(Buffer.from("x"), 'a"b;c/..\\d .xlsx');
    const disposition = res.headers.get("Content-Disposition") ?? "";
    expect(disposition).not.toContain('"a"b');
    expect(disposition).not.toContain("..\\");
    expect(disposition).not.toContain(";c/");
  });
});
