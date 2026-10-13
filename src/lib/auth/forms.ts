import type { SupabaseClient } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { DEFAULT_AUTH_DESTINATION, safeNextPath } from "./redirect";

/**
 * Client-side Supabase Auth operations shared by the sign-in, sign-up,
 * recovery, and password-reset screens.
 *
 * Every function returns i18n *keys* (never raw provider messages) so the UI
 * can render translated, user-friendly copy without leaking provider or
 * configuration details.
 */

export interface AuthResult {
  ok: boolean;
  /** i18n key for the outcome message, when the caller should show one. */
  messageKey?: string;
  /** Sign-up succeeded but the address must be verified before sign-in. */
  needsConfirmation?: boolean;
}

const NETWORK_ERROR_PATTERN = /failed to fetch|networkerror|load failed|fetch failed/i;
/** Translates a Supabase Auth error code into a translation key. */
export function authErrorKey(code?: string | null, message?: string | null): string {
  const normalized = (code ?? "").toLowerCase();
  switch (normalized) {
    case "invalid_credentials":
    case "invalid_login_credentials":
      return "auth.invalidCredentials";
    case "email_not_confirmed":
      return "auth.emailNotConfirmed";
    case "user_already_exists":
    case "user_identities_already_exists":
    case "email_exists":
      return "auth.accountExists";
    case "weak_password":
    case "password_too_short":
      return "auth.weakPassword";
    case "over_email_send_rate_limit":
    case "rate_limit_exceeded":
    case "email_rate_limit_exceeded":
      return "auth.rateLimited";
    case "email_invalid":
    case "validation_failed":
      return "auth.validation.emailInvalid";
    case "same_password":
      return "auth.samePassword";
    case "signup_disabled":
      return "auth.signUpDisabled";
    case "user_not_found":
      // Never disclose whether an address has an account.
      return "auth.invalidCredentials";
    default:
      break;
  }
  if (message && NETWORK_ERROR_PATTERN.test(message)) {
    return "auth.networkError";
  }
  return "auth.genericError";
}

/** Maps the `?error=` codes emitted by the callback/confirm routes. */
export function authQueryErrorKey(code: string | null | undefined): string | null {
  switch ((code ?? "").toLowerCase()) {
    case "access_denied":
    case "provider_error":
      return "auth.oauthCancelled";
    case "callback_failed":
    case "missing_code":
      return "auth.callbackError";
    case "confirm_failed":
    case "link_expired":
      return "auth.linkExpired";
    default:
      return code ? "auth.genericError" : null;
  }
}

/** Application origin used for OAuth / email redirect targets. */
export function appOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "http://localhost:3000";
}

/**
 * Builds the validated Supabase Auth callback URL.
 * `next` is sanitised so a crafted value can never produce an open redirect.
 */
export function authCallbackUrl(
  next?: string | null,
  origin: string = appOrigin(),
): string {
  const target = safeNextPath(next ?? DEFAULT_AUTH_DESTINATION);
  return `${origin.replace(/\/+$/, "")}/auth/callback?next=${encodeURIComponent(target)}`;
}

export async function signInWithEmail(
  input: { email: string; password: string },
  client: SupabaseClient = createBrowserSupabaseClient(),
): Promise<AuthResult> {
  try {
    const { error } = await client.auth.signInWithPassword({
      email: input.email.trim(),
      password: input.password,
    });
    if (error) {
      return { ok: false, messageKey: authErrorKey(error.code, error.message) };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, messageKey: authErrorKey(undefined, String(error)) };
  }
}

export async function signUpWithEmail(
  input: { name: string; email: string; password: string },
  client: SupabaseClient = createBrowserSupabaseClient(),
): Promise<AuthResult> {
  try {
    const { data, error } = await client.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        data: { full_name: input.name.trim() },
        emailRedirectTo: authCallbackUrl(DEFAULT_AUTH_DESTINATION),
      },
    });
    if (error) {
      return { ok: false, messageKey: authErrorKey(error.code, error.message) };
    }
    if (!data.session) {
      // Email confirmation is enabled on the project: no session yet.
      return { ok: true, needsConfirmation: true };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, messageKey: authErrorKey(undefined, String(error)) };
  }
}

/**
 * Starts password recovery.
 *
 * The result is deliberately generic: callers must show the same success copy
 * whether or not the address belongs to an account, so this function never
 * surfaces a "user not found" outcome.
 */
export async function requestPasswordReset(
  email: string,
  client: SupabaseClient = createBrowserSupabaseClient(),
): Promise<AuthResult> {
  try {
    const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: authCallbackUrl("/reset-password"),
    });
    if (error) {
      const key = authErrorKey(error.code, error.message);
      if (key === "auth.networkError" || key === "auth.rateLimited") {
        return { ok: false, messageKey: key };
      }
      // Anything else (including unknown-address errors) is reported as sent.
      return { ok: true, messageKey: "auth.resetSentBody" };
    }
    return { ok: true, messageKey: "auth.resetSentBody" };
  } catch (error) {
    return { ok: false, messageKey: authErrorKey(undefined, String(error)) };
  }
}

/** Starts the Google OAuth flow through Supabase Auth. */
export async function startGoogleSignIn(
  next?: string | null,
  client: SupabaseClient = createBrowserSupabaseClient(),
): Promise<AuthResult> {
  try {
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: authCallbackUrl(next) },
    });
    if (error) {
      return { ok: false, messageKey: "auth.oauthFailed" };
    }
    // On success the browser navigates to Google; no further UI state needed.
    return { ok: true };
  } catch (error) {
    return { ok: false, messageKey: authErrorKey(undefined, String(error)) };
  }
}

/** Completes the recovery flow by storing a new password on the session. */
export async function updatePassword(
  password: string,
  client: SupabaseClient = createBrowserSupabaseClient(),
): Promise<AuthResult> {
  try {
    const { error } = await client.auth.updateUser({ password });
    if (error) {
      return { ok: false, messageKey: authErrorKey(error.code, error.message) };
    }
    return { ok: true, messageKey: "auth.passwordUpdated" };
  } catch (error) {
    return { ok: false, messageKey: authErrorKey(undefined, String(error)) };
  }
}

/** True when a Supabase session (established by the recovery email) exists. */
export async function hasActiveSession(
  client: SupabaseClient = createBrowserSupabaseClient(),
): Promise<boolean> {
  try {
    const { data, error } = await client.auth.getSession();
    if (error) {
      return false;
    }
    return Boolean(data.session);
  } catch {
    return false;
  }
}
