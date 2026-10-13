import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssetRecord } from "@/lib/data";

const mocks = vi.hoisted(() => {
  class UnauthorizedError extends Error {}
  const requireUser = vi.fn();
  const calls = {
    createAsset: [] as { tag: string; name: string; category: string; status: string }[],
    updateAsset: [] as { id: string; status: string }[],
    createLog: 0,
  };
  const assets: AssetRecord[] = [
    {
      id: "ast_existing",
      tag: "LAP-001",
      name: "ThinkPad",
      category: "laptop",
      status: "deployed",
      location: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      lastScannedAt: null,
    },
  ];

  const repository = {
    async listAssets() {
      return [...assets];
    },
    async getAssetByTag(tag: string) {
      const needle = tag.trim().toLowerCase();
      return assets.find((asset) => asset.tag.toLowerCase() === needle) ?? null;
    },
    async createAsset(input: { tag: string; name: string; category: string; status: string }) {
      calls.createAsset.push(input);
      const now = new Date().toISOString();
      const asset: AssetRecord = {
        id: `ast_${input.tag}`,
        tag: input.tag,
        name: input.name,
        category: input.category as AssetRecord["category"],
        status: input.status as AssetRecord["status"],
        location: null,
        createdAt: now,
        updatedAt: now,
        lastScannedAt: null,
      };
      assets.push(asset);
      return asset;
    },
    async updateAsset(id: string, patch: Partial<AssetRecord>) {
      calls.updateAsset.push({ id, status: String(patch.status) });
      const asset = assets.find((entry) => entry.id === id);
      if (!asset) {
        return null;
      }
      Object.assign(asset, patch, { updatedAt: new Date().toISOString() });
      return { ...asset };
    },
    async createLog() {
      calls.createLog += 1;
      return { id: "log_1" };
    },
  };

  return { UnauthorizedError, requireUser, repository, calls, assets };
});

vi.mock("@/lib/auth/session", () => ({
  UnauthorizedError: mocks.UnauthorizedError,
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/data", () => ({
  getRepository: vi.fn(() => mocks.repository),
}));

import { POST } from "./route";
import { countByStatus } from "@/lib/analytics";

function request(body: unknown): Request {
  return new Request("http://localhost/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mocks.calls.createAsset.length = 0;
  mocks.calls.updateAsset.length = 0;
  mocks.calls.createLog = 0;
  mocks.assets.length = 1;
  mocks.assets[0].status = "deployed";
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

describe("POST /api/scan", () => {
  it("rejects unauthenticated scans", async () => {
    mocks.requireUser.mockRejectedValue(new mocks.UnauthorizedError());
    const response = await POST(
      request({ tag: "LAP-001", status: "available" }),
    );
    expect(response.status).toBe(401);
  });

  it("does not create an asset when scanning an existing tag (repeated scan)", async () => {
    const before = countByStatus(mocks.assets).deployed;
    const response = await POST(
      request({ tag: "LAP-001", status: "deployed", format: "QR_CODE" }),
    );
    expect(response.status).toBe(200);
    expect(mocks.calls.createAsset).toEqual([]);
    expect(mocks.calls.updateAsset).toHaveLength(1);
    expect(mocks.calls.createLog).toBe(1);

    const counts = countByStatus(mocks.assets);
    expect(counts.deployed).toBe(before);
    expect(mocks.assets).toHaveLength(1);
  });

  it("records a status transition without changing the asset count", async () => {
    const response = await POST(
      request({ tag: "LAP-001", status: "in_repair" }),
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.asset.status).toBe("in_repair");
    expect(mocks.calls.createAsset).toEqual([]);
    expect(mocks.assets).toHaveLength(1);
    expect(countByStatus(mocks.assets).in_repair).toBe(1);
  });

  it("creates a new asset for an unknown tag with manual registration data", async () => {
    const response = await POST(
      request({
        tag: "NEW-900",
        status: "available",
        name: "New Laptop",
        category: "laptop",
        format: "MANUAL_INPUT",
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.calls.createAsset).toHaveLength(1);
    expect(mocks.assets).toHaveLength(2);
    expect(countByStatus(mocks.assets).available).toBe(1);
  });

  it("rejects an unknown tag without registration data", async () => {
    const response = await POST(request({ tag: "GHOST-1", status: "available" }));
    expect(response.status).toBe(404);
    expect(mocks.calls.createAsset).toEqual([]);
    expect(mocks.assets).toHaveLength(1);
  });
});
