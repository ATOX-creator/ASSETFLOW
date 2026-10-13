import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User as SupabaseUser } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({
  repository: {
    getUser: vi.fn(),
    createUser: vi.fn(),
  },
}));

vi.mock("@/lib/data", () => ({
  getRepository: () => mocks.repository,
}));

import { ensureProfile, resolveDisplayName } from "./profile";

function supabaseUser(overrides: Record<string, unknown> = {}): SupabaseUser {
  return {
    id: "sb-user-9",
    email: "jane@company.com",
    user_metadata: {},
    aud: "authenticated",
    app_metadata: {},
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as SupabaseUser;
}

beforeEach(() => {
  vi.clearAllMocks();
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

describe("resolveDisplayName", () => {
  it("prefers provider profile names", () => {
    expect(resolveDisplayName(supabaseUser({ user_metadata: { full_name: "Jane Doe" } }))).toBe(
      "Jane Doe",
    );
    expect(resolveDisplayName(supabaseUser({ user_metadata: { name: "Janet" } }))).toBe(
      "Janet",
    );
  });

  it("falls back to the email local part", () => {
    expect(resolveDisplayName(supabaseUser())).toBe("jane");
  });

  it("trims long names", () => {
    const name = resolveDisplayName(
      supabaseUser({ user_metadata: { full_name: "x".repeat(400) } }),
    );
    expect(name.length).toBeLessThanOrEqual(120);
  });
});

describe("ensureProfile", () => {
  it("creates a member profile for a new identity", async () => {
    const profile = await ensureProfile(supabaseUser());

    expect(profile).toMatchObject({
      id: "sb-user-9",
      email: "jane@company.com",
      role: "member",
    });
    expect(mocks.repository.createUser).toHaveBeenCalledTimes(1);
    const input = mocks.repository.createUser.mock.calls[0][0];
    expect(input).not.toHaveProperty("role");
    expect(input).not.toHaveProperty("admin");
  });

  it("is idempotent for existing profiles", async () => {
    const existing = {
      id: "sb-user-9",
      name: "Jane Doe",
      email: "jane@company.com",
      department: "it",
      role: "admin" as const,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    mocks.repository.getUser.mockResolvedValue(existing);

    const profile = await ensureProfile(supabaseUser());

    expect(profile).toEqual(existing);
    expect(mocks.repository.createUser).not.toHaveBeenCalled();
  });

  it("refuses to profile an identity without an email", async () => {
    expect(await ensureProfile(supabaseUser({ email: null }))).toBeNull();
    expect(mocks.repository.createUser).not.toHaveBeenCalled();
    expect(mocks.repository.getUser).not.toHaveBeenCalled();
  });
});
