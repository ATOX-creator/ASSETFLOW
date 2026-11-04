import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareSupabaseClient } from "@/lib/supabase/middleware";
import { SupabaseConfigError } from "@/lib/supabase/env";
import {
  DEFAULT_AUTH_DESTINATION,
  LEGACY_SESSION_COOKIE,
  isAuthPublicPath,
  isSignedInHiddenPath,
  isStaticAssetPath,
  safeNextPath,
} from "@/lib/auth/redirect";

/**
 * Server-enforced protection for every private screen and API route.
 *
 * The Supabase session is read (and transparently refreshed) on every matched
 * request using the supported `@supabase/ssr` middleware pattern. Client-side
 * checks and hidden navigation items are convenience only — this file, the
 * (app) route-group layout, and each route handler's `requireUser()` call are
 * the actual enforcement layers.
 */

const PUBLIC_API_PATHS = new Set<string>([
  // Signing out must work even when the session already expired.
  "/api/auth/logout",
]);

/** Copies refreshed auth cookies onto a redirect response. */
function withSessionCookies(target: NextResponse, source: NextResponse): NextResponse {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie);
  }
  return target;
}

function redirectTo(request: NextRequest, response: NextResponse, target: string): NextResponse {
  const url = request.nextUrl.clone();
  const queryAt = target.indexOf("?");
  url.pathname = queryAt === -1 ? target : target.slice(0, queryAt);
  url.search = queryAt === -1 ? "" : target.slice(queryAt);
  return withSessionCookies(NextResponse.redirect(url), response);
}

function unauthorisedApi(response: NextResponse): NextResponse {
  const payload = NextResponse.json(
    { error: "unauthorized", message: "Authentication required." },
    { status: 401 },
  );
  // Keep any cookie housekeeping (legacy cleanup, cleared refresh tokens).
  return withSessionCookies(payload, response);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isStaticAssetPath(pathname)) {
    return NextResponse.next();
  }

  // Scratch response that carries any refreshed session cookies.
  const response = NextResponse.next();

  // Actively drop the cookie minted by the removed mock session signer so a
  // stale `af_session` value can never be mistaken for access.
  if (request.cookies.has(LEGACY_SESSION_COOKIE)) {
    response.cookies.set(LEGACY_SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }

  let user;
  try {
    const supabase = createMiddlewareSupabaseClient(request, response);
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      return NextResponse.json(
        {
          error: "server_configuration_error",
          message: error.message,
        },
        { status: 500 },
      );
    }
    throw error;
  }

  const isApi = pathname.startsWith("/api/");

  if (user) {
    // Authenticated visitors do not see the sign-in / sign-up screens.
    if (isSignedInHiddenPath(pathname)) {
      const next = safeNextPath(request.nextUrl.searchParams.get("next"));
      return redirectTo(request, response, next);
    }
    if (pathname === "/") {
      return redirectTo(request, response, DEFAULT_AUTH_DESTINATION);
    }
    return response;
  }

  // Anonymous visitors may use the auth screens, their callbacks, and the
  // public API allowlist. Everything else is refused at the edge.
  if (isAuthPublicPath(pathname) || PUBLIC_API_PATHS.has(pathname)) {
    return response;
  }

  if (isApi) {
    return unauthorisedApi(response);
  }

  const nextSearch =
    pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
  return redirectTo(request, response, `/login${nextSearch}`);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
