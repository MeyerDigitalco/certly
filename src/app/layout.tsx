import type { Metadata, Viewport } from "next";
import { SITE, jsonLd } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.domain),
  title: {
    default: "Certly - site access compliance for South African contractors",
    template: "%s - Certly",
  },
  description:
    "Certification register, safety files and monthly HR reporting for South African contractors. Pull the EEA2 and SETA training reports from the same register.",
  applicationName: "Certly",
  keywords: [
    "safety file",
    "site access compliance",
    "training register",
    "certification tracking",
    "monthly HR report",
    "staff movement report",
    "labour plan",
    "staff turnover report",
    "employment equity report",
    "EEA2",
    "workplace skills plan",
    "annual training report",
    "WSP ATR",
    "absenteeism report",
    "letter of good standing",
    "OHS Act",
    "Mine Health and Safety Act",
    "contractor compliance",
    "South Africa",
  ],
  authors: [{ name: SITE.legalEntity }],
  alternates: { canonical: SITE.domain },
  openGraph: {
    type: "website",
    siteName: "Certly",
    locale: "en_ZA",
    url: SITE.domain,
    title: "Nobody gets turned away at the gate",
    description:
      "Certly tracks every induction, medical and competency your crew needs on site, drafts the safety file, and builds the monthly HR pack, the EEA2 and the SETA training report from the same register.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nobody gets turned away at the gate",
    description:
      "Site access compliance and safety files for South African contractors.",
    images: [`${SITE.domain}/opengraph-image`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#ede7d9",
  width: "device-width",
  initialScale: 1,
};

const ORG_JSONLD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Certly",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: SITE.domain,
  description:
    "Training and certification register for South African contractors, with safety file drafting, monthly HR reporting, employment equity EEA2 reporting and SETA skills development reporting in Excel.",
  offers: {
    "@type": "Offer",
    price: "999",
    priceCurrency: "ZAR",
    description: "Up to 50 people on the register, then R10 per additional person.",
  },
  areaServed: { "@type": "Country", name: "South Africa" },
  publisher: { "@type": "Organization", name: SITE.legalEntity },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-ZA">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Anton&family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;500;600;700&family=Courier+Prime:wght@400;700&display=swap"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(ORG_JSONLD) }}
        />
      </head>
      <body>
        {children}
        {SITE.analyticsScript ? (
          <script
            defer
            src={SITE.analyticsScript}
            {...(SITE.analyticsDomain
              ? { "data-domain": SITE.analyticsDomain }
              : {})}
          />
        ) : null}
      </body>
    </html>
  );
}
