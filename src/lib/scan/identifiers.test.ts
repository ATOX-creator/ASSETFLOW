import { describe, expect, it } from "vitest";
import {
  captureMethodFromFormat,
  extractIdentifiers,
  normalizeSerial,
  validateIdentifier,
} from "./identifiers";

describe("extractIdentifiers — asset tags", () => {
  it("recognizes structured asset tags", () => {
    const ids = extractIdentifiers("AST-00421");
    expect(ids).toEqual([
      { value: "AST-00421", raw: "AST-00421", type: "asset_tag" },
    ]);
  });

  it("recognizes tags inside mixed text and ignores unrelated words", () => {
    const text =
      "Laptop Dell Latitude — Asset Tag: AST-00421 — Serial: SN12345678 — Location: Office 2";
    const ids = extractIdentifiers(text);
    expect(ids.map((id) => id.value)).toEqual(["AST-00421", "SN12345678"]);
    expect(ids[0].type).toBe("asset_tag");
    expect(ids[1].type).toBe("serial_number");
  });

  it("extracts labelled tags in non-structured formats", () => {
    const ids = extractIdentifiers("Asset ID: ABC123XYZ");
    expect(ids).toEqual([
      { value: "ABC123XYZ", raw: "Asset ID: ABC123XYZ", type: "asset_tag" },
    ]);
  });

  it("ignores ordinary words and model names", () => {
    expect(extractIdentifiers("Dell Latitude ThinkPad Carbon Gen 11")).toEqual([]);
    expect(extractIdentifiers("Office lobby second floor")).toEqual([]);
  });

  it("does not treat single-digit hyphen tails as tags", () => {
    expect(extractIdentifiers("Office-2 reception")).toEqual([]);
  });
});

describe("extractIdentifiers — serial numbers", () => {
  it("recognizes uppercase, lowercase, hyphenated and spaced SN serials", () => {
    for (const raw of ["SN12345678", "sn12345678", "SN-12345678", "SN 12345678"]) {
      const ids = extractIdentifiers(`label ${raw} end`);
      expect(ids).toHaveLength(1);
      expect(ids[0]).toMatchObject({ value: "SN12345678", type: "serial_number" });
      expect(ids[0].raw).toBe(raw);
    }
  });

  it("normalizes the SN prefix and separator", () => {
    expect(normalizeSerial("sn-12345678")).toBe("SN12345678");
    expect(normalizeSerial("SN 12345678")).toBe("SN12345678");
    expect(normalizeSerial("SN12345678")).toBe("SN12345678");
  });

  it("does not match SN inside unrelated words", () => {
    expect(extractIdentifiers("SNOW storm and DESKTOP-1")).toEqual([]);
    expect(extractIdentifiers("CONSIGNMENT 88")).toEqual([]);
  });

  it("requires at least four digits after SN", () => {
    expect(extractIdentifiers("SN123 tag")).toEqual([]);
  });
});

describe("extractIdentifiers — dedupe and structure", () => {
  it("removes duplicate identifiers within one capture", () => {
    const ids = extractIdentifiers("AST-00421 and ast-00421 again AST-00421");
    expect(ids).toHaveLength(1);
    expect(ids[0].value).toBe("AST-00421");
  });

  it("deduplicates serials across separator variants", () => {
    const ids = extractIdentifiers("SN-12345678 / sn 12345678 / SN12345678");
    expect(ids).toHaveLength(1);
    expect(ids[0].value).toBe("SN12345678");
  });

  it("does not double-report a serial as an asset tag", () => {
    const ids = extractIdentifiers("SN-12345678");
    expect(ids).toHaveLength(1);
    expect(ids[0].type).toBe("serial_number");
  });

  it("returns nothing for empty or unrelated OCR text", () => {
    expect(extractIdentifiers("")).toEqual([]);
    expect(extractIdentifiers("   ")).toEqual([]);
    expect(
      extractIdentifiers("Confidential memo — please review the quarterly numbers"),
    ).toEqual([]);
  });

  it("keeps multiple distinct identifiers in document order", () => {
    const ids = extractIdentifiers("Tag LAP-001 serial SN99887766 plus MON-204");
    expect(ids.map((id) => id.value)).toEqual([
      "LAP-001",
      "SN99887766",
      "MON-204",
    ]);
  });
});

describe("validateIdentifier", () => {
  it("accepts structured tags and SN serials", () => {
    expect(validateIdentifier("AST-00421")).toMatchObject({
      ok: true,
      identifier: { value: "AST-00421", type: "asset_tag" },
    });
    expect(validateIdentifier("sn-12345678")).toMatchObject({
      ok: true,
      identifier: { value: "SN12345678", type: "serial_number" },
    });
  });

  it("rejects arbitrary text and overlong values", () => {
    expect(validateIdentifier("hello world")).toMatchObject({ ok: false });
    expect(validateIdentifier("X".repeat(65))).toMatchObject({ ok: false });
    expect(validateIdentifier("")).toMatchObject({ ok: false });
  });
});

describe("captureMethodFromFormat", () => {
  it("maps decoder formats and channels to capture methods", () => {
    expect(captureMethodFromFormat("QR_CODE")).toBe("qr_code");
    expect(captureMethodFromFormat("CODE_128")).toBe("barcode");
    expect(captureMethodFromFormat("EAN_13")).toBe("barcode");
    expect(captureMethodFromFormat("MANUAL_INPUT")).toBe("keyboard");
    expect(captureMethodFromFormat("OCR_TEXT")).toBe("camera_ocr");
    expect(captureMethodFromFormat(null)).toBe("manual");
  });
});
