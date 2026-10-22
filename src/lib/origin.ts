import { headers } from "next/headers";
import { SITE } from "@/lib/site";

/**
 * The origin to put in links we email: password resets, invitations,
 * signup confirmations.
 *
 * Never derived from request headers in production. A Host header is
 * attacker-controlled on any host that does not pin it, and a reset link
 * built from it would point the victim at the attacker's domain. In
 * production the origin is the configured public origin, full stop. The
 * header fallback exists for local development only, where the origin is
 * http://localhost:3000 and nobody is attacking anyone.
 */
export async function publicOrigin(): Promise<string> {
  const configured = (process.env.CERTLY_PUBLIC_ORIGIN ?? "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") return SITE.domain;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return SITE.domain;
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}
