import { isAssetCategory, isAssetStatus } from "@/lib/constants";
import type { AssetCategory, AssetStatus } from "@/lib/constants";
import type {
  ImportRecordInput,
  RowIssue,
  RowOutcome,
  ValidatedRow,
  ValidationResult,
} from "./types";

const MAX_TAG_LENGTH = 64;
const INVALID_TAG_CHARS = new RegExp("[\\s\\x00-\\x1f\\x7f]");

function canonicalise(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export function canonicaliseStatus(value: string): string {
  return canonicalise(value);
}

export function canonicaliseCategory(value: string): string {
  return canonicalise(value);
}

function isEmptyRecord(record: ImportRecordInput): boolean {
  return (
    record.tag.trim() === "" &&
    record.name.trim() === "" &&
    record.category.trim() === "" &&
    record.status.trim() === ""
  );
}

export function rowOutcome(row: ValidatedRow): RowOutcome {
  if (row.issues.some((issue) => issue.severity === "error")) {
    return "reject";
  }
  if (row.issues.length > 0) {
    return "skip";
  }
  return "import";
}

export function validateImportRows(
  records: ImportRecordInput[],
  existingTags: readonly string[],
): ValidationResult {
  const knownTags = new Set(existingTags.map((tag) => tag.trim().toLowerCase()));
  const seenTags = new Set<string>();
  const rows: ValidatedRow[] = [];

  for (const record of records) {
    if (isEmptyRecord(record)) {
      rows.push({
        rowNumber: record.rowNumber,
        record: null,
        issues: [{ severity: "warning", code: "empty_row" }],
      });
      continue;
    }

    const issues: RowIssue[] = [];
    const tag = record.tag.trim();
    const name = record.name.trim();
    const location = (record.location ?? "").trim() || null;

    if (!tag) {
      issues.push({ severity: "error", code: "missing_tag" });
    } else if (tag.length > MAX_TAG_LENGTH || INVALID_TAG_CHARS.test(tag)) {
      issues.push({ severity: "error", code: "invalid_tag", value: tag });
    }

    if (!name) {
      issues.push({ severity: "error", code: "missing_name" });
    }

    const statusValue = canonicaliseStatus(record.status);
    if (!isAssetStatus(statusValue)) {
      issues.push({ severity: "error", code: "invalid_status", value: record.status });
    }

    const categoryValue = canonicaliseCategory(record.category);
    if (!isAssetCategory(categoryValue)) {
      issues.push({
        severity: "error",
        code: "invalid_category",
        value: record.category,
      });
    }

    const tagKey = tag.toLowerCase();
    if (tag) {
      if (seenTags.has(tagKey)) {
        issues.push({ severity: "error", code: "duplicate_in_file", value: tag });
      } else {
        seenTags.add(tagKey);
        if (knownTags.has(tagKey)) {
          issues.push({
            severity: "warning",
            code: "duplicate_existing",
            value: tag,
          });
        }
      }
    }

    const valid =
      tag.length > 0 &&
      tag.length <= MAX_TAG_LENGTH &&
      !INVALID_TAG_CHARS.test(tag) &&
      name.length > 0 &&
      isAssetStatus(statusValue) &&
      isAssetCategory(categoryValue) &&
      !issues.some((issue) => issue.severity === "error");

    rows.push({
      rowNumber: record.rowNumber,
      record: valid
        ? {
            tag,
            name,
            status: statusValue as AssetStatus,
            category: categoryValue as AssetCategory,
            location,
          }
        : null,
      issues,
    });
  }

  const importable = rows.filter((row) => rowOutcome(row) === "import");
  const errorCount = rows.filter((row) => rowOutcome(row) === "reject").length;
  const warningCount = rows.filter(
    (row) =>
      rowOutcome(row) === "skip" &&
      row.issues.some((issue) => issue.severity === "warning"),
  ).length;

  return { rows, importable, errorCount, warningCount };
}
