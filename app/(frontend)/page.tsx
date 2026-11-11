import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { ProductCard } from "@/components/catalog/ProductCard";
import { ProductImage } from "@/components/catalog/ProductImage";
import { primaryButton, secondaryButton } from "@/components/checkout/styles";
import { FavoritesSlider } from "@/components/home/FavoritesSlider";
import { Marquee } from "@/components/home/Marquee";
import { PhotoStrip } from "@/components/home/PhotoStrip";
import { HeroMedia, HeroTitle } from "@/components/motion/Hero";
import { Reveal } from "@/components/motion/Reveal";
import { StickyStory } from "@/components/motion/StickyStory";
import { Accent } from "@/components/ui/Accent";
import type { Media, Product } from "@/payload-types";
import { listCategories, listProducts } from "@/src/lib/catalog/queries";
import { favoritesLayout, favoritesLimit } from "@/src/lib/home";
import { publishableProductImages } from "@/src/lib/media";
import { telHref } from "@/src/lib/phone";
import { getHomePage, getStoreSettings, isImagePublishable } from "@/src/lib/store";

// Grid layouts Lody can pick in /admin → Home page (D33). Phones show two columns, or one when
// text is enlarged so tiles never overflow.
const GRID = {
  "grid-2x2": "mx-auto max-w-[52rem] grid-cols-[repeat(auto-fit,minmax(min(10rem,100%),1fr))] gap-x-4 gap-y-10 sm:grid-cols-2 md:gap-x-6 md:gap-y-14",
  "grid-3x2": "grid-cols-[repeat(auto-fit,minmax(min(10rem,100%),1fr))] gap-x-4 gap-y-10 sm:grid-cols-2 md:gap-x-6 md:gap-y-14 lg:grid-cols-3",
} as const;

// What the shop is known for. The words come from each category's own description in /admin, with
// the copy already used on that section's page as the fallback; the photo is one of its products.
const KNOWN_FOR = [
  { slug: "chocolate", title: "Chocolates", href: "/shop?category=chocolate", cta: "Shop chocolates", text: "Phillips Chocolates bars, boxes and turtles, and chocolate-covered treats." },
  { slug: "fudge", title: "Fudge", href: "/shop?category=fudge", cta: "Shop fudge", text: "Chocolate-covered turtle fudge and Cape Cod fudge." },
  {
    slug: "gift-baskets",
    title: "Gift baskets",
    href: "/gift-baskets",
    cta: "See gift baskets",
    text: "Ready-made gift baskets, assembled by hand in our Plymouth shop. The price includes the basket and presentation.",
  },
  {
    slug: "baby-gifts",
    title: "Baby gifts",
    href: "/baby-gifts",
    cta: "See baby gifts",
    text: "Keepsake ceramics and baby gift baskets, filled with sweets and finished by hand in our Plymouth shop.",
  },
];

// The strip of values under the hero, in words the site already uses.
const VALUES = ["Wrapped by hand", "Family-owned", "Plymouth, Massachusetts", "Phillips chocolates", "Cape Cod fudge", "Gift baskets", "Built around your budget"];

const firstPhoto = (products: Product[]): Media | undefined => products.map((p) => publishableProductImages(p.images)[0]).find(Boolean);

/** A wide, large product photo that can carry a full-width band. */
function widePhoto(products: Product[]): Media | undefined {
  return products
    .flatMap((p) => publishableProductImages(p.images))
    .filter((m) => (m.width ?? 0) >= 1200 && (m.width ?? 0) > (m.height ?? 0) * 1.2)
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
}

export default async function HomePage() {
  const [store, home, categories, ...sections] = await Promise.all([
    getStoreSettings(),
    getHomePage(),
    listCategories(),
    ...KNOWN_FOR.map((k) => listProducts({ category: k.slug, limit: 12 })),
  ]);
  const layout = favoritesLayout(home.favoritesLayout);
  const featured = await listProducts({ featured: true, limit: favoritesLimit(layout) });
  const heroDoc = typeof home.heroImage === "object" ? home.heroImage : null;
  const hero = heroDoc && isImagePublishable(heroDoc) ? heroDoc : null;
  const band = widePhoto(sections[2]) ?? widePhoto(sections.flat());

  // "Sweets · Chocolates · Gifts" reads as three lines; any other tagline follows the shop name.
  const name = store.name.trim();
  const words = (store.tagline ?? "").split(/\s*[·•|,]\s*/).filter(Boolean);
  const lines = words.length === 3 ? words : [name, ...(store.tagline ? [store.tagline] : [])];
  const italic = lines.length > 1 ? 1 : 0;

  return (
    <>
      {/* Hero: label, title, subline and buttons beside the picture; on phones the picture comes first. */}
      <section aria-labelledby="welcome" className="shell grid grid-cols-[minmax(0,1fr)] items-center gap-x-16 gap-y-10 pt-8 pb-16 lg:min-h-[calc(100vh-112px)] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:py-16">
        <div className="order-2 lg:order-1">
          <p className="label-caps mb-6 text-rose-deep">Plymouth, Massachusetts</p>
          <HeroTitle
            id="welcome"
            lines={lines.map((line, i) => (
              <>
                {i === 0 && words.length === 3 && <span className="sr-only">{name} — </span>}
                {i === italic ? <em>{line}</em> : line}
              </>
            ))}
          />
          <p className="mt-8 max-w-[46ch] text-muted">
            Gift baskets, Phillips chocolates, fudge and treats, wrapped by hand in our Plymouth shop. Choose from our favorites or let us build a
            basket around your budget.
          </p>
          <p className="mt-8 flex flex-wrap gap-3">
            <Link href="/shop" className={primaryButton}>
              Shop sweets
            </Link>
            <Link href="/build-a-basket" className={secondaryButton}>
              Custom baskets
            </Link>
          </p>
        </div>
        <HeroMedia className="order-1 mx-auto h-[60vh] w-[min(100%,26rem)] lg:order-2 lg:h-[min(72vh,44rem)] lg:w-full lg:max-w-[34rem]">
          {hero ? (
            <ProductImage media={hero} size="large" priority fit="cover" className="size-full rounded-t-[999px] rounded-b-[2rem]" />
          ) : (
            // Until Lody uploads a hero photo, the shop's logo stands on the pebble.
            <div className="flex size-full items-center justify-center px-[8%]">
              {/* eslint-disable-next-line @next/next/no-img-element -- a small static file; no optimizer on this host */}
              <img src="/brand/logo-lockup.png" alt={`${name} logo`} width={900} height={550} className="h-auto w-full" />
            </div>
          )}
        </HeroMedia>
      </section>

      <Marquee items={VALUES} label="What we stand for" />

      {featured.length > 0 && (
        <section aria-labelledby="favorites" className="shell section">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 md:mb-14">
            <h2 id="favorites" className="display-2">
              Shop <em>favorites</em>
            </h2>
            <p className="flex flex-wrap gap-x-8">
              <Link href="/shop" className="label-caps inline-flex min-h-11 items-center gap-1.5 text-cocoa">
                See the whole shop <ArrowUpRight size={15} strokeWidth={1.6} aria-hidden="true" />
              </Link>
              <Link href="/baby-gifts" className="label-caps inline-flex min-h-11 items-center gap-1.5 text-cocoa">
                Baby gifts <ArrowUpRight size={15} strokeWidth={1.6} aria-hidden="true" />
              </Link>
            </p>
          </div>
          {layout === "slider" ? (
            <FavoritesSlider count={featured.length}>
              {featured.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </FavoritesSlider>
          ) : (
            <ul className={`grid ${GRID[layout]}`}>
              {featured.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby="known-for" className="shell section border-t border-line">
        <h2 id="known-for" className="display-2 mb-12 max-w-[14ch] lg:mb-0 lg:sr-only">
          What we&rsquo;re <em>known</em> for
        </h2>
        <StickyStory
          blocks={KNOWN_FOR.map((k, i) => {
            const category = categories.find((c) => c.slug === k.slug);
            const photo = firstPhoto(sections[i]);
            return {
              key: k.slug,
              media: photo ? (
                <ProductImage media={photo} size="large" decorative fit="cover" blend className="size-full" />
              ) : (
                <div className="flex size-full items-center justify-center font-display text-[8rem] leading-none text-rose italic">{i + 1}</div>
              ),
              content: (
                <>
                  <p className="label-caps mb-4 text-rose-deep">
                    {String(i + 1).padStart(2, "0")} / {String(KNOWN_FOR.length).padStart(2, "0")}
                  </p>
                  <h3 className="display-2 mb-5">{category?.name ?? k.title}</h3>
                  <p className="mb-6 max-w-[42ch] text-muted">{category?.description?.trim() || k.text}</p>
                  <Link href={k.href} className="label-caps inline-flex min-h-11 items-center gap-1.5 text-cocoa">
                    {k.cta} <ArrowUpRight size={15} strokeWidth={1.6} aria-hidden="true" />
                  </Link>
                </>
              ),
            };
          })}
        />
      </section>

      <section aria-labelledby="get-it" className="shell section border-t border-line">
        <h2 id="get-it" className="display-2 mb-10 md:mb-16">
          Getting your <em>order</em>
        </h2>
        <div className="grid gap-x-12 gap-y-10 md:grid-cols-3">
          <Reveal index={0} className="border-t border-cocoa pt-6">
            <h3 className="mb-3 text-[1.75rem]">Pickup</h3>
            <p className="text-muted">
              Free from our shop at {store.street}, {store.locality}.
            </p>
          </Reveal>
          <Reveal index={1} className="border-t border-cocoa pt-6">
            <h3 className="mb-3 text-[1.75rem]">Local delivery</h3>
            <p className="text-muted">
              Through DoorDash
              {store.doordashUrl ? (
                <>
                  {" "}
                  — <a href={store.doordashUrl}>order on our DoorDash page</a>.
                </>
              ) : (
                "."
              )}{" "}
              Shipping is coming with online checkout.
            </p>
          </Reveal>
          <Reveal index={2} className="border-t border-cocoa pt-6">
            <h3 className="mb-3 text-[1.75rem]">Order by phone</h3>
            <p className="text-muted">
              Online checkout is coming soon. Call <a href={telHref(store.phone)}>{store.phone}</a> today.
            </p>
          </Reveal>
        </div>
      </section>

      {/* A full-width photo with one sentence over a gradient; a rose band with the same sentence until a wide photo exists. */}
      <section aria-label="About the shop" className={`relative flex min-h-[70vh] items-end overflow-hidden ${band ? "bg-cocoa" : "bg-rose"}`}>
        {band && (
          <>
            <ProductImage media={band} size="large" decorative fit="cover" className="absolute inset-0 size-full" />
            <div aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-cocoa/85 via-cocoa/25 to-transparent" />
          </>
        )}
        <p className="shell relative py-12 font-display text-[clamp(2rem,4.5vw,4rem)] leading-[1.05] tracking-[-0.02em] text-balance text-on-rose md:py-20">
          <span className="block max-w-[22ch]">Gift baskets, chocolates and sweets from a family-owned shop in Plymouth, Massachusetts.</span>
        </p>
      </section>

      <section aria-labelledby="from-the-shop" className="shell section">
        <h2 id="from-the-shop" className="display-2 mb-10 md:mb-16">
          From the <em>shop</em>
        </h2>
        <PhotoStrip images={(home.stripImages ?? []).map((row) => row.image)} />
      </section>

      <section aria-labelledby="custom" className="shell pb-16 md:pb-32">
        <div className="on-rose rounded-[2rem] bg-rose-deep px-6 py-16 text-center text-on-rose md:px-16 md:py-28">
          <p className="label-caps mb-6">Custom baskets</p>
          <h2 id="custom" className="display-2 mx-auto mb-6 max-w-[16ch] text-on-rose">
            <Accent text="Let us build a basket around your budget" />
          </h2>
          <p className="mx-auto mb-10 max-w-[48ch]">
            Pick a gift type and size, set a budget if you like, and fill it with favorites from our shelves. We&rsquo;ll wrap it by hand.
          </p>
          <p className="flex flex-wrap justify-center gap-3">
            <Link
              href="/build-a-basket"
              className="label-caps inline-flex min-h-12 items-center justify-center rounded-full bg-cream px-8 text-cocoa no-underline transition-colors hover:bg-cocoa hover:text-cream"
            >
              Build a basket
            </Link>
            <Link
              href="/gift-baskets"
              className="label-caps inline-flex min-h-12 items-center justify-center rounded-full border border-on-rose px-8 text-on-rose no-underline transition-colors hover:bg-cream hover:text-cocoa"
            >
              Gift baskets
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
