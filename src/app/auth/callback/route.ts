import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { completeAuthFromQuery } from "@/lib/auth/callback";

/**
 * OAuth / PKCE hand-off endpoint.
 *
 * Registered as the validated application callback for Google sign-in,
 * sign-up e-mail confirmation, and password-recovery links. The one-time code
 * is exchanged server-side for a Supabase session (cookies) and the visitor
 * is sent to a sanitised same-origin destination.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const outcome = await completeAuthFromQuery(supabase, request.nextUrl.searchParams);
    return NextResponse.redirect(new URL(outcome.location, request.url));
  } catch (error) {
    console.error("[assetflow] auth callback error", error);
    return NextResponse.redirect(new URL("/login?error=callback_failed", request.url));
  }
}
