import type { NextConfig } from "next";

/**
 * Security response headers.
 *
 * Next sets none of these by default. They are written here rather than in
 * the proxy so they apply to static responses too, which since the landing
 * page became static is most of the marketing site.
 *
 * The content security policy allows inline scripts. That is not ideal, but
 * Next's hydration bootstrap and the JSON-LD blocks are inline, and the
 * alternative is a per-request nonce, which forces every page to render
 * dynamically and would undo the static rendering the guides depend on.
 * The policy still does real work: it blocks script loaded from any other
 * origin, blocks framing entirely, pins form submissions to this site and
 * PayFast, and stops a stray object or base tag.
 */

const SUPABASE_ORIGIN = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(
  /\/+$/,
  "",
);

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  // The project origin is pinned when it is known at build time, and the
  // wildcard stays as a floor. A policy that depends on a build-time
  // variable being present is a policy that takes the site down the day it
  // is not, and Supabase is the only service either directive serves.
  `img-src 'self' data: blob: https://*.supabase.co${SUPABASE_ORIGIN ? ` ${SUPABASE_ORIGIN}` : ""}`,
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co${SUPABASE_ORIGIN ? ` ${SUPABASE_ORIGIN}` : ""} https://vitals.vercel-insights.com`,
  "form-action 'self' https://www.payfast.co.za https://sandbox.payfast.co.za",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: csp },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
        has: [{ type: "host", value: "certly-eta.vercel.app" }],
      },
    ];
  },
};

export default nextConfig;
