import Link from "next/link";

export function SiteHeader({ staging }: { staging: boolean }) {
  return (
    <>
      {staging && (
        <div role="note" className="border-b border-[#e0c46c] bg-[#fff3cd] px-4 py-2 text-center text-sm text-[#4a3b00]">
          Staging preview — prices, stock and photos are not final. Orders are not fulfilled.
        </div>
      )}
      <header className="on-ink border-b border-gold bg-ink text-cream">
        <div className="mx-auto flex w-[min(100%-2rem,72rem)] flex-wrap items-center justify-between gap-4 py-4">
          <p className="m-0 font-display text-[1.75rem] leading-none">
            <Link href="/" rel="home" className="text-cream no-underline">
              Lodelicious
              <span className="mt-1 block font-sans text-xs tracking-[0.18em] text-gold-light uppercase">
                Gifts &amp; Sweets
              </span>
            </Link>
          </p>
          {/* Primary navigation arrives with the storefront pages (milestone 3). */}
        </div>
      </header>
    </>
  );
}
