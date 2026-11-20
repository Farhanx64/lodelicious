import type { Metadata } from "next";
import localFont from "next/font/local";

import "../globals.css";

const cormorant = localFont({ src: "../fonts/cormorant-garamond-latin.woff2", variable: "--font-cormorant", weight: "500 600", display: "swap" });
const sourceSans = localFont({ src: "../fonts/source-sans-3-latin.woff2", variable: "--font-source-sans", weight: "400 600", display: "swap" });

export const metadata: Metadata = { title: "Dashboard — Lodelicious", robots: { index: false, follow: false } };

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${cormorant.variable} ${sourceSans.variable}`}>
      <body className="min-h-screen bg-cream text-ink">{children}</body>
    </html>
  );
}
