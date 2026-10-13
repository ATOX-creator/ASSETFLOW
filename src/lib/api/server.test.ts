import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: {} })),
}));

import { ForbiddenError, UnauthorizedError } from "@/lib/auth/session";
import { handleApiError, jsonError, readString } from "./server";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("handleApiError", () => {
  it("maps an invalid session to JSON 401", async () => {
    const response = handleApiError(new UnauthorizedError());
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("unauthorized");
    expect(body.message).toMatch(/session/i);
  });

  it("maps a failed authorization check to JSON 403", async () => {
    const response = handleApiError(new ForbiddenError());
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("forbidden");
  });

  it("maps duplicate tags to 409", async () => {
    const response = handleApiError(new Error("TAG_EXISTS"));
    expect(response.status).toBe(409);
  });

  it("returns a generic 500 without leaking internals", async () => {
    const response = handleApiError(
      new Error("connect ECONNREFUSED db-password=hunter2 at 10.0.0.5"),
    );
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("internal");
    expect(body.message).toBe("The request could not be completed.");
    expect(JSON.stringify(body)).not.toContain("hunter2");
    expect(JSON.stringify(body)).not.toContain("ECONNREFUSED");
  });

  it("handles non-Error values", async () => {
    const response = handleApiError("boom");
    expect(response.status).toBe(500);
  });
});

describe("jsonError / readString", () => {
  it("produces a consistent error envelope", async () => {
    const response = jsonError(400, "Bad input", "invalid");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid", message: "Bad input" });
  });

  it("only reads strings and trims them", () => {
    expect(readString({ name: "  hi  " }, "name")).toBe("hi");
    expect(readString({ name: 42 }, "name")).toBe("");
    expect(readString(null, "name")).toBe("");
    expect(readString(undefined, "name")).toBe("");
  });
});
