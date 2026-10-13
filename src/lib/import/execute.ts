import type { Repository } from "@/lib/data";
import { isAssetCategory, isAssetStatus } from "@/lib/constants";
import type { ImportCommitResult, ValidatedRow } from "./types";
import { rowOutcome } from "./validate";

/**
 * Persists validated import rows through the existing Repository.
 * Existing tags are never overwritten — they are counted as skipped.
 * Per-row failures are collected so a partial import stays explicit.
 */
export async function executeAssetImport(
  repository: Repository,
  rows: readonly ValidatedRow[],
): Promise<ImportCommitResult> {
  const existing = await repository.listAssets();
  const knownTags = new Set(existing.map((asset) => asset.tag.trim().toLowerCase()));

  let imported = 0;
  let skipped = 0;
  let rejected = 0;
  const failures: ImportCommitResult["failures"] = [];
  const importedTags: string[] = [];

  for (const row of rows) {
    const outcome = rowOutcome(row);

    if (outcome === "reject") {
      rejected += 1;
      continue;
    }

    if (outcome === "skip" || !row.record) {
      skipped += 1;
      continue;
    }

    const record = row.record;
    const tagKey = record.tag.toLowerCase();

    if (knownTags.has(tagKey)) {
      skipped += 1;
      continue;
    }

    if (!isAssetStatus(record.status) || !isAssetCategory(record.category)) {
      rejected += 1;
      failures.push({
        rowNumber: row.rowNumber,
        tag: record.tag,
        code: "invalid_record",
      });
      continue;
    }

    try {
      const created = await repository.createAsset({
        tag: record.tag,
        name: record.name,
        category: record.category,
        status: record.status,
        location: record.location,
      });
      knownTags.add(tagKey);
      importedTags.push(created.tag);
      imported += 1;
    } catch {
      rejected += 1;
      failures.push({
        rowNumber: row.rowNumber,
        tag: record.tag,
        code: "create_failed",
      });
    }
  }

  return { imported, skipped, rejected, failures, importedTags };
}
