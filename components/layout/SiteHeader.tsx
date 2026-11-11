import { Heart, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import Link from "next/link";

import { MenuDisclosure } from "./MenuDisclosure";
import { PromoBanner, type PromoSlide } from "./PromoBanner";

// The shop's sections, in the order Lody set (D31). Desktop shows them left of the wordmark.
export const NAV_LEFT = [
  { href: "/shop", label: "Shop" },
  { href: "/shop?category=candy", label: "Sweets" },
  { href: "/shop?category=chocolate", label: "Chocolates" },
  { href: "/shop?category=gift-add-ons", label: "Gifts" },
];
export const NAV_RIGHT = [
  { href: "/build-a-basket", label: "Custom Baskets" },
  { href: "/about", label: "About" },
];

const ICON_PROPS = { size: 21, strokeWidth: 1.4, "aria-hidden": true } as const;

export const ICONS = [
  { href: "/account", label: "Account", svg: <User {...ICON_PROPS} /> },
  { href: "/wishlist", label: "Wishlist", svg: <Heart {...ICON_PROPS} /> },
  { href: "/shop#shop-search", label: "Search", svg: <Search {...ICON_PROPS} /> },
  { href: "/cart", label: "Shopping bag", svg: <ShoppingBag {...ICON_PROPS} /> },
];

const linkClass = "label-caps inline-flex min-h-11 items-center text-cocoa no-underline hover:text-rose-deep hover:underline";
const iconClass = "relative inline-flex size-11 items-center justify-center rounded-full text-cocoa hover:text-rose-deep";

export function SiteHeader({
  staging,
  storeName,
  bagCount = 0,
  promo,
}: {
  staging: boolean;
  promo?: { slides: PromoSlide[]; seconds?: number | null } | null;
  storeName: string;
  bagCount?: number;
}) {
  const name = storeName.trim();
  const iconLink = (icon: (typeof ICONS)[number], extra = "") => {
    const isBag = icon.href === "/cart";
    const label = isBag && bagCount > 0 ? `${icon.label}, ${bagCount} item${bagCount === 1 ? "" : "s"}` : icon.label;
    return (
      <Link href={icon.href} aria-label={label} className={`${iconClass} ${extra}`}>
        {icon.svg}
        {isBag && bagCount > 0 && (
          <span aria-hidden="true" data-bag-count className="absolute top-0.5 right-0 min-w-5 rounded-full bg-rose-deep px-1 text-center text-[0.7rem] leading-5 font-medium text-on-rose">
            {bagCount}
          </span>
        )}
      </Link>
    );
  };
  const bag = ICONS.find((icon) => icon.href === "/cart")!;

  return (
    <>
      {/* Announcement bar: the promo carousel, or the staging note while the promo is switched off. */}
      {promo && promo.slides.length > 0 ? (
        <PromoBanner slides={promo.slides} seconds={promo.seconds} />
      ) : (
        staging && (
          <div role="note" className="flex min-h-9 items-center justify-center bg-rose-deep px-4 py-1.5 text-center text-[0.8125rem] leading-snug text-on-rose">
            Staging preview — prices, stock and photos are not final. Orders are not fulfilled.
          </div>
        )
      )}
      <header className="sticky top-0 z-40 border-b border-line bg-cream">
        <div className="shell relative grid h-[76px] grid-cols-[1fr_auto_1fr] items-center gap-x-3">
          {/* Desktop: links left of the wordmark. */}
          <nav aria-label="Primary" data-desktop-nav className="hidden xl:block">
            <ul className="flex items-center gap-x-6">
              {[...NAV_LEFT, ...NAV_RIGHT].map((item) => (
                <li key={item.href}>
                  <Link href={item.href} data-nav-link className={`${linkClass} whitespace-nowrap`}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Phones and tablets: the same links, and the icons the bar has no room for, behind a
              menu button. A <details>, so it opens without JavaScript. */}
          <MenuDisclosure className="group xl:hidden">
            <summary aria-label="Menu" className="-ml-2.5 inline-flex size-11 cursor-pointer list-none items-center justify-center rounded-full text-cocoa [&::-webkit-details-marker]:hidden">
              <Menu {...ICON_PROPS} size={24} className="group-open:hidden" />
              <X {...ICON_PROPS} size={24} className="hidden group-open:block" />
            </summary>
            <nav aria-label="Primary" data-phone-nav className="absolute inset-x-0 top-full z-40 max-h-[calc(100dvh-76px)] overflow-y-auto border-b border-line bg-cream pt-2 pb-6 shadow-[0_24px_40px_-24px_rgb(54_43_38/0.25)]">
              <ul className="shell flex flex-col">
                {[...NAV_LEFT, ...NAV_RIGHT].map((item) => (
                  <li key={item.href} className="border-b border-line">
                    <Link href={item.href} className="flex min-h-14 items-center font-display text-[1.75rem] leading-none text-cocoa no-underline">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <ul className="shell mt-3 flex flex-wrap gap-x-6">
                {ICONS.filter((icon) => icon !== bag).map((icon) => (
                  <li key={icon.href}>
                    <Link href={icon.href} className={`${linkClass} gap-2`}>
                      {icon.svg}
                      {icon.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </MenuDisclosure>

          <Link href="/" rel="home" data-wordmark className="text-center font-display text-[clamp(1.375rem,6vw,2rem)] leading-none tracking-[-0.02em] text-cocoa no-underline">
            {name}
          </Link>

          <ul className="flex items-center justify-end xl:gap-1">
            {ICONS.map((icon) => (
              <li key={icon.href} className={icon === bag ? "-mr-2.5 xl:mr-0" : "hidden xl:block"}>
                {iconLink(icon)}
              </li>
            ))}
          </ul>
        </div>
      </header>
    </>
  );
}
