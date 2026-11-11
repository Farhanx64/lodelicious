import type { Metadata } from "next";
import localFont from "next/font/local";

import "../globals.css";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { isPreviewEnv } from "@/src/lib/app-env";
import { bagCount } from "@/src/lib/checkout/session";
import { brandColor, buttonColor } from "@/src/lib/brand-color";
import { getStoreSettings, isStaging } from "@/src/lib/store";

// Bundled OFL fonts (app/fonts/LICENSE.md): served from this site, no third-party requests,
// and builds never depend on reaching Google Fonts.
const instrumentSerif = localFont({
  src: [
    { path: "../fonts/instrument-serif-latin.woff2", weight: "400", style: "normal" },
    { path: "../fonts/instrument-serif-italic-latin.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-instrument-serif",
  display: "swap",
});

const dmSans = localFont({
  src: "../fonts/dm-sans-latin.woff2",
  variable: "--font-dm-sans",
  weight: "300 500",
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
    <html lang="en" className={`${instrumentSerif.variable} ${dmSans.variable}`}>
      <head>
        {/* Brand and button colours from Website → Store details (validated there for readable text). */}
        <style>{`:root{--color-rose-deep:${brandColor(store.brandColor)};--color-gold:${buttonColor(store.buttonColor)}}`}</style>
      </head>
      <body className="flex min-h-screen flex-col">
        {/* Entrance animations start hidden; without JavaScript nothing would reveal them. */}
        <noscript>
          <style>{".js-reveal{opacity:1!important;transform:none!important}"}</style>
        </noscript>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <SiteHeader staging={staging} promo={promo} storeName={store.name} bagCount={await bagCount()} />
        <main id="main" tabIndex={-1} className="flex-1">
          <MotionProvider>{children}</MotionProvider>
        </main>
        <SiteFooter store={store} />
      </body>
    </html>
  );
}
