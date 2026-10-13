import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "./env";

let browserClient: SupabaseClient | null = null;

/**
 * Supabase client for client components (browser only).
 *
 * Uses the public project URL and publishable/anon key. The session lives in
 * httpOnly cookies managed by `@supabase/ssr`; nothing token-shaped is ever
 * exposed to JavaScript storage.
 */
export function createBrowserSupabaseClient(): SupabaseClient {
  if (browserClient) {
    return browserClient;
  }
  const { url, key } = getSupabasePublicConfig();
  browserClient = createBrowserClient(url, key);
  return browserClient;
}
