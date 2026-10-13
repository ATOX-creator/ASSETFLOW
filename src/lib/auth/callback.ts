import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_AUTH_DESTINATION, safeNextPath } from "./redirect";

/** Redirect codes surfaced to `/login` as `?error=…` (fixed strings only). */
export type AuthRedirectErrorCode =
  | "access_denied"
  | "callback_failed"
  | "missing_code"
  | "confirm_failed"
  | "link_expired";

export interface AuthCallbackOutcome {
  /** True when a session was established and the visitor may continue. */
  ok: boolean;
  /** Same-origin path to redirect to (never an absolute/external URL). */
  location: string;
}

const CONFIRMABLE_TYPES = new Set([
  "signup",
  "login",
  "recovery",
  "email_change",
  "magiclink",
  "email",
]);

function loginError(code: AuthRedirectErrorCode): AuthCallbackOutcome {
  return { ok: false, location: `/login?error=${code}` };
}

/**
 * Completes an authentication hand-off described by the query string.
 *
 * Handles, in order:
 *  1. provider errors (Google cancellation, provider configuration problems),
 *  2. PKCE authorization codes (`?code=`) — the OAuth and e-mail redirect flow,
 *  3. template confirmation links (`?token_hash=&type=`).
 *
 * The final destination is sanitised with `safeNextPath`, so a crafted
 * `next` value can never send a signed-in user off-site.
 */
export async function completeAuthFromQuery(
  supabase: SupabaseClient,
  params: URLSearchParams,
  fallbackNext: string = DEFAULT_AUTH_DESTINATION,
): Promise<AuthCallbackOutcome> {
  const providerError = params.get("error");
  if (providerError) {
    return loginError(
      providerError === "access_denied" || providerError === "provider_error"
        ? "access_denied"
        : "callback_failed",
    );
  }

  const next = safeNextPath(params.get("next"), fallbackNext);

  const code = params.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return loginError("callback_failed");
    }
    return { ok: true, location: next };
  }

  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  if (tokenHash && type && CONFIRMABLE_TYPES.has(type)) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as Parameters<SupabaseClient["auth"]["verifyOtp"]>[0]["type"],
      token_hash: tokenHash,
    });
    if (error) {
      const expired =
        error.code === "otp_expired" || /expired/i.test(error.message ?? "");
      return loginError(expired ? "link_expired" : "confirm_failed");
    }
    return { ok: true, location: next };
  }

  return loginError("missing_code");
}
