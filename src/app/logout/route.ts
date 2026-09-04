import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/* eslint-disable @typescript-eslint/no-explicit-any */

// POST /logout -> sign out and return to the login page.
export async function POST(request: Request) {
  const supabase: any = await createClient();
  await supabase.auth.signOut();
  // 303 so the browser follows with a GET.
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
