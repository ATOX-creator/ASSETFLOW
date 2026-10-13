import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { getRepository } from "@/lib/data";
import { handleApiError } from "@/lib/api/server";
import type { CategoryCount, DashboardResponse } from "@/lib/api/types";
import { ASSET_CATEGORIES } from "@/lib/constants";
import { categoryDistributions, countByStatus } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireUser();
    const repository = getRepository();
    const [assets, recent] = await Promise.all([
      repository.listAssets(),
      repository.listRecentLogs(8),
    ]);

    const statusCounts = countByStatus(assets);
    const categoryCounts = new Map<string, number>();

    for (const asset of assets) {
      categoryCounts.set(asset.category, (categoryCounts.get(asset.category) ?? 0) + 1);
    }

    const byStatus = Object.entries(statusCounts).map(([status, count]) => ({
      status: status as DashboardResponse["byStatus"][number]["status"],
      count,
    }));

    const byCategory: CategoryCount[] = [...categoryCounts.entries()]
      .filter(([category]) => (ASSET_CATEGORIES as ReadonlyArray<string>).includes(category))
      .map(([category, count]) => ({ category: category as CategoryCount["category"], count }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));

    return NextResponse.json({
      total: assets.length,
      byStatus,
      byCategory,
      byCategoryStatus: categoryDistributions(assets).map((entry) => ({
        category: entry.category,
        total: entry.total,
        byStatus: entry.byStatus.map((slice) => ({
          status: slice.status,
          count: slice.count,
        })),
      })),
      recent,
      generatedAt: new Date().toISOString(),
    } satisfies DashboardResponse);
  } catch (error) {
    return handleApiError(error);
  }
}
