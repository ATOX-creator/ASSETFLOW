import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { getRepository } from "@/lib/data";
import { handleApiError, jsonError, readString } from "@/lib/api/server";
import type { AssetResponse } from "@/lib/api/types";
import { isAssetStatus } from "@/lib/constants";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser();
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const status = readString(body, "status");
    if (!isAssetStatus(status)) {
      return jsonError(400, "Select a valid status.", "invalid_status");
    }
    const asset = await getRepository().updateAsset(id, { status });
    if (!asset) {
      return jsonError(404, "That asset could not be found.", "not_found");
    }
    return NextResponse.json({ asset } satisfies AssetResponse);
  } catch (error) {
    return handleApiError(error);
  }
}
