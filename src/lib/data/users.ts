import type { DatabaseSchema, UserRecord } from "./types";

export interface CreateUserProfileInput {
  /** Supabase Auth user id — the only accepted profile identity. */
  id: string;
  name: string;
  email: string;
  department?: string | null;
}

/**
 * Idempotent profile creation keyed by the verified Supabase user id.
 *
 * Deliberately takes no `role`: every new profile is created as a regular
 * member and existing records are returned unchanged, so a caller can never
 * grant itself an elevated role — not on first sign-in, not on later visits.
 */
export function upsertUserRecord(
  db: DatabaseSchema,
  input: CreateUserProfileInput,
): UserRecord {
  const id = input.id.trim();
  if (!id) {
    throw new Error("PROFILE_ID_REQUIRED");
  }

  const existing = db.users.find((user) => user.id === id);
  if (existing) {
    return { ...existing };
  }

  const user: UserRecord = {
    id,
    name: input.name.trim() || input.email,
    email: input.email.trim().toLowerCase(),
    department: input.department ?? null,
    role: "member",
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  return { ...user };
}
