import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { getRepository } from "@/lib/data";
import { handleApiError } from "@/lib/api/server";
import { ASSET_CATEGORIES, ASSET_STATUSES } from "@/lib/constants";
import type { LogOptionsResponse } from "@/lib/api/types";

export async function GET() {
  try {
    await requireUser();
    const repository = getRepository();
    const [assets, logs] = await Promise.all([
      repository.listAssets(),
      repository.listLogs(),
    ]);

    const users = new Map<string, string>();
    for (const log of logs) {
      users.set(log.scannedById, log.scannedByName);
    }

    return NextResponse.json({
      assets: assets.map((asset) => ({
        id: asset.id,
        tag: asset.tag,
        name: asset.name,
      })),
      users: [...users.entries()].map(([id, name]) => ({ id, name })),
      categories: [...ASSET_CATEGORIES],
      statuses: [...ASSET_STATUSES],
    } satisfies LogOptionsResponse);
  } catch (error) {
    return handleApiError(error);
  }
}
