/* eslint-disable @typescript-eslint/no-explicit-any */

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSuperadmin } from "./superadmin";

/**
 * Gate a page on the superadmin list.
 *
 * Answers notFound rather than a refusal, so the console does not announce
 * that it exists to anyone who happens to try the address.
 */
export async function requireSuperadmin(): Promise<{ email: string }> {
  const supabase: any = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isSuperadmin(user?.email)) notFound();
  return { email: String(user.email) };
}
