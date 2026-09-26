import Link from "next/link";

const NAV = [
  { href: "/shop", label: "Shop" },
  { href: "/build-a-basket", label: "Build a Basket" },
  { href: "/baby-gifts", label: "Baby Gifts" },
];

export function SiteHeader({ staging, storeName }: { staging: boolean; storeName: string }) {
  return (
    <>
      {staging && (
        <div role="note" className="border-b border-[#e0c46c] bg-[#fff3cd] px-4 py-2 text-center text-sm text-[#4a3b00]">
          Staging preview — prices, stock and photos are not final. Orders are not fulfilled.
        </div>
      )}
      <header className="on-ink border-b border-gold bg-ink text-cream">
        <div className="mx-auto flex w-[min(100%-2rem,72rem)] flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
          <Link href="/" rel="home" className="flex items-center gap-3 text-cream no-underline">
            {/* The logo is a white sticker roundel with its own gold ring, so it reads on black as is. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, pre-sized */}
            <img
              src="/brand/logo-512.png"
              alt={storeName}
              width={72}
              height={72}
              className="h-[72px] w-[72px]"
            />
            <span aria-hidden="true" className="hidden font-display text-2xl leading-none sm:block">
              Lodelicious
              <span className="mt-1 block font-sans text-xs tracking-[0.18em] text-gold-light uppercase">Gifts &amp; Sweets</span>
            </span>
          </Link>
          <nav aria-label="Primary">
            <ul className="flex flex-wrap gap-x-6 gap-y-1">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="inline-flex min-h-11 items-center text-cream no-underline hover:underline">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
    </>
  );
}
