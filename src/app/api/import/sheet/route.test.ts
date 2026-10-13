import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  UnauthorizedError: class UnauthorizedError extends Error {},
  requireUser: vi.fn(async () => ({
    id: "usr_1",
    name: "John",
    email: "john@company.com",
    department: "it",
    role: "member",
    createdAt: new Date().toISOString(),
  })),
}));

import { POST } from "./route";

function request(url: string): Request {
  return new Request("http://localhost/api/import/sheet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/import/sheet", () => {
  it("rejects URLs that are not Google Sheets", async () => {
    const response = await POST(request("https://example.com/sheet/1"));
    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error).toBe("invalid_url");
  });

  it("reports inaccessible private sheets", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>Sign in</html>", { status: 401 })),
    );
    const response = await POST(
      request("https://docs.google.com/spreadsheets/d/abc123/edit?gid=0"),
    );
    expect(response.status).toBe(422);
    const payload = await response.json();
    expect(payload.error).toBe("sheet_unreachable");
  });

  it("returns the CSV payload of a public sheet", async () => {
    const csv = "Asset ID,Name,Category,Status\nLAP-1,Laptop,laptop,available\n";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(csv, { status: 200 })),
    );
    const response = await POST(
      request("https://docs.google.com/spreadsheets/d/abc123/edit?gid=0"),
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.csv).toBe(csv);
    expect(payload.sheetId).toBe("abc123");
  });

  it("treats an HTML export page as unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<!DOCTYPE html><html></html>", { status: 200 })),
    );
    const response = await POST(
      request("https://docs.google.com/spreadsheets/d/abc123/edit"),
    );
    expect(response.status).toBe(422);
  });
});
