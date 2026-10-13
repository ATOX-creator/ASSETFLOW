/**
 * Pure, edge-safe helpers for deciding where a visitor may go next.
 *
 * Everything here runs in middleware, route handlers, and client components,
 * so it must stay dependency-free (no Node APIs, no Supabase imports).
 */

/** Pages that render authentication forms and must stay reachable signed out. */
export const AUTH_PAGE_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
] as const;

/** Machine endpoints belonging to the sign-in / sign-up / recovery flows. */
export const AUTH_CALLBACK_PATHS = ["/auth/callback", "/auth/confirm"] as const;

/** Pages that must not be shown to an authenticated visitor. */
export const SIGNED_IN_HIDDEN_PATHS = ["/login", "/signup"] as const;

export const DEFAULT_AUTH_DESTINATION = "/dashboard";

/**
 * Legacy cookie minted by the removed mock/HMAC session signer. It is no
 * longer read by anything — it is actively cleared so an old cookie can never
 * be mistaken for a session.
 */
export const LEGACY_SESSION_COOKIE = "af_session";

function hasControlCharacters(value: string): boolean {
  return /[\u0000-\u001f\u007f]/.test(value);
}

function decodeOnce(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Validates a post-login destination and falls back to the dashboard.
 *
 * Only same-origin, single-slash paths are accepted so a crafted `next`
 * parameter can never turn a login redirect into an open redirect
 * (`//evil.com`, `/\evil.com`, percent-encoded variants, absolute URLs,
 * or header-injection payloads).
 */
export function safeNextPath(
  value: string | null | undefined,
  fallback: string = DEFAULT_AUTH_DESTINATION,
): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048) {
    return fallback;
  }
  if (hasControlCharacters(trimmed)) {
    return fallback;
  }

  const candidates = [trimmed, decodeOnce(trimmed), decodeOnce(decodeOnce(trimmed))];
  for (const candidate of candidates) {
    if (hasControlCharacters(candidate)) {
      return fallback;
    }
    if (!candidate.startsWith("/")) {
      return fallback;
    }
    if (candidate.startsWith("//") || candidate.startsWith("/\\")) {
      return fallback;
    }
    if (candidate.includes("\\")) {
      return fallback;
    }
  }

  return trimmed;
}

/** True for the sign-in / sign-up / recovery screens and their callbacks. */
export function isAuthPublicPath(pathname: string): boolean {
  return (
    AUTH_PAGE_PATHS.includes(pathname as (typeof AUTH_PAGE_PATHS)[number]) ||
    AUTH_CALLBACK_PATHS.includes(pathname as (typeof AUTH_CALLBACK_PATHS)[number])
  );
}

/** True for paths that signed-in visitors should not see. */
export function isSignedInHiddenPath(pathname: string): boolean {
  return SIGNED_IN_HIDDEN_PATHS.includes(
    pathname as (typeof SIGNED_IN_HIDDEN_PATHS)[number],
  );
}

/** Static files that never need a session check. */
export function isStaticAssetPath(pathname: string): boolean {
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return true;
  }
  return /\.(?:svg|png|jpe?g|ico|webp|avif|mp4|webm|txt|map|css|js|woff2?)$/i.test(
    pathname,
  );
}
