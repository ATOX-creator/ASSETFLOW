import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exchange: vi.fn(),
  verifyOtp: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: (...args: unknown[]) => mocks.createClient(...args),
}));

import { NextRequest } from "next/server";
import { GET } from "./route";
import * as confirmRoute from "@/app/auth/confirm/route";

function request(url: string): NextRequest {
  return new NextRequest(url);
}

function locationOf(response: Response): string {
  return new URL(response.headers.get("location") ?? "", "http://localhost").toString();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({
    auth: {
      exchangeCodeForSession: mocks.exchange,
      verifyOtp: mocks.verifyOtp,
    },
  });
  mocks.exchange.mockResolvedValue({ data: {}, error: null });
  mocks.verifyOtp.mockResolvedValue({ data: {}, error: null });
});

describe("GET /auth/callback", () => {
  it("exchanges a PKCE code and continues to the validated destination", async () => {
    const response = await GET(
      request("http://localhost/auth/callback?code=sb-code&next=%2Fassets"),
    );

    expect(mocks.exchange).toHaveBeenCalledWith("sb-code");
    expect(response.status).toBe(307);
    expect(locationOf(response)).toBe("http://localhost/assets");
  });

  it("falls back to the dashboard when no next is given", async () => {
    const response = await GET(request("http://localhost/auth/callback?code=sb-code"));
    expect(locationOf(response)).toBe("http://localhost/dashboard");
  });

  it("blocks open redirects in the next parameter", async () => {
    const response = await GET(
      request(
        `http://localhost/auth/callback?code=sb-code&next=${encodeURIComponent("//evil.com")}`,
      ),
    );
    expect(locationOf(response)).toBe("http://localhost/dashboard");
  });

  it("handles a cancelled Google sign-in gracefully", async () => {
    const response = await GET(
      request("http://localhost/auth/callback?error=access_denied&error_description=User+cancelled"),
    );

    expect(mocks.exchange).not.toHaveBeenCalled();
    expect(locationOf(response)).toBe("http://localhost/login?error=access_denied");
  });

  it("sends exchange failures to sign-in with a fixed error code", async () => {
    mocks.exchange.mockResolvedValue({
      data: {},
      error: { code: "bad_code", message: "boom" },
    });

    const response = await GET(
      request("http://localhost/auth/callback?code=expired-code"),
    );
    expect(locationOf(response)).toBe("http://localhost/login?error=callback_failed");
  });

  it("rejects a callback without a code", async () => {
    const response = await GET(request("http://localhost/auth/callback"));
    expect(locationOf(response)).toBe("http://localhost/login?error=missing_code");
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it("never redirects off-origin", async () => {
    const response = await GET(
      request(
        `http://localhost/auth/callback?code=sb-code&next=${encodeURIComponent("https://evil.com")}`,
      ),
    );
    const target = locationOf(response);
    expect(target.startsWith("http://localhost/")).toBe(true);
  });

  it("falls back to sign-in when the server client cannot be created", async () => {
    mocks.createClient.mockRejectedValueOnce(new Error("not configured"));

    const response = await GET(
      request("http://localhost/auth/callback?code=sb-code"),
    );
    expect(locationOf(response)).toBe("http://localhost/login?error=callback_failed");
  });

  it("supports token_hash confirmation links", async () => {
    const response = await GET(
      request("http://localhost/auth/callback?token_hash=th&type=signup"),
    );

    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      type: "signup",
      token_hash: "th",
    });
    expect(locationOf(response)).toBe("http://localhost/dashboard");
  });

  it("reports expired confirmation links", async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: {},
      error: { code: "otp_expired", message: "Token has expired" },
    });

    const response = await GET(
      request("http://localhost/auth/callback?token_hash=th&type=recovery"),
    );
    expect(locationOf(response)).toBe("http://localhost/login?error=link_expired");
  });

  it("ignores unsupported confirmation types", async () => {
    const response = await GET(
      request("http://localhost/auth/callback?token_hash=th&type=admin_grant"),
    );
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
    expect(locationOf(response)).toBe("http://localhost/login?error=missing_code");
  });
});

describe("GET /auth/confirm", () => {
  it("verifies a recovery link and lands on the reset screen", async () => {
    const response = await confirmRoute.GET(
      request(
        "http://localhost/auth/confirm?token_hash=th&type=recovery&next=%2Freset-password",
      ),
    );

    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      type: "recovery",
      token_hash: "th",
    });
    expect(locationOf(response)).toBe("http://localhost/reset-password");
  });

  it("reports failed confirmations on the sign-in screen", async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: {},
      error: { code: "otp_error", message: "invalid" },
    });

    const response = await confirmRoute.GET(
      request("http://localhost/auth/confirm?token_hash=th&type=signup"),
    );
    expect(locationOf(response)).toBe("http://localhost/login?error=confirm_failed");
  });
});
