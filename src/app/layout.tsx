import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Certly - HR compliance for South African businesses", template: "%s - Certly" },
  description: "Track staff training, certifications, and renewals. Built for South African safety-critical industries.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
