import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssetRecord, ScanEventRecord, UserRecord } from "@/lib/data";

const mocks = vi.hoisted(() => {
  class UnauthorizedError extends Error {}
  const requireUser = vi.fn();
  const state = {
    assets: [] as AssetRecord[],
    events: [] as ScanEventRecord[],
  };
  const repository = {
    async getAssetByTag(tag: string) {
      const needle = tag.trim().toLowerCase();
      return state.assets.find((asset) => asset.tag.toLowerCase() === needle) ?? null;
    },
    async createScanEvent(input: {
      identifier: string;
      identifierRaw: string;
      identifierType: "asset_tag" | "serial_number";
      captureMethod: string;
      outcome: "matched" | "unmatched";
      asset: AssetRecord | null;
      scannedBy: UserRecord;
    }): Promise<ScanEventRecord> {
      const event: ScanEventRecord = {
        id: `sev_${state.events.length + 1}`,
        identifier: input.identifier,
        identifierRaw: input.identifierRaw,
        identifierType: input.identifierType,
        captureMethod: input.captureMethod as ScanEventRecord["captureMethod"],
        outcome: input.outcome,
        assetId: input.asset?.id ?? null,
        assetTag: input.asset?.tag ?? null,
        userId: input.scannedBy.id,
        userName: input.scannedBy.name,
        userEmail: input.scannedBy.email,
        scannedAt: new Date().toISOString(),
      };
      state.events.push(event);
      return event;
    },
  };
  return { UnauthorizedError, requireUser, repository, state };
});

vi.mock("@/lib/auth/session", () => ({
  UnauthorizedError: mocks.UnauthorizedError,
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/data", () => ({
  getRepository: vi.fn(() => mocks.repository),
}));

import { POST } from "./route";

function request(body: unknown): Request {
  return new Request("http://localhost/api/scan/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mocks.state.events.length = 0;
  mocks.state.assets = [
    {
      id: "ast_1",
      tag: "LAP-00421",
      name: "Dell Latitude 5440",
      category: "laptop",
      status: "deployed",
      location: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      lastScannedAt: null,
    },
  ];
  mocks.requireUser.mockReset();
  mocks.requireUser.mockResolvedValue({
    id: "usr_1",
    name: "John",
    email: "john@company.com",
    department: "it",
    role: "member",
    createdAt: new Date().toISOString(),
  });
});

describe("POST /api/scan/events", () => {
  it("rejects unauthenticated requests", async () => {
    mocks.requireUser.mockRejectedValue(new mocks.UnauthorizedError());
    const response = await POST(request({ identifier: "LAP-00421" }));
    expect(response.status).toBe(401);
    expect(mocks.state.events).toHaveLength(0);
  });

  it("rejects invalid identifiers without creating a scan record", async () => {
    const response = await POST(
      request({ identifier: "hello world", captureMethod: "camera_ocr" }),
    );
    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error).toBe("invalid_identifier");
    expect(mocks.state.events).toHaveLength(0);
  });

  it("rejects OCR text that contains no valid identifier", async () => {
    const response = await POST(
      request({
        identifier: "Quarterly memo — Dell Latitude 5440 office lobby",
        captureMethod: "camera_ocr",
      }),
    );
    expect(response.status).toBe(400);
    expect(mocks.state.events).toHaveLength(0);
  });

  it("logs an unmatched SN serial number with metadata", async () => {
    const response = await POST(
      request({
        identifier: "sn-12345678",
        captureMethod: "camera_ocr",
      }),
    );
    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.event).toMatchObject({
      identifier: "SN12345678",
      identifierType: "serial_number",
      captureMethod: "camera_ocr",
      outcome: "unmatched",
      assetId: null,
      userId: "usr_1",
    });
    expect(payload.asset).toBeNull();
  });

  it("resolves a matching asset tag and records the linkage", async () => {
    const response = await POST(
      request({ identifier: "lap-00421", captureMethod: "qr_code" }),
    );
    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.event).toMatchObject({
      identifier: "LAP-00421",
      identifierType: "asset_tag",
      captureMethod: "qr_code",
      outcome: "matched",
      assetId: "ast_1",
      assetTag: "LAP-00421",
    });
  });

  it("defaults the capture method when omitted", async () => {
    const response = await POST(request({ identifier: "MON-00128" }));
    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.event.captureMethod).toBe("manual");
  });

  it("does not store unrelated OCR text as the identifier", async () => {
    const response = await POST(
      request({ identifier: "AST-00421", captureMethod: "keyboard" }),
    );
    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.event.identifier).toBe("AST-00421");
    expect(payload.event.identifierRaw).toBe("AST-00421");
  });
});
