import { describe, expect, it } from "vitest";
import { parseGoogleSheetUrl } from "./sheet";

describe("parseGoogleSheetUrl", () => {
  it("parses a standard edit URL", () => {
    const target = parseGoogleSheetUrl(
      "https://docs.google.com/spreadsheets/d/1AbCDeFgHiJkLmNoPqRsTuVwXyZ1234567890/edit?gid=42#gid=42",
    );
    expect(target).not.toBeNull();
    expect(target?.sheetId).toBe("1AbCDeFgHiJkLmNoPqRsTuVwXyZ1234567890");
    expect(target?.gid).toBe("42");
    expect(target?.csvUrl).toBe(
      "https://docs.google.com/spreadsheets/d/1AbCDeFgHiJkLmNoPqRsTuVwXyZ1234567890/export?format=csv&gid=42",
    );
  });

  it("parses a published /d/e/ URL", () => {
    const target = parseGoogleSheetUrl(
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vExamplePubId/pubhtml",
    );
    expect(target).not.toBeNull();
    expect(target?.sheetId).toBe("2PACX-1vExamplePubId");
    expect(target?.csvUrl).toContain("/d/e/2PACX-1vExamplePubId/export?format=csv");
  });

  it("defaults gid to 0 when absent", () => {
    const target = parseGoogleSheetUrl("https://docs.google.com/spreadsheets/d/abc123/edit");
    expect(target?.gid).toBe("0");
  });

  it("rejects non-Google hosts", () => {
    expect(parseGoogleSheetUrl("https://example.com/spreadsheets/d/abc/edit")).toBeNull();
    expect(parseGoogleSheetUrl("https://evil.com/?url=docs.google.com/spreadsheets/d/abc")).toBeNull();
  });

  it("rejects Google URLs without a sheet id", () => {
    expect(parseGoogleSheetUrl("https://docs.google.com/spreadsheets/u/0/")).toBeNull();
    expect(parseGoogleSheetUrl("https://docs.google.com/document/d/abc/edit")).toBeNull();
  });

  it("rejects malformed or empty input", () => {
    expect(parseGoogleSheetUrl("")).toBeNull();
    expect(parseGoogleSheetUrl("not a url")).toBeNull();
    expect(parseGoogleSheetUrl("   ")).toBeNull();
    expect(parseGoogleSheetUrl("ftp://docs.google.com/spreadsheets/d/abc")).toBeNull();
  });
});
