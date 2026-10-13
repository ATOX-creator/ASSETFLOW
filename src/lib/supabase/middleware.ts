import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { getSupabasePublicConfig } from "./env";

/**
 * Supabase client used inside the Next.js middleware (Edge runtime).
 *
 * It reads the session cookies from the incoming request and writes any
 * refreshed tokens back onto the response, which is the supported way to keep
 * sessions alive on every navigation for `@supabase/ssr`.
 */
export function createMiddlewareSupabaseClient(
  request: NextRequest,
  response: NextResponse,
): ReturnType<typeof createServerClient> {
  const { url, key } = getSupabasePublicConfig();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set({ name, value });
            response.cookies.set(name, value, options);
          }
        } catch {
          // The response is always writable here; guard keeps middleware
          // from ever throwing while refreshing a session.
        }
      },
    },
  });
}
