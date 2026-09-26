import type { Metadata } from "next";
import localFont from "next/font/local";

import "../globals.css";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { getStoreSettings, isStaging } from "@/src/lib/store";

// Bundled OFL fonts (app/fonts/LICENSE.md): served from this site, no third-party requests,
// and builds never depend on reaching Google Fonts.
const cormorant = localFont({
  src: "../fonts/cormorant-garamond-latin.woff2",
  variable: "--font-cormorant",
  weight: "500 600",
  display: "swap",
});

const sourceSans = localFont({
  src: "../fonts/source-sans-3-latin.woff2",
  variable: "--font-source-sans",
  weight: "400 600",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Lodelicious Gifts & Sweets — Plymouth, MA",
    template: "%s — Lodelicious Gifts & Sweets",
  },
  description: "Gift baskets, chocolates and sweets from a family-owned shop in Plymouth, Massachusetts.",
};

export const dynamic = "force-dynamic";

export default async function FrontendLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const store = await getStoreSettings();
  const staging = isStaging();

  return (
    <html lang="en" className={`${cormorant.variable} ${sourceSans.variable}`}>
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <SiteHeader staging={staging} storeName={store.name} />
        <main id="main" tabIndex={-1} className="flex-1 py-10">
          {children}
        </main>
        <SiteFooter store={store} />
      </body>
    </html>
  );
}
