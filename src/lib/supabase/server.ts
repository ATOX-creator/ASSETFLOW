import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "./env";

/**
 * Supabase client for Server Components, Route Handlers, and Server Actions.
 *
 * The session is read from and written to the request cookies using the
 * supported `@supabase/ssr` pattern. `getUser()` on this client verifies the
 * JWT against the Supabase Auth API, so the identity is never taken on trust
 * from a cookie value alone.
 */
export async function createServerSupabaseClient(): Promise<SupabaseClient> {
  const store = await cookies();
  const { url, key } = getSupabasePublicConfig();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            store.set(name, value, options);
          }
        } catch {
          // Called from a Server Component where cookies are read-only; the
          // middleware refresh path writes them instead.
        }
      },
    },
  });
}
