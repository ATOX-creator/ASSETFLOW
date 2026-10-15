import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  authCallbackUrl,
  authErrorKey,
  authQueryErrorKey,
  hasActiveSession,
  requestPasswordReset,
  resendConfirmationEmail,
  signInWithEmail,
  signUpWithEmail,
  startGoogleSignIn,
  updatePassword,
} from "./forms";

function createMockClient() {
  return {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      resend: vi.fn(),
      updateUser: vi.fn(),
      getSession: vi.fn(),
    },
  };
}

type MockClient = ReturnType<typeof createMockClient>;

function client(mock: MockClient): SupabaseClient {
  return mock as unknown as SupabaseClient;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("authErrorKey", () => {
  it("maps known provider codes to translation keys", () => {
    expect(authErrorKey("invalid_credentials")).toBe("auth.invalidCredentials");
    expect(authErrorKey("email_not_confirmed")).toBe("auth.emailNotConfirmed");
    expect(authErrorKey("user_already_exists")).toBe("auth.accountExists");
    expect(authErrorKey("weak_password")).toBe("auth.weakPassword");
    expect(authErrorKey("over_email_send_rate_limit")).toBe("auth.rateLimited");
    expect(authErrorKey("same_password")).toBe("auth.samePassword");
    expect(authErrorKey("signup_disabled")).toBe("auth.signUpDisabled");
  });

  it("never exposes unknown provider messages verbatim", () => {
    expect(authErrorKey("some_provider_internal", "boom")).toBe("auth.genericError");
    expect(authErrorKey(undefined, "Failed to fetch")).toBe("auth.networkError");
  });

  it("maps callback error codes emitted by the auth routes", () => {
    expect(authQueryErrorKey("access_denied")).toBe("auth.oauthCancelled");
    expect(authQueryErrorKey("callback_failed")).toBe("auth.callbackError");
    expect(authQueryErrorKey("link_expired")).toBe("auth.linkExpired");
    expect(authQueryErrorKey(null)).toBeNull();
  });
});

describe("authCallbackUrl", () => {
  it("builds a same-origin callback with a sanitised destination", () => {
    expect(authCallbackUrl("/assets", "https://app.example.com")).toBe(
      "https://app.example.com/auth/callback?next=%2Fassets",
    );
  });

  it("falls back to the dashboard for hostile destinations", () => {
    expect(authCallbackUrl("//evil.com", "https://app.example.com")).toBe(
      "https://app.example.com/auth/callback?next=%2Fdashboard",
    );
    expect(authCallbackUrl(null, "https://app.example.com/")).toBe(
      "https://app.example.com/auth/callback?next=%2Fdashboard",
    );
  });
});

describe("signInWithEmail", () => {
  it("succeeds with valid credentials", async () => {
    const mock = createMockClient();
    mock.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });

    const result = await signInWithEmail(
      { email: " jane@company.com ", password: "secret-pass" },
      client(mock),
    );

    expect(result).toEqual({ ok: true });
    expect(mock.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "jane@company.com",
      password: "secret-pass",
    });
  });

  it("reports invalid credentials without leaking provider details", async () => {
    const mock = createMockClient();
    mock.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { code: "invalid_credentials", message: "supabase-internal-detail" },
    });

    const result = await signInWithEmail(
      { email: "jane@company.com", password: "wrong" },
      client(mock),
    );

    expect(result.ok).toBe(false);
    expect(result.messageKey).toBe("auth.invalidCredentials");
    expect(JSON.stringify(result)).not.toContain("supabase-internal-detail");
  });

  it("surfaces a friendly error when email confirmation is missing", async () => {
    const mock = createMockClient();
    mock.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { code: "email_not_confirmed", message: "confirm" },
    });

    const result = await signInWithEmail(
      { email: "jane@company.com", password: "secret-pass" },
      client(mock),
    );
    expect(result.messageKey).toBe("auth.emailNotConfirmed");
  });
});

describe("signUpWithEmail", () => {
  it("detects the confirmation-required response", async () => {
    const mock = createMockClient();
    mock.auth.signUp.mockResolvedValue({
      data: { session: null, user: { id: "u1" } },
      error: null,
    });

    const result = await signUpWithEmail(
      { name: "Jane", email: "jane@company.com", password: "secret-pass" },
      client(mock),
    );

    expect(result).toEqual({ ok: true, needsConfirmation: true });
  });

  it("treats an active session as immediate sign-in", async () => {
    const mock = createMockClient();
    mock.auth.signUp.mockResolvedValue({
      data: { session: { access_token: "x" }, user: { id: "u1" } },
      error: null,
    });

    const result = await signUpWithEmail(
      { name: "Jane", email: "jane@company.com", password: "secret-pass" },
      client(mock),
    );
    expect(result).toEqual({ ok: true });
    expect(result.needsConfirmation).toBeUndefined();
  });

  it("never sends a role or other privileged fields", async () => {
    const mock = createMockClient();
    mock.auth.signUp.mockResolvedValue({ data: { session: null }, error: null });

    await signUpWithEmail(
      { name: "Jane", email: "jane@company.com", password: "secret-pass" },
      client(mock),
    );

    const payload = mock.auth.signUp.mock.calls[0][0] as {
      options?: { data?: Record<string, unknown>; emailRedirectTo?: string };
    };
    expect(payload.options?.data).toEqual({ full_name: "Jane" });
    expect(payload.options?.data).not.toHaveProperty("role");
    expect(payload.options?.emailRedirectTo).toContain("/auth/callback");
  });

  it("reports duplicate accounts", async () => {
    const mock = createMockClient();
    mock.auth.signUp.mockResolvedValue({
      data: {},
      error: { code: "user_already_exists", message: "exists" },
    });

    const result = await signUpWithEmail(
      { name: "Jane", email: "jane@company.com", password: "secret-pass" },
      client(mock),
    );
    expect(result.ok).toBe(false);
    expect(result.messageKey).toBe("auth.accountExists");
  });
});

describe("resendConfirmationEmail", () => {
  it("re-sends the sign-up confirmation with a safe redirect", async () => {
    const mock = createMockClient();
    mock.auth.resend.mockResolvedValue({ data: {}, error: null });

    const result = await resendConfirmationEmail(" jane@company.com ", client(mock));

    expect(result).toEqual({ ok: true, messageKey: "auth.resendSent" });
    expect(mock.auth.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "jane@company.com",
      options: { emailRedirectTo: expect.stringContaining("/auth/callback") },
    });
  });

  it("answers exactly the same for an address with no account", async () => {
    const mock = createMockClient();
    mock.auth.resend.mockResolvedValue({
      data: {},
      error: { code: "user_not_found", message: "no such user" },
    });

    const result = await resendConfirmationEmail("nobody@company.com", client(mock));

    expect(result).toEqual({ ok: true, messageKey: "auth.resendSent" });
    expect(JSON.stringify(result)).not.toContain("no such user");
  });

  it("reports rate limiting as a failure", async () => {
    const mock = createMockClient();
    mock.auth.resend.mockResolvedValue({
      data: {},
      error: { code: "over_email_send_rate_limit", message: "wait" },
    });

    const result = await resendConfirmationEmail("jane@company.com", client(mock));

    expect(result).toEqual({ ok: false, messageKey: "auth.rateLimited" });
  });

  it("never claims the mail was sent when delivery failed", async () => {
    const mock = createMockClient();
    mock.auth.resend.mockResolvedValue({
      data: {},
      error: { code: "email_send_failed", message: "smtp unavailable" },
    });

    const result = await resendConfirmationEmail("jane@company.com", client(mock));

    expect(result.ok).toBe(false);
    expect(result.messageKey).toBe("auth.genericError");
    expect(JSON.stringify(result)).not.toContain("smtp unavailable");
  });

  it("maps network failures thrown by the client", async () => {
    const mock = createMockClient();
    mock.auth.resend.mockRejectedValue(new TypeError("Failed to fetch"));

    const result = await resendConfirmationEmail("jane@company.com", client(mock));

    expect(result).toEqual({ ok: false, messageKey: "auth.networkError" });
  });
});

describe("requestPasswordReset", () => {
  it("returns a generic success for unknown accounts", async () => {
    const mock = createMockClient();
    mock.auth.resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: { code: "user_not_found", message: "not found" },
    });

    const result = await requestPasswordReset("nobody@company.com", client(mock));

    expect(result.ok).toBe(true);
    expect(result.messageKey).toBe("auth.resetSentBody");
    expect(JSON.stringify(result)).not.toContain("not found");
  });

  it("returns generic success when Supabase accepts the request", async () => {
    const mock = createMockClient();
    mock.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    const result = await requestPasswordReset("jane@company.com", client(mock));

    expect(result.ok).toBe(true);
    expect(result.messageKey).toBe("auth.resetSentBody");
    expect(mock.auth.resetPasswordForEmail).toHaveBeenCalledWith("jane@company.com", {
      redirectTo: expect.stringContaining("/auth/callback?next=%2Freset-password"),
    });
  });

  it("reports rate limiting and network failures", async () => {
    const mock = createMockClient();
    mock.auth.resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: { code: "over_email_send_rate_limit", message: "wait" },
    });
    const limited = await requestPasswordReset("jane@company.com", client(mock));
    expect(limited.ok).toBe(false);
    expect(limited.messageKey).toBe("auth.rateLimited");

    mock.auth.resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: { code: "retryable_fetch_failed", message: "Failed to fetch" },
    });
    const offline = await requestPasswordReset("jane@company.com", client(mock));
    expect(offline.ok).toBe(false);
    expect(offline.messageKey).toBe("auth.networkError");
  });
});

describe("startGoogleSignIn", () => {
  it("starts the Google OAuth flow through Supabase with a safe redirect", async () => {
    const mock = createMockClient();
    mock.auth.signInWithOAuth.mockResolvedValue({ data: { url: "https://google" }, error: null });

    const result = await startGoogleSignIn("/assets", client(mock));

    expect(result.ok).toBe(true);
    expect(mock.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: expect.stringMatching(/\/auth\/callback\?next=%2Fassets$/),
      },
    });
  });

  it("sanitises hostile destinations before starting OAuth", async () => {
    const mock = createMockClient();
    mock.auth.signInWithOAuth.mockResolvedValue({ data: {}, error: null });

    await startGoogleSignIn("//evil.com", client(mock));

    const call = mock.auth.signInWithOAuth.mock.calls[0][0] as {
      options: { redirectTo: string };
    };
    expect(call.options.redirectTo).toContain("next=%2Fdashboard");
    expect(call.options.redirectTo).not.toContain("evil.com");
  });

  it("reports provider failures", async () => {
    const mock = createMockClient();
    mock.auth.signInWithOAuth.mockResolvedValue({
      data: {},
      error: { code: "provider_email_needs_verification", message: "nope" },
    });

    const result = await startGoogleSignIn(null, client(mock));
    expect(result.ok).toBe(false);
    expect(result.messageKey).toBe("auth.oauthFailed");
  });
});

describe("updatePassword / hasActiveSession", () => {
  it("completes the reset when Supabase accepts the new password", async () => {
    const mock = createMockClient();
    mock.auth.updateUser.mockResolvedValue({ data: {}, error: null });

    const result = await updatePassword("a strong new password", client(mock));
    expect(result.ok).toBe(true);
    expect(mock.auth.updateUser).toHaveBeenCalledWith({
      password: "a strong new password",
    });
  });

  it("reports rejected password updates", async () => {
    const mock = createMockClient();
    mock.auth.updateUser.mockResolvedValue({
      data: {},
      error: { code: "weak_password", message: "weak" },
    });

    const result = await updatePassword("123", client(mock));
    expect(result.ok).toBe(false);
    expect(result.messageKey).toBe("auth.weakPassword");
  });

  it("detects the presence of a recovery session", async () => {
    const mock = createMockClient();
    mock.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    expect(await hasActiveSession(client(mock))).toBe(false);

    mock.auth.getSession.mockResolvedValue({
      data: { session: { access_token: "x" } },
      error: null,
    });
    expect(await hasActiveSession(client(mock))).toBe(true);
  });

  it("treats client failures as no session", async () => {
    const mock = createMockClient();
    mock.auth.getSession.mockRejectedValue(new Error("boom"));
    expect(await hasActiveSession(client(mock))).toBe(false);
  });
});
