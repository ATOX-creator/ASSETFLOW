import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { getRepository } from "@/lib/data";
import { handleApiError, jsonError, readString } from "@/lib/api/server";
import type { ScanResponse } from "@/lib/api/types";
import { isAssetCategory, isAssetStatus } from "@/lib/constants";

export async function POST(request: Request) {
  try {
    const scannedBy = await requireUser();
    const repository = getRepository();
    const body = await request.json().catch(() => null);

    const tag = readString(body, "tag");
    const status = readString(body, "status");
    const format = readString(body, "format") || null;
    const name = readString(body, "name");
    const category = readString(body, "category");

    if (!tag) {
      return jsonError(400, "Scan or enter an asset tag first.", "missing_tag");
    }
    if (!isAssetStatus(status)) {
      return jsonError(400, "Select a valid status.", "invalid_status");
    }

    let asset = await repository.getAssetByTag(tag);
    let previousStatus = asset ? asset.status : null;

    if (!asset) {
      if (!name || !isAssetCategory(category)) {
        return jsonError(
          404,
          "No asset matches this tag. Provide a name and category to register it.",
          "unknown_asset",
        );
      }
      asset = await repository.createAsset({ tag, name, category, status });
      previousStatus = null;
    }

    const scannedAt = new Date().toISOString();
    const updated = await repository.updateAsset(asset.id, {
      status,
      lastScannedAt: scannedAt,
    });
    if (!updated) {
      return jsonError(404, "That asset could not be found.", "not_found");
    }

    const log = await repository.createLog({
      asset: updated,
      previousStatus,
      status,
      scannedBy,
      scannedAt,
      format,
    });

    return NextResponse.json({ asset: updated, log } satisfies ScanResponse);
  } catch (error) {
    return handleApiError(error);
  }
}
