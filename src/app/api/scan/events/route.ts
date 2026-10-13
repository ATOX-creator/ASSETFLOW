import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { getRepository } from "@/lib/data";
import { handleApiError, jsonError, readString } from "@/lib/api/server";
import {
  validateIdentifier,
  type CaptureMethod,
} from "@/lib/scan/identifiers";

const CAPTURE_METHODS: ReadonlySet<string> = new Set([
  "camera_ocr",
  "barcode",
  "qr_code",
  "keyboard",
  "manual",
]);

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const rateBuckets = new Map<string, number[]>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const bucket = (rateBuckets.get(userId) ?? []).filter(
    (at) => now - at < RATE_LIMIT_WINDOW_MS,
  );
  if (bucket.length >= RATE_LIMIT_MAX) {
    rateBuckets.set(userId, bucket);
    return true;
  }
  bucket.push(now);
  rateBuckets.set(userId, bucket);
  return false;
}

export async function POST(request: Request) {
  try {
    const scannedBy = await requireUser();

    if (isRateLimited(scannedBy.id)) {
      return jsonError(
        429,
        "Too many scan events in a short time. Wait a moment and try again.",
        "rate_limited",
      );
    }

    const repository = getRepository();
    const body = await request.json().catch(() => null);

    const rawIdentifier = readString(body, "identifier");
    const methodRaw = readString(body, "captureMethod");
    const captureMethod = (
      CAPTURE_METHODS.has(methodRaw) ? methodRaw : "manual"
    ) as CaptureMethod;

    const validated = validateIdentifier(rawIdentifier);
    if (!validated.ok) {
      return jsonError(
        400,
        "No valid asset tag or serial number was found.",
        "invalid_identifier",
      );
    }
    const { identifier } = validated;

    // Serial numbers are not stored on asset records yet, so only asset tags
    // can resolve to an existing asset.
    const asset =
      identifier.type === "asset_tag"
        ? await repository.getAssetByTag(identifier.value)
        : null;

    const event = await repository.createScanEvent({
      identifier: identifier.value,
      identifierRaw: identifier.raw,
      identifierType: identifier.type,
      captureMethod,
      outcome: asset ? "matched" : "unmatched",
      asset,
      scannedBy,
    });

    return NextResponse.json({ event, asset }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
