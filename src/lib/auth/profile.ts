import type { User as SupabaseUser } from "@supabase/supabase-js";
import { getRepository } from "@/lib/data";
import type { UserRecord } from "@/lib/data";

const MAX_NAME_LENGTH = 120;

/**
 * Derives a display name from Supabase user metadata.
 * Google profiles usually provide `full_name`; password sign-ups provide the
 * name collected on the sign-up form. Falls back to the email local part.
 */
export function resolveDisplayName(user: SupabaseUser): string {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  for (const key of ["full_name", "name", "display_name"]) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim().slice(0, MAX_NAME_LENGTH);
    }
  }
  const email = user.email ?? "";
  return email.split("@")[0]?.trim().slice(0, MAX_NAME_LENGTH) || "User";
}

/**
 * Maps a verified Supabase Auth identity onto the application profile store.
 *
 * - Identity is always the Supabase user id; nothing from the request is trusted.
 * - Creation is idempotent and race-safe at the store level.
 * - New profiles are regular members; roles are never accepted from the client.
 * - A session without a verified email address is refused rather than profiled.
 */
export async function ensureProfile(
  user: SupabaseUser,
): Promise<UserRecord | null> {
  const email = (user.email ?? "").trim().toLowerCase();
  if (!email) {
    return null;
  }

  const repository = getRepository();
  const existing = await repository.getUser(user.id);
  if (existing) {
    return existing;
  }

  return repository.createUser({
    id: user.id,
    name: resolveDisplayName(user),
    email,
    department: null,
  });
}
