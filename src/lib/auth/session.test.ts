import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User as SupabaseUser } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => {
  const getUser = vi.fn();
  const repository = {
    getUser: vi.fn(),
    createUser: vi.fn(),
  };
  return { getUser, repository };
});

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
  })),
}));

vi.mock("@/lib/data", () => ({
  getRepository: () => mocks.repository,
}));

import {
  ForbiddenError,
  UnauthorizedError,
  getAuthUser,
  getCurrentUser,
  requireRole,
  requireUser,
} from "./session";

function supabaseUser(overrides: Record<string, unknown> = {}): SupabaseUser {
  return {
    id: "sb-user-1",
    email: "jane@company.com",
    user_metadata: { full_name: "Jane Doe" },
    aud: "authenticated",
    app_metadata: {},
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as SupabaseUser;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  mocks.repository.getUser.mockResolvedValue(null);
  mocks.repository.createUser.mockImplementation(async (input: {
    id: string;
    name: string;
    email: string;
    department?: string | null;
  }) => ({
    id: input.id,
    name: input.name,
    email: input.email,
    department: input.department ?? null,
    role: "member" as const,
    createdAt: "2026-01-01T00:00:00.000Z",
  }));
});

describe("getAuthUser", () => {
  it("returns null without a session", async () => {
    expect(await getAuthUser()).toBeNull();
  });

  it("returns the server-verified user", async () => {
    const user = supabaseUser();
    mocks.getUser.mockResolvedValue({ data: { user }, error: null });
    expect(await getAuthUser()).toEqual(user);
  });

  it("returns null when verification fails", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("invalid jwt"),
    });
    expect(await getAuthUser()).toBeNull();
  });

  it("returns null when the client cannot be created (missing config)", async () => {
    const { createServerSupabaseClient } = await import("@/lib/supabase/server");
    vi.mocked(createServerSupabaseClient).mockRejectedValueOnce(
      new Error("Supabase is not configured"),
    );
    expect(await getAuthUser()).toBeNull();
  });
});

describe("getCurrentUser / requireUser", () => {
  it("throws UnauthorizedError for anonymous visitors", async () => {
    await expect(requireUser()).rejects.toBeInstanceOf(UnauthorizedError);
    expect(await getCurrentUser()).toBeNull();
  });

  it("creates the profile once for a new identity", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: supabaseUser() }, error: null });

    const first = await requireUser();

    expect(first).toMatchObject({
      id: "sb-user-1",
      name: "Jane Doe",
      email: "jane@company.com",
      role: "member",
    });
    expect(mocks.repository.createUser).toHaveBeenCalledTimes(1);
    // No role can be requested through this path.
    expect(mocks.repository.createUser.mock.calls[0][0]).not.toHaveProperty("role");

    mocks.repository.getUser.mockResolvedValue(first);
    const second = await getCurrentUser();
    expect(second).toEqual(first);
    expect(mocks.repository.createUser).toHaveBeenCalledTimes(1);
  });

  it("refuses identities without a verified email address", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: supabaseUser({ email: null }) },
      error: null,
    });
    expect(await getCurrentUser()).toBeNull();
    expect(mocks.repository.createUser).not.toHaveBeenCalled();
    await expect(requireUser()).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe("requireRole", () => {
  it("throws UnauthorizedError when signed out", async () => {
    await expect(requireRole("admin")).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("throws ForbiddenError for authenticated members", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: supabaseUser() }, error: null });
    mocks.repository.getUser.mockResolvedValue({
      id: "sb-user-1",
      name: "Jane Doe",
      email: "jane@company.com",
      department: null,
      role: "member",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    await expect(requireRole("admin")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("allows an admin profile through", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: supabaseUser() }, error: null });
    mocks.repository.getUser.mockResolvedValue({
      id: "sb-user-1",
      name: "Jane Doe",
      email: "jane@company.com",
      department: null,
      role: "admin",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const admin = await requireRole("admin");
    expect(admin.role).toBe("admin");
  });
});
