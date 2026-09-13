export const SITE = {
  name: "Certly",
  domain: "https://certly.co.za",
  legalEntity: "Meyer Digital Co.",
  email: "hello@certly.co.za",
  informationOfficer: "Pieter Meyer",
  informationOfficerEmail: "privacy@certly.co.za",
  whatsapp: "27820976115",
  addressLine: "South Africa",
  hostingRegion: "Ireland (eu-west-1)",
  effectiveDate: "1 September 2026",
  analyticsScript: "/_vercel/insights/script.js",
  analyticsDomain: "",
} as const;

export function whatsappLink(message: string): string {
  return `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(message)}`;
}
