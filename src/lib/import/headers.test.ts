import { describe, expect, it } from "vitest";
import { detectColumns, normalizeHeader } from "./headers";

describe("normalizeHeader", () => {
  it("lowercases and strips separators", () => {
    expect(normalizeHeader("Asset ID")).toBe("assetid");
    expect(normalizeHeader(" asset_id ")).toBe("assetid");
    expect(normalizeHeader("AssetID")).toBe("assetid");
    expect(normalizeHeader("Asset-Status")).toBe("assetstatus");
  });
});

describe("detectColumns", () => {
  it("detects canonical headers regardless of case and separators", () => {
    const detection = detectColumns(["Asset ID", "Asset Name", "Category", "Status"]);
    expect(detection.missing).toEqual([]);
    expect(detection.mapping.tag).toBe(0);
    expect(detection.mapping.name).toBe(1);
    expect(detection.mapping.category).toBe(2);
    expect(detection.mapping.status).toBe(3);
  });

  it("matches snake_case and compact aliases", () => {
    const detection = detectColumns(["asset_id", "name", "asset_category", "asset_status"]);
    expect(detection.missing).toEqual([]);
    expect(detection.mapping.tag).toBe(0);
    expect(detection.mapping.name).toBe(1);
    expect(detection.mapping.category).toBe(2);
    expect(detection.mapping.status).toBe(3);
  });

  it("maps every required column only once", () => {
    const detection = detectColumns(["Tag", "Name", "Category", "Status", "Location"]);
    expect(detection.missing).toEqual([]);
    expect(detection.mapping.tag).toBe(0);
    expect(detection.mapping.location).toBe(4);
  });

  it("reports every missing required column", () => {
    const detection = detectColumns(["Serial Number"]);
    expect(detection.missing).toEqual(["tag", "name", "category", "status"]);
  });

  it("reports only the columns that are actually missing", () => {
    const detection = detectColumns(["Asset ID", "Status"]);
    expect(detection.missing).toEqual(["name", "category"]);
  });

  it("treats location as optional", () => {
    const detection = detectColumns(["AssetID", "Name", "Category", "Status"]);
    expect(detection.missing).toEqual([]);
  });
});
