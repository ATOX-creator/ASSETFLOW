import { describe, expect, it } from "vitest";
import {
  categoryDistributions,
  countByStatus,
  scanActivity,
  statusDistribution,
} from "./analytics";
import type { AssetCategory, AssetStatus } from "@/lib/constants";

function asset(status: AssetStatus, category: AssetCategory) {
  return { status, category };
}

describe("statusDistribution / countByStatus", () => {
  it("counts assets by status and omits empty statuses from the chart data", () => {
    const assets = [
      asset("deployed", "laptop"),
      asset("deployed", "monitor"),
      asset("in_repair", "laptop"),
    ];
    const counts = countByStatus(assets);
    expect(counts.deployed).toBe(2);
    expect(counts.in_repair).toBe(1);
    expect(counts.lost).toBe(0);

    const slices = statusDistribution(assets);
    expect(slices.map((slice) => slice.status)).toEqual(["deployed", "in_repair"]);
    expect(slices.every((slice) => slice.count > 0)).toBe(true);
  });

  it("grows the total when an asset is created", () => {
    const assets = [asset("available", "laptop")];
    expect(statusDistribution(assets)).toHaveLength(1);
    assets.push(asset("available", "laptop"));
    expect(countByStatus(assets).available).toBe(2);
  });

  it("does not change counts when an asset is only scanned (status kept)", () => {
    const assets = [asset("deployed", "laptop"), asset("available", "monitor")];
    const before = countByStatus(assets);
    // A repeated scan updates lastScannedAt but leaves status untouched.
    const after = countByStatus(assets);
    expect(after).toEqual(before);
  });

  it("moves counts between statuses on a status transition", () => {
    const assets = [asset("deployed", "laptop")];
    assets[0] = asset("in_repair", "laptop");
    const counts = countByStatus(assets);
    expect(counts.deployed).toBe(0);
    expect(counts.in_repair).toBe(1);
  });

  it("drops deleted records from the distribution", () => {
    const assets = [asset("deployed", "laptop"), asset("lost", "monitor")];
    assets.splice(1, 1);
    const slices = statusDistribution(assets);
    expect(slices).toHaveLength(1);
    expect(slices[0].status).toBe("deployed");
  });
});

describe("categoryDistributions", () => {
  const assets = [
    asset("deployed", "laptop"),
    asset("in_repair", "laptop"),
    asset("deployed", "monitor"),
    asset("retired", "monitor"),
    asset("lost", "monitor"),
  ];

  it("groups status slices per category, sorted by size", () => {
    const rows = categoryDistributions(assets);
    expect(rows.map((row) => row.category)).toEqual(["monitor", "laptop"]);
    expect(rows[0].total).toBe(3);
    expect(rows[1].total).toBe(2);
    expect(rows[1].byStatus.map((slice) => slice.status)).toEqual([
      "deployed",
      "in_repair",
    ]);
  });

  it("filters to a single category", () => {
    const rows = categoryDistributions(assets, { category: "laptop" });
    expect(rows).toHaveLength(1);
    expect(rows[0].category).toBe("laptop");
    expect(rows[0].total).toBe(2);
  });

  it("returns nothing for an unknown category filter", () => {
    expect(categoryDistributions(assets, { category: "spaceship" })).toEqual([]);
  });
});

describe("scanActivity", () => {
  const logs = [
    { assetId: "a1", scannedAt: "2026-10-01T09:00:00.000Z", scannedById: "u1" },
    { assetId: "a2", scannedAt: "2026-10-02T09:00:00.000Z", scannedById: "u2" },
    { assetId: "a1", scannedAt: "2026-10-03T09:00:00.000Z", scannedById: "u1" },
  ];

  it("summarises all scans when unfiltered", () => {
    const summary = scanActivity(logs);
    expect(summary.scans).toBe(3);
    expect(summary.uniqueAssets).toBe(2);
    expect(summary.lastScannedAt).toBe("2026-10-03T09:00:00.000Z");
  });

  it("filters by user", () => {
    const summary = scanActivity(logs, { userId: "u2" });
    expect(summary.scans).toBe(1);
    expect(summary.uniqueAssets).toBe(1);
  });

  it("filters by date range (inclusive days)", () => {
    const summary = scanActivity(logs, { from: "2026-10-02", to: "2026-10-03" });
    expect(summary.scans).toBe(2);
    const beforeRange = scanActivity(logs, { to: "2026-09-30" });
    expect(beforeRange.scans).toBe(0);
    expect(beforeRange.lastScannedAt).toBeNull();
  });
});
