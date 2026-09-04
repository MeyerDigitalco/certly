import type { Role } from "@/lib/types/database";

export function isOwner(role: Role | null | undefined): boolean {
  return role === "owner";
}
export function isAdmin(role: Role | null | undefined): boolean {
  return role === "owner" || role === "admin";
}
export function isViewer(role: Role | null | undefined): boolean {
  return role === "viewer";
}

const PLATFORM_ADMINS = (process.env.CERTLY_PLATFORM_ADMINS ?? "")
  .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);

/** Certly staff, not tenant owners. Sees the platform admin console. */
export function isPlatformAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return PLATFORM_ADMINS.includes(email.toLowerCase());
}
