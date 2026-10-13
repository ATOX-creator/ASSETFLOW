export interface SheetExportTarget {
  csvUrl: string;
  sheetId: string;
  gid: string;
}

const SHEET_HOSTS = new Set(["docs.google.com", "spreadsheets.google.com"]);
const SHEET_PATH = /^\/spreadsheets\/d\/(e\/)?([a-zA-Z0-9-_]+)(?:\/|$)/;

/**
 * Accepts the public share/edit URLs of a Google Sheet and resolves the
 * matching CSV export endpoint. No Google credentials are involved — the
 * sheet must already be shared publicly for the export to succeed.
 */
export function parseGoogleSheetUrl(input: string): SheetExportTarget | null {
  const trimmed = (input ?? "").trim();
  if (!trimmed) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return null;
  }
  if (!SHEET_HOSTS.has(url.hostname.toLowerCase())) {
    return null;
  }

  const match = SHEET_PATH.exec(url.pathname);
  if (!match) {
    return null;
  }

  const sheetId = match[2];
  const published = Boolean(match[1]);
  const gid = url.searchParams.get("gid") ?? "0";
  const basePath = published ? `e/${sheetId}` : sheetId;
  const csvUrl = `https://docs.google.com/spreadsheets/d/${basePath}/export?format=csv&gid=${encodeURIComponent(gid)}`;
  return { csvUrl, sheetId, gid };
}
