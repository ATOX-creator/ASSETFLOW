import { ASSET_CATEGORIES, ASSET_STATUSES } from "@/lib/constants";
import type { AssetCategory, AssetStatus, Tone } from "@/lib/constants";
import { toneOf } from "@/lib/visuals";

export interface StatusSlice {
  status: AssetStatus;
  count: number;
  tone: Tone;
}

export interface CategoryAnalytics {
  category: AssetCategory;
  total: number;
  byStatus: StatusSlice[];
}

export interface ScanActivitySummary {
  scans: number;
  uniqueAssets: number;
  lastScannedAt: string | null;
}

export interface ScanActivityFilter {
  userId?: string;
  from?: string;
  to?: string;
}

type AssetLike = Pick<AssetRecordLike, "status" | "category">;

interface AssetRecordLike {
  status: AssetStatus;
  category: AssetCategory;
}

function countMap<T extends string>(values: readonly T[]): Map<T, number> {
  const counts = new Map<T, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

/** Zero-inclusive status counts, ordered like the canonical status list. */
export function countByStatus(assets: readonly AssetLike[]): Record<AssetStatus, number> {
  const counts = countMap(
    assets.map((asset) => asset.status).filter((status) => (ASSET_STATUSES as readonly string[]).includes(status)),
  );
  const result = {} as Record<AssetStatus, number>;
  for (const status of ASSET_STATUSES) {
    result[status] = counts.get(status) ?? 0;
  }
  return result;
}

/** Non-zero status slices ordered like the canonical status list. */
export function statusDistribution(assets: readonly AssetLike[]): StatusSlice[] {
  const counts = countByStatus(assets);
  return ASSET_STATUSES.map((status) => ({
    status,
    count: counts[status],
    tone: toneOf(status),
  })).filter((slice) => slice.count > 0);
}

/**
 * Per-category status distributions, sorted by size then name.
 * Optional category filter restricts the result to a single category.
 */
export function categoryDistributions(
  assets: readonly AssetLike[],
  options?: { category?: string },
): CategoryAnalytics[] {
  const filtered = options?.category
    ? assets.filter((asset) => asset.category === options.category)
    : assets;

  const byCategory = new Map<AssetCategory, AssetLike[]>();
  for (const asset of filtered) {
    if (!(ASSET_CATEGORIES as readonly string[]).includes(asset.category)) {
      continue;
    }
    const group = byCategory.get(asset.category);
    if (group) {
      group.push(asset);
    } else {
      byCategory.set(asset.category, [asset]);
    }
  }

  return [...byCategory.entries()]
    .map(([category, group]) => ({
      category,
      total: group.length,
      byStatus: statusDistribution(group),
    }))
    .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category));
}

function startOfDay(value: string): number {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? Number.NEGATIVE_INFINITY : date.getTime();
}

function endOfDay(value: string): number {
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? Number.POSITIVE_INFINITY : date.getTime();
}

/**
 * Summarises scan-log events for the activity strip. Scans are log events —
 * they never create or delete asset records on their own.
 */
export function scanActivity(
  logs: readonly { assetId: string; scannedAt: string; scannedById?: string }[],
  filter?: ScanActivityFilter,
): ScanActivitySummary {
  const from = filter?.from ? startOfDay(filter.from) : Number.NEGATIVE_INFINITY;
  const to = filter?.to ? endOfDay(filter.to) : Number.POSITIVE_INFINITY;
  const userId = filter?.userId ?? "";

  const matching = logs.filter((log) => {
    if (userId && log.scannedById && log.scannedById !== userId) {
      return false;
    }
    if (userId && !log.scannedById) {
      return false;
    }
    const at = new Date(log.scannedAt).getTime();
    if (Number.isNaN(at) || at < from || at > to) {
      return false;
    }
    return true;
  });

  const assets = new Set(matching.map((log) => log.assetId));
  let lastScannedAt: string | null = null;
  for (const log of matching) {
    if (!lastScannedAt || log.scannedAt > lastScannedAt) {
      lastScannedAt = log.scannedAt;
    }
  }

  return {
    scans: matching.length,
    uniqueAssets: assets.size,
    lastScannedAt,
  };
}
