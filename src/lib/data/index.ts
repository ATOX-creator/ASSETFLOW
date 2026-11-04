import { localRepository } from "./local";
import type { Repository } from "./types";

export type * from "./types";

/**
 * Single entry point for all persistence.
 *
 * The local JSON store is the active implementation today. Replacing it with a
 * Supabase-backed repository only requires implementing `Repository` and
 * returning it here — no route handler or UI code has to change.
 */
export function getRepository(): Repository {
  return localRepository;
}
