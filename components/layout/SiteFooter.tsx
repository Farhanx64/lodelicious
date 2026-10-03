import Link from "next/link";

import { Lockup } from "@/components/brand/Lockup";
import type { StoreSetting } from "@/payload-types";
import { telHref } from "@/src/lib/phone";

const SHOP_LINKS = [
  { href: "/shop?category=fudge", label: "Fudge" },
  { href: "/shop?category=fresh-treats", label: "Fresh treats" },
  { href: "/baby-gifts", label: "Baby gifts" },
];

export function SiteFooter({ store }: { store: StoreSetting }) {
  const closed = (store.closedDays ?? []).map((d) => d.label);
  const story = store.story?.trim();
  return (
    // Coastal-blue band and gold rule at the bottom of the page (Lody's board); blue is never text.
    <footer className="border-t-[6px] border-coastal bg-linen text-[0.95rem] text-ink">
      <div aria-hidden="true" className="h-1.5 border-b border-gold bg-coastal-pale" />
      <div className="mx-auto grid w-[min(100%-2rem,72rem)] grid-cols-[repeat(auto-fit,minmax(min(14rem,100%),1fr))] gap-6 py-10">
        <section aria-labelledby="footer-shop">
          <Link href="/" aria-label={store.name} className="mb-4 block w-fit no-underline">
            <Lockup name={store.name} tagline={store.tagline} size="sm" />
          </Link>
          <h2 id="footer-shop" className="sr-only">
            More to shop
          </h2>
          <ul className="caps flex flex-col gap-1 text-[0.72rem]">
            {SHOP_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-nav">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {story && (
          <section aria-labelledby="footer-story" className="border-l-2 border-coastal pl-4">
            <h2 id="footer-story" className="mb-3 text-base">
              {store.storyHeading || "Our story"}
            </h2>
            {story.split(/\n\s*\n/).map((paragraph, i) => (
              <p key={i} className="mb-2 whitespace-pre-line">
                {paragraph}
              </p>
            ))}
          </section>
        )}

        <section aria-labelledby="footer-visit">
          <h2 id="footer-visit" className="mb-3 text-base">
            Visit the shop
          </h2>
          <address className="not-italic">
            {store.name}
            <br />
            {store.street}
            <br />
            {store.locality}
          </address>
        </section>

        <section aria-labelledby="footer-hours">
          <h2 id="footer-hours" className="mb-3 text-base">
            {store.hoursLabel}
          </h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4">
            {(store.hours ?? []).map((row) => (
              <div key={row.id ?? row.days} className="contents">
                <dt className="font-semibold">{row.days}</dt>
                <dd>{row.time}</dd>
              </div>
            ))}
          </dl>
          {closed.length > 0 && <p className="mt-3">Closed {closed.join(", ")}.</p>}
        </section>

        <section aria-labelledby="footer-contact">
          <h2 id="footer-contact" className="mb-3 text-base">
            Contact
          </h2>
          <p>
            <a href={telHref(store.phone)}>
              {store.phone}
            </a>
            <br />
            <a href={`mailto:${store.email}`} className="break-words">
              {store.email}
            </a>
          </p>
          {store.doordashUrl && (
            <p className="mt-3">
              Local delivery:{" "}
              <a href={store.doordashUrl}>
                order on DoorDash
              </a>
            </p>
          )}
        </section>
      </div>
    </footer>
  );
}
