import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const getCurrentUser = vi.fn();
  const repository = { getPreferences: vi.fn() };
  return { getCurrentUser, repository };
});

vi.mock("@/lib/auth/session", () => {
  class UnauthorizedError extends Error {}
  return { UnauthorizedError, getCurrentUser: mocks.getCurrentUser };
});

vi.mock("@/lib/data", () => ({
  getRepository: () => mocks.repository,
}));

import { GET } from "./route";
import { SupabaseConfigError } from "@/lib/supabase/env";

const authedUser = {
  id: "sb-user-9",
  name: "Jane Doe",
  email: "jane@company.com",
  department: "it",
  role: "member" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue(null);
  mocks.repository.getPreferences.mockResolvedValue(null);
});

describe("GET /api/me", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ user: null, preferences: null });
    expect(mocks.repository.getPreferences).not.toHaveBeenCalled();
  });

  it("returns the verified profile and stored preferences", async () => {
    mocks.getCurrentUser.mockResolvedValue(authedUser);
    mocks.repository.getPreferences.mockResolvedValue({
      userId: authedUser.id,
      language: "fr",
      theme: "dark",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      user: {
        id: authedUser.id,
        name: authedUser.name,
        email: authedUser.email,
        department: authedUser.department,
      },
      preferences: { language: "fr", theme: "dark" },
    });
    expect(mocks.repository.getPreferences).toHaveBeenCalledWith(authedUser.id);
  });

  it("returns null preferences on first sign-in", async () => {
    mocks.getCurrentUser.mockResolvedValue(authedUser);

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user.id).toBe(authedUser.id);
    expect(body.preferences).toBeNull();
  });

  it("reports missing configuration as 500, not as a signed-out 401", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.getCurrentUser.mockRejectedValue(
      new SupabaseConfigError(
        "Set the missing environment variable(s): NEXT_PUBLIC_SUPABASE_URL.",
      ),
    );

    const response = await GET();

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("internal");
    expect(body.message).not.toMatch(/configured|NEXT_PUBLIC/i);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
