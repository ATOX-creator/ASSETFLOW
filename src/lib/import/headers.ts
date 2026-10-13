import type { ColumnDetection, ImportField } from "./types";
import { REQUIRED_IMPORT_FIELDS } from "./types";

const FIELD_ALIASES: Record<ImportField, readonly string[]> = {
  tag: ["assetid", "assettag", "tag", "assetreference", "referencetag"],
  name: ["assetname", "name", "designation", "assetlabel", "label"],
  category: ["assetcategory", "category", "categoryname"],
  status: ["assetstatus", "status", "statusname", "state"],
  location: ["assetlocation", "location", "site", "physicallocation"],
};

export function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function detectColumns(headers: string[]): ColumnDetection {
  const normalized = headers.map((header) => normalizeHeader(header ?? ""));
  const mapping: Partial<Record<ImportField, number>> = {};
  const claimed = new Set<number>();

  // Longer (more specific) aliases are matched before shorter ambiguous ones.
  const fields: ImportField[] = [...REQUIRED_IMPORT_FIELDS, "location"];
  for (const field of fields) {
    const aliases = [...FIELD_ALIASES[field]].sort((a, b) => b.length - a.length);
    for (const alias of aliases) {
      const index = normalized.findIndex(
        (header, position) => header === alias && !claimed.has(position),
      );
      if (index >= 0) {
        mapping[field] = index;
        claimed.add(index);
        break;
      }
    }
  }

  const missing = REQUIRED_IMPORT_FIELDS.filter((field) => mapping[field] === undefined);
  return { headers, mapping, missing };
}
