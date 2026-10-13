export type IdentifierType = "asset_tag" | "serial_number";

export type CaptureMethod =
  | "camera_ocr"
  | "barcode"
  | "qr_code"
  | "keyboard"
  | "manual";

export interface ExtractedIdentifier {
  value: string;
  raw: string;
  type: IdentifierType;
}

export const MAX_IDENTIFIER_LENGTH = 64;

const INVALID_IDENTIFIER_CHARS = /[\s\x00-\x1f\x7f]/;

/**
 * Serial numbers start with SN (case-insensitive), optionally separated by a
 * hyphen or space, followed by at least four digits. Word boundaries keep SN
 * inside unrelated words (e.g. SNOW, DESKTOP) from matching.
 */
const SERIAL_PATTERN = /\bSN[\s-]?(\d{4,})\b/gi;

/**
 * Structured asset tags used by Assetflow and its imports: a short alphanumeric
 * prefix, a hyphen, then 2-8 digits (e.g. AST-00421, LAP-001, HW-2024-01 is
 * intentionally not matched as a whole — each hyphen segment is checked).
 */
const STANDALONE_TAG_PATTERN = /\b([A-Za-z][A-Za-z0-9]{1,7}-\d{2,8})\b/g;

/** Context labels give extraction hints for vendor-specific tag formats. */
const LABELLED_TAG_PATTERN =
  /(?:asset\s*tag|asset\s*id|\btag)\s*[:#]\s*([^\s,;|/]+)/gi;

const LABELLED_SERIAL_PATTERN =
  /(?:serial(?:\s*number)?|s\/n)\s*[:#]\s*(SN[\s-]?\d{4,})/gi;

function isPlausibleIdentifierToken(value: string): boolean {
  if (!value || value.length > MAX_IDENTIFIER_LENGTH) {
    return false;
  }
  return !INVALID_IDENTIFIER_CHARS.test(value);
}

function isPlausibleAssetTag(value: string): boolean {
  if (!isPlausibleIdentifierToken(value)) {
    return false;
  }
  if (SERIAL_PATTERN.test(value)) {
    SERIAL_PATTERN.lastIndex = 0;
    return false;
  }
  SERIAL_PATTERN.lastIndex = 0;
  return true;
}

/** Canonical serial form: uppercase SN prefix, separator removed. */
export function normalizeSerial(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^SN[\s-]?(\d{4,})$/i);
  return match ? `SN${match[1]}` : trimmed;
}

/** Canonical asset-tag form: uppercase, matching inventory tag casing. */
function normalizeAssetTag(value: string): string {
  return value.trim().toUpperCase();
}

function serialDedupeKey(value: string): string {
  return value.replace(/^SN[\s-]?/i, "SN").toUpperCase();
}

interface Candidate {
  index: number;
  end: number;
  identifier: ExtractedIdentifier;
}

function collectMatches(
  text: string,
  pattern: RegExp,
  map: (match: RegExpExecArray) => ExtractedIdentifier | null,
): Candidate[] {
  const candidates: Candidate[] = [];
  pattern.lastIndex = 0;
  let match: RegExpExecArray | null = pattern.exec(text);
  while (match) {
    const identifier = map(match);
    if (identifier) {
      candidates.push({
        index: match.index,
        end: match.index + match[0].length,
        identifier,
      });
    }
    match = pattern.exec(text);
  }
  return candidates;
}

function overlaps(candidate: Candidate, taken: Candidate[]): boolean {
  return taken.some(
    (existing) =>
      candidate.index < existing.end && candidate.end > existing.index,
  );
}

/**
 * Extract recognized asset tags and SN serial numbers from arbitrary text
 * (OCR output, barcode payloads, pasted or typed input). Unrelated words are
 * ignored. Duplicates within one capture are removed, keeping the first
 * occurrence in document order.
 */
export function extractIdentifiers(text: string): ExtractedIdentifier[] {
  if (!text || !text.trim()) {
    return [];
  }

  const serials = collectMatches(text, SERIAL_PATTERN, (match) => ({
    value: normalizeSerial(match[0]),
    raw: match[0].trim(),
    type: "serial_number" as const,
  }));

  const labelledTags = collectMatches(text, LABELLED_TAG_PATTERN, (match) => {
    const candidate = match[1].replace(/[.,;:]+$/, "");
    if (!isPlausibleAssetTag(candidate)) {
      return null;
    }
    return {
      value: normalizeAssetTag(candidate),
      raw: match[0].trim(),
      type: "asset_tag" as const,
    };
  });

  const taken = [...serials];
  const standaloneTags = collectMatches(
    text,
    STANDALONE_TAG_PATTERN,
    (match) => {
      const candidate = match[1];
      if (!isPlausibleAssetTag(candidate)) {
        return null;
      }
      return {
        value: normalizeAssetTag(candidate),
        raw: candidate,
        type: "asset_tag" as const,
      };
    },
  ).filter((candidate) => !overlaps(candidate, taken));

  const labelledSerials = collectMatches(
    text,
    LABELLED_SERIAL_PATTERN,
    (match) => {
      const value = normalizeSerial(match[1]);
      if (!/^SN\d{4,}$/.test(value)) {
        return null;
      }
      return {
        value,
        raw: match[0].trim(),
        type: "serial_number" as const,
      };
    },
  ).filter((candidate) => {
    const overlapsSerial = serials.some(
      (serial) =>
        candidate.index < serial.end && candidate.end > serial.index,
    );
    if (overlapsSerial) {
      return false;
    }
    taken.push(candidate);
    return true;
  });

  const all = [...serials, ...labelledTags, ...standaloneTags, ...labelledSerials].sort(
    (a, b) => a.index - b.index,
  );

  const seen = new Set<string>();
  const result: ExtractedIdentifier[] = [];
  for (const candidate of all) {
    const { identifier } = candidate;
    const key =
      identifier.type === "serial_number"
        ? `sn:${serialDedupeKey(identifier.value)}`
        : `tag:${identifier.value.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(identifier);
  }
  return result;
}

/** Validate a single identifier that was typed, scanned, or extracted. */
export function validateIdentifier(
  value: string,
): { ok: true; identifier: ExtractedIdentifier } | { ok: false; reason: "invalid_format" } {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_IDENTIFIER_LENGTH) {
    return { ok: false, reason: "invalid_format" };
  }
  if (INVALID_IDENTIFIER_CHARS.test(trimmed)) {
    return { ok: false, reason: "invalid_format" };
  }
  const serial = normalizeSerial(trimmed);
  if (/^SN\d{4,}$/.test(serial)) {
    return {
      ok: true,
      identifier: { value: serial, raw: trimmed, type: "serial_number" },
    };
  }
  if (/^[A-Za-z][A-Za-z0-9]{1,7}-\d{2,8}$/.test(trimmed)) {
    return {
      ok: true,
      identifier: {
        value: normalizeAssetTag(trimmed),
        raw: trimmed,
        type: "asset_tag",
      },
    };
  }
  return { ok: false, reason: "invalid_format" };
}

/** Map a decoder format or input channel to a capture-method label. */
export function captureMethodFromFormat(
  format: string | null | undefined,
): CaptureMethod {
  const value = (format ?? "").toUpperCase();
  if (value === "MANUAL_INPUT" || value === "KEYBOARD") {
    return "keyboard";
  }
  if (value === "OCR_TEXT" || value === "CAMERA_OCR") {
    return "camera_ocr";
  }
  if (value.includes("QR")) {
    return "qr_code";
  }
  if (!value || value === "UNKNOWN") {
    return "manual";
  }
  return "barcode";
}
