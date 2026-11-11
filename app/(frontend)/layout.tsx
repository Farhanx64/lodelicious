import type { Metadata } from "next";
import localFont from "next/font/local";

import "../globals.css";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { isPreviewEnv } from "@/src/lib/app-env";
import { bagCount } from "@/src/lib/checkout/session";
import { brandColor } from "@/src/lib/brand-color";
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

// Titles follow the shop name in Website → Store details, so a rename reaches every tab title.
export async function generateMetadata(): Promise<Metadata> {
  const { name } = await getStoreSettings();
  return {
    title: {
      default: `${name} — Sweets, Chocolates & Gifts · Plymouth, MA`,
      template: `%s — ${name}`,
    },
    description: "Gift baskets, chocolates and sweets from a family-owned shop in Plymouth, Massachusetts.",
    // Staging previews shared with the client must not end up in search results.
    robots: isPreviewEnv() ? { index: false, follow: false } : undefined,
  };
}

export const dynamic = "force-dynamic";

export default async function FrontendLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const store = await getStoreSettings();
  const staging = isStaging();
  const promo = store.promoEnabled ? { slides: (store.promoSlides ?? []).filter((s) => s.text?.trim()), seconds: store.promoSeconds } : null;

  return (
    <html lang="en" className={`${cormorant.variable} ${sourceSans.variable}`}>
      <head>
        {/* Brand colour from Website → Store details (validated there for readable white text). */}
        <style>{`:root{--color-coastal-deep:${brandColor(store.brandColor)}}`}</style>
      </head>
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <SiteHeader staging={staging} promo={promo} storeName={store.name} tagline={store.tagline} bagCount={await bagCount()} />
        <main id="main" tabIndex={-1} className="flex-1 py-10">
          {children}
        </main>
        <SiteFooter store={store} />
      </body>
    </html>
  );
}
