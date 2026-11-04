import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssetLogRecord, AssetRecord } from "@/lib/data";

const mocks = vi.hoisted(() => {
  class UnauthorizedError extends Error {}
  const requireUser = vi.fn();
  const state = {
    assets: [] as AssetRecord[],
    logs: [] as AssetLogRecord[],
  };
  const repository = {
    async listAssets() {
      return [...state.assets];
    },
    async listRecentLogs(limit: number) {
      return [...state.logs]
        .sort((a, b) => b.scannedAt.localeCompare(a.scannedAt))
        .slice(0, limit);
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

import { GET } from "./route";
import type { DashboardResponse } from "@/lib/api/types";

function asset(tag: string, status: AssetRecord["status"], category: AssetRecord["category"]): AssetRecord {
  const now = new Date().toISOString();
  return {
    id: `ast_${tag}`,
    tag,
    name: tag,
    category,
    status,
    location: null,
    createdAt: now,
    updatedAt: now,
    lastScannedAt: null,
  };
}

function log(assetId: string, scannedAt: string): AssetLogRecord {
  return {
    id: `log_${assetId}_${scannedAt}`,
    assetId,
    assetTag: assetId,
    assetName: assetId,
    category: "laptop",
    previousStatus: null,
    status: "deployed",
    scannedById: "usr_1",
    scannedByName: "John",
    scannedByEmail: "john@company.com",
    scannedAt,
    format: "QR_CODE",
  };
}

beforeEach(() => {
  mocks.state.assets = [
    asset("LAP-1", "deployed", "laptop"),
    asset("LAP-2", "in_repair", "laptop"),
    asset("MON-1", "deployed", "monitor"),
  ];
  mocks.state.logs = [
    log("LAP-1", "2026-10-01T10:00:00.000Z"),
    log("LAP-1", "2026-10-02T10:00:00.000Z"),
    log("MON-1", "2026-10-03T10:00:00.000Z"),
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

describe("GET /api/dashboard", () => {
  it("returns successful repository-derived empty results for an empty store", async () => {
    mocks.state.assets = [];
    mocks.state.logs = [];

    const response = await GET();
    expect(response.status).toBe(200);
    const payload = (await response.json()) as DashboardResponse;
    expect(payload.total).toBe(0);
    expect(payload.byStatus).toEqual([]);
    expect(payload.byCategory).toEqual([]);
    expect(payload.byCategoryStatus).toEqual([]);
    expect(payload.recent).toEqual([]);
  });

  it("derives totals from assets, not scan logs", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const payload = (await response.json()) as DashboardResponse;
    expect(payload.total).toBe(3);
    expect(payload.byStatus.find((entry) => entry.status === "deployed")?.count).toBe(2);
    expect(payload.byStatus.find((entry) => entry.status === "in_repair")?.count).toBe(1);
  });

  it("returns a per-category status matrix and a generation timestamp", async () => {
    const response = await GET();
    const payload = (await response.json()) as DashboardResponse;
    expect(payload.generatedAt).toBeTruthy();

    const laptop = payload.byCategoryStatus.find((row) => row.category === "laptop");
    expect(laptop?.total).toBe(2);
    expect(laptop?.byStatus).toEqual([
      { status: "deployed", count: 1 },
      { status: "in_repair", count: 1 },
    ]);

    const monitor = payload.byCategoryStatus.find((row) => row.category === "monitor");
    expect(monitor?.total).toBe(1);
    expect(monitor?.byStatus).toEqual([{ status: "deployed", count: 1 }]);
  });

  it("does not change totals when only scan logs grow", async () => {
    const before = await (await GET()).json();
    mocks.state.logs.push(log("LAP-1", "2026-10-04T10:00:00.000Z"));
    mocks.state.logs.push(log("LAP-2", "2026-10-05T10:00:00.000Z"));
    const after = (await (await GET()).json()) as DashboardResponse;
    expect(after.total).toBe(before.total);
    expect(after.byStatus).toEqual(before.byStatus);
    expect(after.byCategoryStatus).toEqual(before.byCategoryStatus);
  });

  it("reflects deleted assets immediately", async () => {
    mocks.state.assets = mocks.state.assets.filter((entry) => entry.tag !== "MON-1");
    const payload = (await (await GET()).json()) as DashboardResponse;
    expect(payload.total).toBe(2);
    expect(payload.byCategoryStatus.find((row) => row.category === "monitor")).toBeUndefined();
  });
});
