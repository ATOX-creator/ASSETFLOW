import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { LEGACY_SESSION_COOKIE } from "@/lib/auth/redirect";
import { handleApiError } from "@/lib/api/server";

/**
 * Ends the Supabase session and removes its cookies.
 *
 * Safe to call with an expired or missing session (the response is always
 * `200 { ok: true }` so the client can clear its state and redirect).
 */
export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      // A failed server-side revocation must not leave the browser signed in:
      // clear every Supabase auth cookie locally either way.
      console.error("[assetflow] signOut failed", error.message);
    }

    const store = await cookies();
    for (const cookie of store.getAll()) {
      if (cookie.name.startsWith("sb-") || cookie.name === LEGACY_SESSION_COOKIE) {
        store.delete(cookie.name);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
