import type { AssetCategory, AssetStatus } from "@/lib/constants";

export type ImportField = "tag" | "name" | "category" | "status" | "location";

export const REQUIRED_IMPORT_FIELDS: readonly ImportField[] = [
  "tag",
  "name",
  "category",
  "status",
];

export interface ColumnDetection {
  headers: string[];
  mapping: Partial<Record<ImportField, number>>;
  missing: ImportField[];
}

export interface RawRow {
  rowNumber: number;
  cells: string[];
}

export interface ImportRecordInput {
  tag: string;
  name: string;
  category: string;
  status: string;
  location: string | null;
  rowNumber: number;
}

export type RowIssueCode =
  | "empty_row"
  | "missing_tag"
  | "missing_name"
  | "invalid_tag"
  | "invalid_status"
  | "invalid_category"
  | "duplicate_in_file"
  | "duplicate_existing";

export interface RowIssue {
  severity: "error" | "warning";
  code: RowIssueCode;
  value?: string;
}

export interface ValidatedRow {
  rowNumber: number;
  record: {
    tag: string;
    name: string;
    category: AssetCategory;
    status: AssetStatus;
    location: string | null;
  } | null;
  issues: RowIssue[];
}

export type RowOutcome = "import" | "skip" | "reject";

export interface ValidationResult {
  rows: ValidatedRow[];
  importable: ValidatedRow[];
  errorCount: number;
  warningCount: number;
}

export interface ImportFailure {
  rowNumber: number;
  tag: string | null;
  code: string;
}

export interface ImportCommitResult {
  imported: number;
  skipped: number;
  rejected: number;
  failures: ImportFailure[];
  importedTags: string[];
}

export type ParseErrorCode = "empty" | "corrupted" | "unsupported";

export class SpreadsheetParseError extends Error {
  readonly code: ParseErrorCode;

  constructor(code: ParseErrorCode, message: string) {
    super(message);
    this.name = "SpreadsheetParseError";
    this.code = code;
  }
}
