import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/safe-redirect";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const dynamic = "force-dynamic";

/**
 * Where a verified link lands when it carries no next of its own. Password
 * recovery is the only thing routed through here today, and the redirectTo
 * sent to Supabase is a bare path so it matches the allow list exactly,
 * without depending on how Supabase treats a query string during matching.
 */
const DEFAULT_NEXT = "/set-password?change=1";

/**
 * The only verification types Certly's own emails ask for. The value
 * arrives in a query string, so it is attacker controlled; passing it
 * straight to verifyOtp would let someone pick a flow we never intended
 * to expose.
 */
const ALLOWED_TYPES = new Set([
  "signup",
  "recovery",
  "magiclink",
  "invite",
  "email",
  "email_change",
]);

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = safeRedirectPath(url.searchParams.get("next"), DEFAULT_NEXT);

  const supabase: any = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  } else if (tokenHash && type && ALLOWED_TYPES.has(type)) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  return NextResponse.redirect(new URL("/forgot-password?expired=1", url.origin));
}
