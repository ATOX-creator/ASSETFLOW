import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { getRepository } from "@/lib/data";
import { handleApiError, jsonError, readString } from "@/lib/api/server";
import type { ScanResponse } from "@/lib/api/types";
import { isAssetStatus } from "@/lib/constants";
import { validateIdentifier } from "@/lib/scan/identifiers";

const completedSubmissions = new Map<string, number>();
const SUBMISSION_TTL_MS = 5 * 60_000;

export async function POST(request: Request) {
  try {
    const scannedBy = await requireUser();
    const submissionKey = readString(await request.clone().json().catch(() => null), "submissionId");
    const now = Date.now();
    for (const [key, completedAt] of completedSubmissions) {
      if (now - completedAt > SUBMISSION_TTL_MS) {
        completedSubmissions.delete(key);
      }
    }
    const duplicateKey = submissionKey ? `${scannedBy.id}:${submissionKey}` : null;
    if (duplicateKey && completedSubmissions.has(duplicateKey)) {
      return jsonError(409, "This confirmed scan was already submitted.", "duplicate_submission");
    }

    const repository = getRepository();
    const body = await request.json().catch(() => null);

    const rawTag = readString(body, "tag");
    const status = readString(body, "status");
    const format = readString(body, "format") || null;

    const validated = validateIdentifier(rawTag);
    if (!validated.ok || validated.identifier.type !== "asset_tag") {
      return jsonError(400, "Enter a valid asset tag.", "invalid_identifier");
    }
    const tag = validated.identifier.value;
    if (!isAssetStatus(status)) {
      return jsonError(400, "Select a valid status.", "invalid_status");
    }

    const asset = await repository.getAssetByTag(tag);
    if (!asset) {
      return jsonError(404, "No asset matches this tag.", "unknown_asset");
    }
    const previousStatus = asset.status;

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

    if (duplicateKey) {
      completedSubmissions.set(duplicateKey, now);
    }
    return NextResponse.json({ asset: updated, log } satisfies ScanResponse);
  } catch (error) {
    return handleApiError(error);
  }
}
