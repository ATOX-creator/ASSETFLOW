import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { handleApiError, jsonError, readString } from "@/lib/api/server";
import { parseGoogleSheetUrl } from "@/lib/import/sheet";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_CSV_BYTES = 2_000_000;

/**
 * Downloads the CSV export of a publicly shared Google Sheet.
 * No Google credentials are requested or stored — the sheet must be
 * shared as "anyone with the link" for this endpoint to succeed.
 */
export async function POST(request: Request) {
  try {
    await requireUser();

    const body = await request.json().catch(() => null);
    const url = readString(body, "url");
    const target = parseGoogleSheetUrl(url);
    if (!target) {
      return jsonError(
        400,
        "Enter a valid Google Sheets URL, for example https://docs.google.com/spreadsheets/d/…",
        "invalid_url",
      );
    }

    let response: Response;
    try {
      response = await fetch(target.csvUrl, {
        redirect: "follow",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch {
      return jsonError(
        502,
        "The spreadsheet could not be downloaded. Check the link and try again.",
        "sheet_fetch_failed",
      );
    }

    if (!response.ok) {
      return jsonError(
        422,
        "The spreadsheet could not be accessed. Make sure the sheet is shared publicly.",
        "sheet_unreachable",
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();
    const looksLikeHtml =
      contentType.includes("text/html") || /^\s*<!doctype html|^\s*<html/i.test(text);
    if (looksLikeHtml) {
      return jsonError(
        422,
        "The spreadsheet could not be accessed. Make sure the sheet is shared publicly.",
        "sheet_unreachable",
      );
    }
    if (!text.trim()) {
      return jsonError(422, "The spreadsheet appears to be empty.", "sheet_empty");
    }
    if (text.length > MAX_CSV_BYTES) {
      return jsonError(413, "The spreadsheet is too large to import.", "sheet_too_large");
    }

    return NextResponse.json({ csv: text, sheetId: target.sheetId });
  } catch (error) {
    return handleApiError(error);
  }
}
