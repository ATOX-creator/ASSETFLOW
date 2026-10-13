import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { completeAuthFromQuery } from "@/lib/auth/callback";

/**
 * E-mail confirmation endpoint for template links shaped like
 * `/auth/confirm?token_hash=…&type=signup` (and the PKCE `?code=` variant).
 *
 * Verified sessions land on the validated destination; failures land on the
 * sign-in screen with a fixed, translatable error code.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const outcome = await completeAuthFromQuery(supabase, request.nextUrl.searchParams);
    return NextResponse.redirect(new URL(outcome.location, request.url));
  } catch (error) {
    console.error("[assetflow] auth confirm error", error);
    return NextResponse.redirect(new URL("/login?error=confirm_failed", request.url));
  }
}
