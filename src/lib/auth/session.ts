import type { User as SupabaseUser } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensureProfile } from "./profile";
import type { UserRecord } from "@/lib/data";
import { ForbiddenError, UnauthorizedError } from "./errors";

export { ForbiddenError, UnauthorizedError };
export { LEGACY_SESSION_COOKIE, safeNextPath } from "./redirect";

/**
 * Resolves the Supabase Auth user for the current request.
 *
 * `supabase.auth.getUser()` verifies the session token against Supabase, so
 * the result is a server-verified identity — never a value supplied by the
 * browser. Returns `null` for anonymous requests.
 */
export async function getAuthUser(): Promise<SupabaseUser | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return null;
    }
    return data.user;
  } catch {
    return null;
  }
}

/**
 * Resolves the application profile for the verified identity, creating it on
 * first sign-in. Callers must never accept a user id coming from the request
 * body or headers.
 */
export async function getCurrentUser(): Promise<UserRecord | null> {
  const authUser = await getAuthUser();
  if (!authUser) {
    return null;
  }
  return ensureProfile(authUser);
}

/** Throws `UnauthorizedError` when no valid session is present. */
export async function requireUser(): Promise<UserRecord> {
  const user = await getCurrentUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}

/**
 * Shared authorization helper: requires an authenticated profile holding the
 * given role. Throws `UnauthorizedError` when signed out and `ForbiddenError`
 * when signed in without the required privilege.
 *
 * Roles come from the server-side profile store only; no client-submitted
 * role field is ever consulted.
 */
export async function requireRole(
  role: UserRecord["role"],
): Promise<UserRecord> {
  const user = await requireUser();
  if (user.role !== role) {
    throw new ForbiddenError();
  }
  return user;
}
