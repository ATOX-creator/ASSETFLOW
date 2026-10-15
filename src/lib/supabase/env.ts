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

/**
 * Raised when the public Supabase configuration is missing or unusable.
 *
 * Callers must let this propagate (500 + server log) instead of catching it
 * alongside session errors: a misconfigured environment is a server fault,
 * not a signed-out visitor.
 */
export class SupabaseConfigError extends Error {
  constructor(detail: string) {
    super(`Supabase is not configured. ${detail}`);
    this.name = "SupabaseConfigError";
  }
}

function readValue(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export function getSupabasePublicConfig(): SupabasePublicConfig {
  // Explicit `process.env.NEXT_PUBLIC_*` member access is required: Next.js
  // statically inlines these at build time only when the variable name is a
  // literal. A dynamic lookup like `process.env[name]` is left untouched by
  // the compiler and evaluates to undefined in the browser bundle.
  const url = readValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key =
    readValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    readValue(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  if (!url || !key) {
    const missing = [
      !url ? "NEXT_PUBLIC_SUPABASE_URL" : null,
      !key ? "NEXT_PUBLIC_SUPABASE_ANON_KEY" : null,
    ]
      .filter(Boolean)
      .join(", ");
    throw new SupabaseConfigError(`Set the missing environment variable(s): ${missing}.`);
  }

  return { url, key };
}
