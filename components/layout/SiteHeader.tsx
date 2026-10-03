import Link from "next/link";

import { Bow } from "@/components/brand/Bow";
import { Lockup } from "@/components/brand/Lockup";

// Order and wording from Lody's mood board: four links, the bow, two links, then the icons.
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

const ICON_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.3,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  className: "size-[22px]",
};

export const ICONS = [
  {
    href: "/shop#shop-search",
    label: "Search",
    svg: (
      <svg {...ICON_PROPS}>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m15.5 15.5 5 5" />
      </svg>
    ),
  },
  {
    href: "/account",
    label: "Account",
    svg: (
      <svg {...ICON_PROPS}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4.5 20.5c1.2-4 4.1-6 7.5-6s6.3 2 7.5 6" />
      </svg>
    ),
  },
  {
    href: "/wishlist",
    label: "Wishlist",
    svg: (
      <svg {...ICON_PROPS}>
        <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z" />
      </svg>
    ),
  },
  {
    href: "/cart",
    label: "Shopping bag",
    svg: (
      <svg {...ICON_PROPS}>
        <path d="M5 8h14l-1 12.5H6L5 8Z" />
        <path d="M9 10V7a3 3 0 0 1 6 0v3" />
      </svg>
    ),
  },
];

const linkClass = "caps inline-flex min-h-11 items-center text-[0.78rem] text-nav no-underline hover:text-gold-text hover:underline";

export function SiteHeader({ staging, storeName, tagline }: { staging: boolean; storeName: string; tagline?: string | null }) {
  const icons = (
    <ul className="flex flex-wrap items-center gap-1">
      {ICONS.map((icon) => (
        <li key={icon.href}>
          <Link href={icon.href} aria-label={icon.label} className="inline-flex size-11 items-center justify-center text-gold-text hover:text-nav">
            {icon.svg}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      {staging && (
        <div role="note" className="border-b border-gold bg-blush px-4 py-2 text-center text-sm text-ink">
          Staging preview — prices, stock and photos are not final. Orders are not fulfilled.
        </div>
      )}
      <header className="bg-cream">
        <div className="mx-auto w-[min(100%-2rem,72rem)] pt-7 pb-5">
          <Link href="/" rel="home" aria-label={storeName} className="mx-auto block w-fit no-underline">
            <Lockup name={storeName} tagline={tagline} />
          </Link>
        </div>

        {/* Desktop: the board's nav bar. */}
        <div className="relative border-y border-line bg-paper">
          <nav aria-label="Primary" className="mx-auto hidden w-[min(100%-2rem,72rem)] flex-wrap items-center justify-between gap-x-6 py-1 lg:flex">
            <ul className="flex flex-wrap gap-x-10">
              {NAV_LEFT.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={linkClass}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <Bow className="w-8 text-gold" />
            <ul className="flex flex-wrap gap-x-10">
              {NAV_RIGHT.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={linkClass}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            {icons}
          </nav>

          {/* Phones and tablets: the same links behind a Menu disclosure; icons stay visible. */}
          <div className="mx-auto flex w-[min(100%-2rem,72rem)] flex-wrap items-center justify-between gap-x-3 lg:hidden">
            <details className="group">
              <summary className="caps flex min-h-11 cursor-pointer list-none items-center gap-2 text-[0.8rem] text-nav [&::-webkit-details-marker]:hidden">
                <svg {...ICON_PROPS}>
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
                Menu
              </summary>
              <nav aria-label="Primary" className="absolute inset-x-0 z-20 border-y border-line bg-paper px-4 py-2 shadow-sm">
                <ul className="mx-auto flex w-[min(100%-2rem,72rem)] flex-col">
                  {[...NAV_LEFT, ...NAV_RIGHT].map((item) => (
                    <li key={item.href} className="border-b border-line last:border-b-0">
                      <Link href={item.href} className={linkClass}>
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </details>
            {icons}
          </div>
        </div>
      </header>
    </>
  );
}
