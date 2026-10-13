import * as XLSX from "xlsx";
import type { ColumnDetection, ImportRecordInput, RawRow } from "./types";
import { SpreadsheetParseError } from "./types";

const XLSX_EXTENSIONS = [".xlsx", ".xls"];

function looksLikeBinarySpreadsheet(bytes: Uint8Array): boolean {
  if (bytes.length < 4) {
    return false;
  }
  // ZIP local file header (xlsx) or OLE compound file (legacy xls).
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const isOle =
    bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
  return isZip || isOle;
}

export function isSupportedSpreadsheetFileName(name: string): boolean {
  const lower = (name ?? "").toLowerCase();
  return XLSX_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

function toRows(matrix: unknown[][]): RawRow[] {
  const rows: RawRow[] = [];
  matrix.forEach((cells, index) => {
    const normalised = (cells ?? []).map((cell) => String(cell ?? "").trim());
    // Drop trailing empty cells so column detection is not skewed by padding.
    while (normalised.length > 0 && normalised[normalised.length - 1] === "") {
      normalised.pop();
    }
    if (normalised.length === 0) {
      return;
    }
    rows.push({ rowNumber: index + 1, cells: normalised });
  });
  return rows;
}

/**
 * Parses an Excel workbook (.xlsx/.xls) or a CSV string into raw string rows.
 * Binary input must carry a ZIP (xlsx) or OLE (xls) signature — anything else
 * is rejected as corrupted rather than silently parsed as text.
 * Throws `SpreadsheetParseError` for unreadable or empty input.
 */
export function parseSpreadsheet(
  data: ArrayBuffer | Uint8Array | string,
): RawRow[] {
  let workbook: XLSX.WorkBook;
  if (typeof data === "string") {
    try {
      workbook = XLSX.read(data, { type: "string" });
    } catch {
      throw new SpreadsheetParseError("corrupted", "The file could not be read.");
    }
  } else {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    if (!looksLikeBinarySpreadsheet(bytes)) {
      throw new SpreadsheetParseError("corrupted", "The file could not be read.");
    }
    try {
      workbook = XLSX.read(bytes, { type: "array" });
    } catch {
      throw new SpreadsheetParseError("corrupted", "The file could not be read.");
    }
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new SpreadsheetParseError("empty", "The spreadsheet has no sheets.");
  }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new SpreadsheetParseError("empty", "The spreadsheet sheet is unreadable.");
  }

  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: true,
  }) as unknown[][];

  const rows = toRows(matrix);
  if (rows.length === 0) {
    throw new SpreadsheetParseError("empty", "The spreadsheet contains no rows.");
  }
  return rows;
}

/**
 * Maps raw rows onto asset fields using the detected column indexes.
 * The first row is treated as the header row.
 */
export function buildImportRecords(
  rows: RawRow[],
  detection: ColumnDetection,
): ImportRecordInput[] {
  const records: ImportRecordInput[] = [];
  for (const row of rows.slice(1)) {
    const read = (field: keyof typeof detection.mapping): string => {
      const index = detection.mapping[field];
      if (index === undefined) {
        return "";
      }
      return (row.cells[index] ?? "").trim();
    };
    const tag = read("tag");
    const name = read("name");
    const category = read("category");
    const status = read("status");
    const location = read("location") || null;
    records.push({ tag, name, category, status, location, rowNumber: row.rowNumber });
  }
  return records;
}
