/**
 * Single source of truth for the public Supabase configuration.
 *
 * Only the publishable credentials are read here:
 *   - NEXT_PUBLIC_SUPABASE_URL          (project URL, safe for the browser)
 *   - NEXT_PUBLIC_SUPABASE_ANON_KEY     (anon/publishable key, safe for the browser)
 *   - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (fallback name used by newer projects)
 *
 * The service-role / secret keys are never read by this module and must never
 * be referenced from browser code. Missing values fail fast with the variable
 * names only — values are never included in messages or logs.
 */
export interface SupabasePublicConfig {
  url: string;
  key: string;
}

function readEnv(name: string): string {
  // Direct member access keeps Next.js static inlining working for NEXT_PUBLIC_*.
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

export function getSupabasePublicConfig(): SupabasePublicConfig {
  const url = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key =
    readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
    readEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  if (!url || !key) {
    const missing = [
      !url ? "NEXT_PUBLIC_SUPABASE_URL" : null,
      !key ? "NEXT_PUBLIC_SUPABASE_ANON_KEY" : null,
    ]
      .filter(Boolean)
      .join(", ");
    throw new Error(
      `Supabase is not configured. Set the missing environment variable(s): ${missing}.`,
    );
  }

  return { url, key };
}
