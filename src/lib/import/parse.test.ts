import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { detectColumns } from "./headers";
import { buildImportRecords, isSupportedSpreadsheetFileName, parseSpreadsheet } from "./parse";
import { SpreadsheetParseError } from "./types";

function workbookBuffer(rows: unknown[][]): Uint8Array {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, "Assets");
  return new Uint8Array(XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}

describe("isSupportedSpreadsheetFileName", () => {
  it("accepts .xlsx and .xls only", () => {
    expect(isSupportedSpreadsheetFileName("assets.xlsx")).toBe(true);
    expect(isSupportedSpreadsheetFileName("ASSETS.XLS")).toBe(true);
    expect(isSupportedSpreadsheetFileName("assets.csv")).toBe(false);
    expect(isSupportedSpreadsheetFileName("assets.pdf")).toBe(false);
  });
});

describe("parseSpreadsheet", () => {
  it("parses an xlsx workbook into raw rows", () => {
    const buffer = workbookBuffer([
      ["Asset ID", "Name", "Category", "Status"],
      ["LAP-001", "ThinkPad", "laptop", "deployed"],
    ]);
    const rows = parseSpreadsheet(buffer);
    expect(rows).toHaveLength(2);
    expect(rows[0].cells).toEqual(["Asset ID", "Name", "Category", "Status"]);
    expect(rows[1].cells).toEqual(["LAP-001", "ThinkPad", "laptop", "deployed"]);
  });

  it("parses CSV text", () => {
    const csv = "Asset ID,Name,Category,Status\nLAP-001,ThinkPad,laptop,deployed\n";
    const rows = parseSpreadsheet(csv);
    expect(rows).toHaveLength(2);
    expect(rows[1].cells[0]).toBe("LAP-001");
  });

  it("throws an empty error when the workbook has no usable rows", () => {
    const buffer = workbookBuffer([[""]]);
    expect(() => parseSpreadsheet(buffer)).toThrow(SpreadsheetParseError);
    try {
      parseSpreadsheet(buffer);
    } catch (error) {
      expect((error as SpreadsheetParseError).code).toBe("empty");
    }
  });

  it("throws a corrupted error for unreadable bytes", () => {
    const garbage = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
    expect(() => parseSpreadsheet(garbage)).toThrow(SpreadsheetParseError);
    try {
      parseSpreadsheet(garbage);
    } catch (error) {
      expect((error as SpreadsheetParseError).code).toBe("corrupted");
    }
  });
});

describe("buildImportRecords", () => {
  it("maps cells using detected columns and skips the header row", () => {
    const rows = parseSpreadsheet(
      workbookBuffer([
        ["Status", "Asset ID", "Asset Name", "Category", "Location"],
        ["deployed", "LAP-001", "ThinkPad", "laptop", "HQ"],
      ]),
    );
    const detection = detectColumns(rows[0].cells);
    const records = buildImportRecords(rows, detection);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      tag: "LAP-001",
      name: "ThinkPad",
      category: "laptop",
      status: "deployed",
      location: "HQ",
      rowNumber: 2,
    });
  });
});
