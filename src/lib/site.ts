export const SITE = {
  name: "Certly",
  domain: "https://certly.co.za",
  legalEntity: "Meyer Digital Co.",
  email: "hello@certly.co.za",
  informationOfficer: "Pieter Meyer",
  informationOfficerEmail: "hello@certly.co.za",
  whatsapp: "27820976115",
  addressLine: "South Africa",
  hostingRegion: "Ireland (eu-west-1)",
  effectiveDate: "2 November 2026",
  analyticsScript: "/_vercel/insights/script.js",
  analyticsDomain: "",
} as const;

export function whatsappLink(message: string): string {
  return `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(message)}`;
}

/**
 * JSON for a <script type="application/ld+json"> block. JSON.stringify will
 * happily emit the characters that close a script tag, so they are escaped
 * here. Nothing we feed these blocks is user supplied today, which is
 * exactly why it is worth fixing before something is.
 */
export function jsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
