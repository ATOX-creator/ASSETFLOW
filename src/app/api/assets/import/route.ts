import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { getRepository } from "@/lib/data";
import { handleApiError, jsonError, readString } from "@/lib/api/server";
import type { ImportCommitResult, ImportRecordInput } from "@/lib/import/types";
import { validateImportRows } from "@/lib/import/validate";
import { executeAssetImport } from "@/lib/import/execute";

const MAX_IMPORT_ITEMS = 2000;

interface ImportItemPayload {
  tag: string;
  name: string;
  category: string;
  status: string;
  location?: string | null;
}

function readItems(body: unknown): ImportItemPayload[] | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }
  const items = (body as { items?: unknown }).items;
  if (!Array.isArray(items)) {
    return null;
  }
  return items.map((entry) => {
    const row = (typeof entry === "object" && entry !== null ? entry : {}) as Record<
      string,
      unknown
    >;
    const location = row.location;
    return {
      tag: readString(row, "tag"),
      name: readString(row, "name"),
      category: readString(row, "category"),
      status: readString(row, "status"),
      location: typeof location === "string" ? location : null,
    };
  });
}

/**
 * Commits a confirmed asset import. Everything is re-validated server-side
 * against the same rules used by the client preview; existing tags are
 * skipped rather than overwritten.
 */
export async function POST(request: Request) {
  try {
    await requireUser();

    const body = await request.json().catch(() => null);
    const items = readItems(body);
    if (!items) {
      return jsonError(400, "Send the confirmed import items as JSON.", "invalid_payload");
    }
    if (items.length === 0) {
      return jsonError(400, "There are no importable rows to commit.", "empty_import");
    }
    if (items.length > MAX_IMPORT_ITEMS) {
      return jsonError(
        413,
        `Imports are limited to ${MAX_IMPORT_ITEMS} rows per batch.`,
        "import_too_large",
      );
    }

    const repository = getRepository();
    const existingAssets = await repository.listAssets();
    const existingTags = existingAssets.map((asset) => asset.tag);

    const records: ImportRecordInput[] = items.map((item, index) => ({
      tag: item.tag,
      name: item.name,
      category: item.category,
      status: item.status,
      location: item.location ?? null,
      rowNumber: index + 1,
    }));

    const validation = validateImportRows(records, existingTags);
    const result: ImportCommitResult = await executeAssetImport(
      repository,
      validation.rows,
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
