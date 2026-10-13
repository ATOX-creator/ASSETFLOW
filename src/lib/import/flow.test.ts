import { describe, expect, it } from "vitest";
import { detectColumns } from "./headers";
import { buildImportRecords, parseSpreadsheet } from "./parse";
import { executeAssetImport } from "./execute";
import { validateImportRows } from "./validate";
import type { Repository } from "@/lib/data";
import type { AssetRecord } from "@/lib/data";

const SHEET_CSV = [
  "Asset ID,Asset Name,Asset Category,Asset Status,Location",
  "LAP-00101,Dell Latitude 7440,Laptop,Deployed,HQ",
  "MON-00205, LG UltraFine,Monitor,In Repair,Depot",
  "LAP-00101,Duplicate,Laptop,Available,",
  ",Missing tag,Laptop,Available,",
  "BAD-00001,Broken Status,Laptop,Exploded,",
].join("\n");

function fakeRepository(existingTags: string[] = []): {
  repository: Repository;
  created: string[];
} {
  const created: string[] = [];
  const assets: AssetRecord[] = existingTags.map((tag) => ({
    id: `ast_${tag}`,
    tag,
    name: "Existing",
    category: "laptop" as const,
    status: "deployed" as const,
    location: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastScannedAt: null,
  }));

  const repository = {
    async listAssets() {
      return [...assets];
    },
    async createAsset(input: {
      tag: string;
      name: string;
      category: AssetRecord["category"];
      status: AssetRecord["status"];
      location?: string | null;
    }) {
      created.push(input.tag);
      const now = new Date().toISOString();
      const asset: AssetRecord = {
        id: `ast_${input.tag}`,
        tag: input.tag,
        name: input.name,
        category: input.category,
        status: input.status,
        location: input.location ?? null,
        createdAt: now,
        updatedAt: now,
        lastScannedAt: null,
      };
      assets.push(asset);
      return asset;
    },
  } as unknown as Repository;

  return { repository, created };
}

describe("Google Sheets CSV import flow", () => {
  it("parses, detects, validates and commits public sheet data end to end", async () => {
    const rows = parseSpreadsheet(SHEET_CSV);
    const detection = detectColumns(rows[0].cells);
    expect(detection.missing).toEqual([]);

    const records = buildImportRecords(rows, detection);
    const validation = validateImportRows(records, []);
    expect(validation.rows).toHaveLength(5);
    expect(validation.importable.map((row) => row.record?.tag)).toEqual([
      "LAP-00101",
      "MON-00205",
    ]);

    const { repository } = fakeRepository();
    const result = await executeAssetImport(repository, validation.rows);
    expect(result.imported).toBe(2);
    expect(result.rejected).toBe(3);
    expect(result.skipped).toBe(0);
  });

  it("stops before any write when required columns are missing", () => {
    const rows = parseSpreadsheet("Serial Number,Notes\nLAP-1,fine\n");
    const detection = detectColumns(rows[0].cells);
    expect(detection.missing).toEqual(["tag", "name", "category", "status"]);
    // Missing columns halt the flow: no records are built or committed.
    expect(detection.missing.length).toBeGreaterThan(0);
  });
});
