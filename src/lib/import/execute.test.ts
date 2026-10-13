import { describe, expect, it } from "vitest";
import type { Repository } from "@/lib/data";
import type { AssetRecord } from "@/lib/data";
import { executeAssetImport } from "./execute";
import { validateImportRows } from "./validate";
import type { ImportRecordInput, ValidatedRow } from "./types";

function makeAsset(tag: string): AssetRecord {
  const now = new Date().toISOString();
  return {
    id: `ast_${tag}`,
    tag,
    name: "Existing",
    category: "laptop",
    status: "deployed",
    location: null,
    createdAt: now,
    updatedAt: now,
    lastScannedAt: null,
  };
}

interface FakeRepoOptions {
  existingTags?: string[];
  failForTags?: string[];
}

function fakeRepository(options: FakeRepoOptions = {}): {
  repository: Repository;
  created: string[];
} {
  const assets = (options.existingTags ?? []).map(makeAsset);
  const created: string[] = [];
  const failFor = new Set((options.failForTags ?? []).map((tag) => tag.toLowerCase()));

  const repository = {
    async listAssets() {
      return [...assets];
    },
    async createAsset(input: { tag: string; name: string }) {
      if (failFor.has(input.tag.toLowerCase())) {
        throw new Error("create failed");
      }
      created.push(input.tag);
      const asset = makeAsset(input.tag);
      assets.push(asset);
      return asset;
    },
  } as unknown as Repository;

  return { repository, created };
}

function records(inputs: ImportRecordInput[]): ValidatedRow[] {
  return validateImportRows(inputs, []).rows;
}

function input(partial: Partial<ImportRecordInput>): ImportRecordInput {
  return {
    tag: "NEW-1",
    name: "New Asset",
    category: "laptop",
    status: "available",
    location: null,
    rowNumber: 2,
    ...partial,
  };
}

describe("executeAssetImport", () => {
  it("creates new assets and reports the imported tags", async () => {
    const { repository, created } = fakeRepository();
    const result = await executeAssetImport(
      repository,
      records([input({ tag: "NEW-1" }), input({ tag: "NEW-2", rowNumber: 3 })]),
    );
    expect(result.imported).toBe(2);
    expect(result.importedTags).toEqual(["NEW-1", "NEW-2"]);
    expect(created).toEqual(["NEW-1", "NEW-2"]);
    expect(result.skipped).toBe(0);
    expect(result.rejected).toBe(0);
  });

  it("never overwrites tags that already exist", async () => {
    const { repository, created } = fakeRepository({ existingTags: ["NEW-1"] });
    const result = await executeAssetImport(repository, records([input({ tag: "NEW-1" })]));
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(1);
    expect(created).toEqual([]);
  });

  it("counts rejected rows without writing them", async () => {
    const { repository, created } = fakeRepository();
    const rows = records([
      input({ tag: "BAD TAG" }),
      input({ tag: "NEW-9", status: "exploded" }),
    ]);
    const result = await executeAssetImport(repository, rows);
    expect(result.imported).toBe(0);
    expect(result.rejected).toBe(2);
    expect(created).toEqual([]);
  });

  it("continues after a per-row persistence failure", async () => {
    const { repository, created } = fakeRepository({ failForTags: ["NEW-1"] });
    const result = await executeAssetImport(
      repository,
      records([input({ tag: "NEW-1" }), input({ tag: "NEW-2", rowNumber: 3 })]),
    );
    expect(result.imported).toBe(1);
    expect(result.rejected).toBe(1);
    expect(result.failures).toEqual([
      { rowNumber: 2, tag: "NEW-1", code: "create_failed" },
    ]);
    expect(created).toEqual(["NEW-2"]);
  });

  it("skips rows marked as duplicates of existing assets", async () => {
    const { repository } = fakeRepository({ existingTags: ["DUP-1"] });
    const rows = validateImportRows([input({ tag: "DUP-1" })], ["DUP-1"]).rows;
    const result = await executeAssetImport(repository, rows);
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.rejected).toBe(0);
  });
});
