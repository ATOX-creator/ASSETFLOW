import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssetRecord } from "@/lib/data";

const mocks = vi.hoisted(() => {
  class UnauthorizedError extends Error {}
  const requireUser = vi.fn();
  const assets: AssetRecord[] = [
    {
      id: "ast_1",
      tag: "MON-001",
      name: "Screen",
      category: "monitor",
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
    async updateAsset(id: string, patch: Partial<AssetRecord>) {
      const asset = assets.find((entry) => entry.id === id);
      if (!asset) {
        return null;
      }
      Object.assign(asset, patch, { updatedAt: new Date().toISOString() });
      return { ...asset };
    },
  };
  return { UnauthorizedError, requireUser, repository, assets };
});

vi.mock("@/lib/auth/session", () => ({
  UnauthorizedError: mocks.UnauthorizedError,
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/data", () => ({
  getRepository: vi.fn(() => mocks.repository),
}));

import { PATCH } from "./route";
import { countByStatus, statusDistribution } from "@/lib/analytics";

function patchRequest(status: string): Request {
  return new Request("http://localhost/api/assets/ast_1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

beforeEach(() => {
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

describe("PATCH /api/assets/[id]", () => {
  it("applies a status transition that moves chart counts", async () => {
    expect(countByStatus(mocks.assets).deployed).toBe(1);

    const response = await PATCH(patchRequest("retired"), {
      params: Promise.resolve({ id: "ast_1" }),
    });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.asset.status).toBe("retired");

    const counts = countByStatus(mocks.assets);
    expect(counts.deployed).toBe(0);
    expect(counts.retired).toBe(1);
    expect(statusDistribution(mocks.assets).map((slice) => slice.status)).toEqual([
      "retired",
    ]);
  });

  it("rejects invalid statuses without writing", async () => {
    const response = await PATCH(patchRequest("exploded"), {
      params: Promise.resolve({ id: "ast_1" }),
    });
    expect(response.status).toBe(400);
    expect(mocks.assets[0].status).toBe("deployed");
  });

  it("returns 404 for missing assets", async () => {
    const response = await PATCH(patchRequest("retired"), {
      params: Promise.resolve({ id: "ast_missing" }),
    });
    expect(response.status).toBe(404);
  });
});
