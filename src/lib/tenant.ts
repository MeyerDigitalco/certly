import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Organisation, Role } from "@/lib/types/database";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface TenantContext {
  org: Organisation;
  role: Role;
  userId: string;
  userEmail: string;
}

/**
 * Resolve the current tenant by URL slug and verify the signed-in user
 * is a member. Redirects to /login if unauthenticated. Returns 404 if
 * the slug does not exist or the user is not a member (both look the
 * same from outside, which is what we want).
 */
export async function requireTenant(slug: string): Promise<TenantContext> {
  const supabase: any = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/${slug}/hr`);

  const { data: org } = await supabase
    .from("organisations")
    .select("*")
    .eq("slug", slug.toLowerCase())
    .maybeSingle();
  if (!org) notFound();

  const { data: membership } = await supabase
    .from("org_members")
    .select("role")
    .eq("organisation_id", org.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) notFound();

  return {
    org: org as Organisation,
    role: membership.role as Role,
    userId: user.id,
    userEmail: user.email ?? "",
  };
}

export function requireRole(ctx: TenantContext, allowed: Role[]): void {
  if (!allowed.includes(ctx.role)) notFound();
}
