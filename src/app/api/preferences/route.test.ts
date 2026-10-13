import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const requireUser = vi.fn();
  const repository = {
    getUser: vi.fn(),
    updateDepartment: vi.fn(),
    savePreferences: vi.fn(),
    getPreferences: vi.fn(),
  };
  return { requireUser, repository };
});

vi.mock("@/lib/auth/session", () => {
  class UnauthorizedError extends Error {}
  return { UnauthorizedError, requireUser: mocks.requireUser };
});

vi.mock("@/lib/data", () => ({
  getRepository: () => mocks.repository,
}));

import { PUT } from "./route";
import { UnauthorizedError } from "@/lib/auth/session";

function putRequest(body: unknown): Request {
  return new Request("http://localhost/api/preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const currentUser = {
  id: "sb-user-1",
  name: "Jane Doe",
  email: "jane@company.com",
  department: "it",
  role: "member" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue(currentUser);
  mocks.repository.getUser.mockResolvedValue(currentUser);
  mocks.repository.updateDepartment.mockResolvedValue(currentUser);
  mocks.repository.savePreferences.mockResolvedValue({
    userId: currentUser.id,
    language: "en",
    theme: "system",
    updatedAt: new Date().toISOString(),
  });
  mocks.repository.getPreferences.mockResolvedValue({
    userId: currentUser.id,
    language: "en",
    theme: "system",
    updatedAt: new Date().toISOString(),
  });
});

describe("PUT /api/preferences", () => {
  it("updates the caller's own preferences", async () => {
    const response = await PUT(putRequest({ language: "fr", theme: "dark" }));
    expect(response.status).toBe(200);
    expect(mocks.repository.savePreferences).toHaveBeenCalledWith(currentUser.id, {
      language: "fr",
    });
    expect(mocks.repository.updateDepartment).not.toHaveBeenCalled();
  });

  it("ignores a self-referencing user id but never changes another profile", async () => {
    const response = await PUT(
      putRequest({ userId: currentUser.id, department: "facilities" }),
    );
    expect(response.status).toBe(200);
    expect(mocks.repository.updateDepartment).toHaveBeenCalledWith(
      currentUser.id,
      "facilities",
    );
  });

  it("refuses requests targeting another user with 403", async () => {
    const response = await PUT(
      putRequest({ userId: "usr_john_smith", department: "it" }),
    );
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("forbidden");
    expect(mocks.repository.updateDepartment).not.toHaveBeenCalled();
  });

  it("refuses role escalation attempts with 403", async () => {
    const response = await PUT(putRequest({ role: "admin" }));
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("forbidden");
    expect(mocks.repository.savePreferences).not.toHaveBeenCalled();
    expect(mocks.repository.updateDepartment).not.toHaveBeenCalled();
  });

  it("refuses an id field pointing at another profile", async () => {
    const response = await PUT(putRequest({ id: "usr_john_smith", language: "fr" }));
    expect(response.status).toBe(403);
    expect(mocks.repository.savePreferences).not.toHaveBeenCalled();
  });

  it("rejects unsupported values", async () => {
    expect((await PUT(putRequest({ language: "klingon" }))).status).toBe(400);
    expect((await PUT(putRequest({ theme: "neon" }))).status).toBe(400);
    expect(
      (await PUT(putRequest({ department: "x".repeat(61) }))).status,
    ).toBe(400);
  });

  it("returns 401 when the session is invalid", async () => {
    mocks.requireUser.mockRejectedValue(new UnauthorizedError());
    const response = await PUT(putRequest({ language: "fr" }));
    expect(response.status).toBe(401);
  });
});
