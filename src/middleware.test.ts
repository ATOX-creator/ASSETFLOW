import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  user: null as unknown,
  configurationError: null as Error | null,
}));

vi.mock("@/lib/supabase/env", () => {
  class SupabaseConfigError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "SupabaseConfigError";
    }
  }
  return { SupabaseConfigError };
});

vi.mock("@/lib/supabase/middleware", () => ({
  createMiddlewareSupabaseClient: () => {
    if (mocks.configurationError) {
      throw mocks.configurationError;
    }
    return {
      auth: {
        getUser: async () => ({ data: { user: mocks.user } }),
      },
    };
  },
}));

import { middleware } from "./middleware";
import { SupabaseConfigError } from "@/lib/supabase/env";

function request(path: string, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    headers: cookie ? { cookie } : undefined,
  });
}

async function run(path: string, cookie?: string) {
  return middleware(request(path, cookie));
}

function locationOf(response: Response): string {
  return response.headers.get("location") ?? "";
}

beforeEach(() => {
  mocks.user = null;
  mocks.configurationError = null;
});

describe("middleware — anonymous visitors", () => {
  it("returns a clear JSON 500 when Supabase public configuration is missing", async () => {
    mocks.configurationError = new SupabaseConfigError(
      "Set the missing environment variable(s): NEXT_PUBLIC_SUPABASE_URL.",
    );

    const response = await run("/dashboard");

    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({
      error: "server_configuration_error",
      message: expect.stringContaining("NEXT_PUBLIC_SUPABASE_URL"),
    });
  });

  it("redirects private pages to /login with a safe return destination", async () => {
    const response = await run("/dashboard");
    expect(response.status).toBe(307);
    expect(locationOf(response)).toBe("http://localhost/login?next=%2Fdashboard");
  });

  it("preserves the query string in the return destination", async () => {
    const response = await run("/log?search=MON-001");
    expect(locationOf(response)).toBe(
      "http://localhost/login?next=%2Flog%3Fsearch%3DMON-001",
    );
  });

  it("returns JSON 401 for API requests instead of an HTML redirect", async () => {
    const response = await run("/api/assets");
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toContain("application/json");
    const body = await response.json();
    expect(body.error).toBe("unauthorized");
    expect(locationOf(response)).toBe("");
  });

  it("returns JSON 401 for the removed public user directory", async () => {
    const response = await run("/api/auth/users");
    expect(response.status).toBe(401);
  });

  it("returns JSON 401 for the removed passwordless login endpoint", async () => {
    const response = await run("/api/auth/login", "af_session=legacy-token");
    expect(response.status).toBe(401);
  });

  it("allows the auth screens and callbacks", async () => {
    for (const path of [
      "/login",
      "/signup",
      "/forgot-password",
      "/reset-password",
      "/auth/callback",
      "/auth/confirm",
    ]) {
      const response = await run(path);
      expect(response.status, path).toBe(200);
      expect(locationOf(response), path).toBe("");
    }
  });

  it("allows the logout endpoint so expired sessions can still clear state", async () => {
    const response = await run("/api/auth/logout");
    expect(response.status).toBe(200);
  });

  it("redirects the landing page to sign-in", async () => {
    const response = await run("/");
    expect(locationOf(response)).toBe("http://localhost/login");
  });
});

describe("middleware — legacy mock session cookie", () => {
  it("never grants access and actively clears the old cookie", async () => {
    const response = await run("/dashboard", "af_session=usr_john_smith.forged");

    expect(response.status).toBe(307);
    expect(locationOf(response)).toBe("http://localhost/login?next=%2Fdashboard");
    expect(response.cookies.get("af_session")?.value).toBe("");
  });

  it("clears the legacy cookie even on public pages", async () => {
    const response = await run("/login", "af_session=usr_john_smith.forged");
    expect(response.status).toBe(200);
    expect(response.cookies.get("af_session")?.value).toBe("");
  });
});

describe("middleware — authenticated visitors", () => {
  beforeEach(() => {
    mocks.user = { id: "sb-user-1", email: "jane@company.com" };
  });

  it("allows private pages", async () => {
    for (const path of [
      "/dashboard",
      "/assets",
      "/scanner",
      "/log",
      "/settings",
      "/integrations",
      "/developer",
      "/api/assets",
      "/api/dashboard",
      "/api/scan",
      "/api/me",
    ]) {
      const response = await run(path);
      expect(response.status, path).toBe(200);
      expect(locationOf(response), path).toBe("");
    }
  });

  it("sends signed-in visitors away from the sign-in screen", async () => {
    const response = await run("/login");
    expect(locationOf(response)).toBe("http://localhost/dashboard");
  });

  it("honours a validated return destination on the sign-in screen", async () => {
    const response = await run(`/login?next=${encodeURIComponent("/assets")}`);
    expect(locationOf(response)).toBe("http://localhost/assets");
  });

  it("ignores a hostile return destination on the sign-in screen", async () => {
    const response = await run(`/login?next=${encodeURIComponent("//evil.com")}`);
    expect(locationOf(response)).toBe("http://localhost/dashboard");
  });

  it("redirects the landing page to the dashboard", async () => {
    const response = await run("/");
    expect(locationOf(response)).toBe("http://localhost/dashboard");
  });

  it("still allows the recovery screens while signed in", async () => {
    for (const path of ["/reset-password", "/forgot-password"]) {
      const response = await run(path);
      expect(response.status, path).toBe(200);
    }
  });
});

describe("middleware — static assets", () => {
  it("bypasses auth entirely for static files", async () => {
    for (const path of ["/main-logo.png", "/favicon.ico", "/splash.mp4", "/_next/static/app.js"]) {
      const response = await run(path);
      expect(response.status, path).toBe(200);
      expect(locationOf(response), path).toBe("");
    }
  });
});
