import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssetRecord } from "@/lib/data";

const mocks = vi.hoisted(() => {
  const createdTags: string[] = [];
  const existingAssets: AssetRecord[] = [];
  class UnauthorizedError extends Error {}
  const requireUser = vi.fn();
  const repository = {
    async listAssets() {
      return [...existingAssets];
    },
    async createAsset(input: { tag: string; name: string; category: string; status: string }) {
      createdTags.push(input.tag);
      const now = new Date().toISOString();
      return {
        id: `ast_${input.tag}`,
        tag: input.tag,
        name: input.name,
        category: input.category,
        status: input.status,
        location: null,
        createdAt: now,
        updatedAt: now,
        lastScannedAt: null,
      } as AssetRecord;
    },
  };
  return { createdTags, existingAssets, UnauthorizedError, requireUser, repository };
});

const { createdTags, existingAssets, UnauthorizedError, requireUser } = mocks;

vi.mock("@/lib/auth/session", () => ({
  UnauthorizedError: mocks.UnauthorizedError,
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/data", () => ({
  getRepository: vi.fn(() => mocks.repository),
}));

import { POST } from "./route";

function request(body: unknown): Request {
  return new Request("http://localhost/api/assets/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validItems = [
  { tag: "IMP-001", name: "Laptop", category: "laptop", status: "available" },
  { tag: "IMP-002", name: "Monitor", category: "monitor", status: "deployed" },
];

beforeEach(() => {
  createdTags.length = 0;
  existingAssets.length = 0;
  vi.mocked(requireUser).mockReset();
  vi.mocked(requireUser).mockImplementation(async () => {
    throw new UnauthorizedError();
  });
});

describe("POST /api/assets/import", () => {
  it("rejects unauthenticated requests without writing", async () => {
    const response = await POST(request({ items: validItems }));
    expect(response.status).toBe(401);
    expect(createdTags).toEqual([]);
  });

  it("imports validated items once authenticated", async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: "usr_1",
      name: "John",
      email: "john@company.com",
      department: "it",
      role: "admin",
      createdAt: new Date().toISOString(),
    });

    const response = await POST(request({ items: validItems }));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({ imported: 2, skipped: 0, rejected: 0 });
    expect(createdTags).toEqual(["IMP-001", "IMP-002"]);
  });

  it("skips items whose tags already exist instead of overwriting", async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: "usr_1",
      name: "John",
      email: "john@company.com",
      department: "it",
      role: "member",
      createdAt: new Date().toISOString(),
    });
    existingAssets.push({
      id: "ast_old",
      tag: "IMP-001",
      name: "Old",
      category: "laptop",
      status: "deployed",
      location: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastScannedAt: null,
    });

    const response = await POST(request({ items: validItems }));
    const payload = await response.json();
    expect(payload.imported).toBe(1);
    expect(payload.skipped).toBe(1);
    expect(createdTags).toEqual(["IMP-002"]);
  });

  it("rejects invalid statuses and writes nothing", async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: "usr_1",
      name: "John",
      email: "john@company.com",
      department: "it",
      role: "member",
      createdAt: new Date().toISOString(),
    });

    const response = await POST(
      request({
        items: [
          { tag: "IMP-010", name: "Laptop", category: "laptop", status: "exploded" },
        ],
      }),
    );
    const payload = await response.json();
    expect(payload.imported).toBe(0);
    expect(payload.rejected).toBe(1);
    expect(createdTags).toEqual([]);
  });

  it("rejects malformed payloads", async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: "usr_1",
      name: "John",
      email: "john@company.com",
      department: "it",
      role: "member",
      createdAt: new Date().toISOString(),
    });

    const response = await POST(request({ items: "nope" }));
    expect(response.status).toBe(400);
    expect(createdTags).toEqual([]);
  });

  it("rejects empty item lists without writing", async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: "usr_1",
      name: "John",
      email: "john@company.com",
      department: "it",
      role: "member",
      createdAt: new Date().toISOString(),
    });

    const response = await POST(request({ items: [] }));
    expect(response.status).toBe(400);
    expect(createdTags).toEqual([]);
  });
});
