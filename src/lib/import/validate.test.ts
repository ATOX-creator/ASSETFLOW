import { describe, expect, it } from "vitest";
import { rowOutcome, validateImportRows } from "./validate";
import type { ImportRecordInput } from "./types";

function record(partial: Partial<ImportRecordInput>): ImportRecordInput {
  return {
    tag: "LAP-001",
    name: "ThinkPad T14",
    category: "laptop",
    status: "deployed",
    location: null,
    rowNumber: 2,
    ...partial,
  };
}

describe("validateImportRows", () => {
  it("accepts a fully valid record and canonicalises values", () => {
    const result = validateImportRows(
      [record({ status: "In Repair", category: "Laptop", rowNumber: 2 })],
      [],
    );
    expect(result.rows[0].record).toMatchObject({
      status: "in_repair",
      category: "laptop",
    });
    expect(result.importable).toHaveLength(1);
    expect(result.errorCount).toBe(0);
    expect(rowOutcome(result.rows[0])).toBe("import");
  });

  it("flags fully empty rows as skippable warnings", () => {
    const result = validateImportRows(
      [record({ tag: "", name: "", category: "", status: "", rowNumber: 3 })],
      [],
    );
    expect(result.rows[0].issues).toEqual([{ severity: "warning", code: "empty_row" }]);
    expect(rowOutcome(result.rows[0])).toBe("skip");
  });

  it("rejects invalid statuses and categories with the original value", () => {
    const result = validateImportRows(
      [record({ status: "exploded", category: "spaceship" })],
      [],
    );
    const codes = result.rows[0].issues.map((issue) => issue.code);
    expect(codes).toContain("invalid_status");
    expect(codes).toContain("invalid_category");
    const statusIssue = result.rows[0].issues.find((issue) => issue.code === "invalid_status");
    expect(statusIssue?.value).toBe("exploded");
    expect(rowOutcome(result.rows[0])).toBe("reject");
  });

  it("rejects missing required values", () => {
    const result = validateImportRows(
      [record({ tag: "   ", name: "" })],
      [],
    );
    const codes = result.rows[0].issues.map((issue) => issue.code);
    expect(codes).toContain("missing_tag");
    expect(codes).toContain("missing_name");
  });

  it("rejects malformed asset IDs", () => {
    const result = validateImportRows([record({ tag: "BAD TAG" })], []);
    expect(result.rows[0].issues.map((issue) => issue.code)).toContain("invalid_tag");
  });

  it("allows hyphens in asset IDs", () => {
    const result = validateImportRows([record({ tag: "LAP-00421" })], []);
    expect(result.rows[0].issues).toHaveLength(0);
  });

  it("marks later duplicates inside the file as blocking errors", () => {
    const result = validateImportRows(
      [
        record({ tag: "LAP-1", rowNumber: 2 }),
        record({ tag: "lap-1", rowNumber: 3 }),
      ],
      [],
    );
    expect(result.rows[0].issues).toHaveLength(0);
    expect(result.rows[1].issues).toContainEqual({
      severity: "error",
      code: "duplicate_in_file",
      value: "lap-1",
    });
    expect(rowOutcome(result.rows[1])).toBe("reject");
  });

  it("marks tags that already exist as warnings to be skipped", () => {
    const result = validateImportRows([record({ tag: "EXISTING-1" })], ["existing-1"]);
    expect(result.rows[0].issues).toContainEqual({
      severity: "warning",
      code: "duplicate_existing",
      value: "EXISTING-1",
    });
    expect(rowOutcome(result.rows[0])).toBe("skip");
    expect(result.importable).toHaveLength(0);
    expect(result.warningCount).toBe(1);
  });
});
