import type { Metadata } from "next";
import localFont from "next/font/local";

import "../globals.css";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ReceiptBar } from "@/components/receipt/ReceiptBar";
import { JsonLd } from "@/components/seo/JsonLd";
import { SITE_URL, storeJsonLd } from "@/src/lib/seo";
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
  const description =
    "Hand-made gift baskets, Phillips chocolates, fudge and candy from a family-owned shop in Manomet, Plymouth MA. Pickup, local delivery and US shipping.";
  return {
    // Canonical links and Open Graph URLs resolve against the one live host (D68).
    metadataBase: new URL(SITE_URL),
    title: {
      default: `Gift Baskets, Chocolates & Candy in Plymouth, MA | ${name}`,
      template: `%s | ${name} Plymouth, MA`,
    },
    description,
    openGraph: {
      type: "website",
      siteName: name,
      locale: "en_US",
      description,
      images: [{ url: "/brand/logo-1024.png", width: 1024, height: 1024, alt: name }],
    },
    twitter: { card: "summary", images: ["/brand/logo-1024.png"] },
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
        <JsonLd data={storeJsonLd(store)} />
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
        <ReceiptBar />
      </body>
    </html>
  );
}
