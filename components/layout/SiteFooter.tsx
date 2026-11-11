import Link from "next/link";

import type { StoreSetting } from "@/payload-types";
import { telHref } from "@/src/lib/phone";

const SHOP_LINKS = [
  { href: "/shop?category=fudge", label: "Fudge" },
  { href: "/shop?category=fresh-treats", label: "Fresh treats" },
  { href: "/baby-gifts", label: "Baby gifts" },
  { href: "/gift-baskets", label: "Gift baskets" },
  { href: "/events", label: "Chocolate fountain" },
];

const POLICY_LINKS = [
  { href: "/policies/pickup-and-delivery", label: "Pickup & delivery" },
  { href: "/policies/cancellations-and-refunds", label: "Cancellations & refunds" },
  { href: "/policies/privacy", label: "Privacy" },
  { href: "/policies", label: "All policies" },
];

// 44 px tall so stacked links are easy to hit with a thumb (WCAG 2.2 2.5.8 asks for 24).
const footerLink = "inline-flex min-h-11 items-center text-cocoa no-underline hover:underline";
const contactLink = "inline-flex min-h-11 items-center";
const heading = "label-caps mb-4 text-muted";

export function SiteFooter({ store }: { store: StoreSetting }) {
  const closed = (store.closedDays ?? []).map((d) => d.label);
  const story = store.story?.trim();
  const name = store.name.trim();
  return (
    <footer className="overflow-hidden border-t border-line bg-cream text-[0.9375rem] text-cocoa">
      <div className="shell grid grid-cols-[repeat(auto-fit,minmax(min(13rem,100%),1fr))] gap-x-8 gap-y-10 pt-16 pb-12 md:pt-24">
        <section aria-labelledby="footer-shop">
          <h2 id="footer-shop" className={heading}>
            More to shop
          </h2>
          <ul className="flex flex-col">
            {SHOP_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={footerLink}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {story && (
          <section aria-labelledby="footer-story">
            <h2 id="footer-story" className={heading}>
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
          <h2 id="footer-visit" className={heading}>
            Visit the shop
          </h2>
          <address className="not-italic">
            {name}
            <br />
            {store.street}
            <br />
            {store.locality}
          </address>
          {store.tagline && <p className="mt-3 text-muted">{store.tagline}</p>}
        </section>

        <section aria-labelledby="footer-hours">
          <h2 id="footer-hours" className={heading}>
            {store.hoursLabel}
          </h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4">
            {(store.hours ?? []).map((row) => (
              <div key={row.id ?? row.days} className="contents">
                <dt>{row.days}</dt>
                <dd>{row.time}</dd>
              </div>
            ))}
          </dl>
          {closed.length > 0 && <p className="mt-3">Closed {closed.join(", ")}.</p>}
        </section>

        <section aria-labelledby="footer-contact">
          <h2 id="footer-contact" className={heading}>
            Contact
          </h2>
          <ul className="flex flex-col">
            <li>
              <a href={telHref(store.phone)} className={contactLink}>
                {store.phone}
              </a>
            </li>
            <li>
              <a href={`mailto:${store.email}`} className={`${contactLink} break-words`}>
                {store.email}
              </a>
            </li>
            <li>
              <Link href="/contact" className={contactLink}>
                Send us a message
              </Link>
            </li>
          </ul>
          {store.doordashUrl && (
            <p className="mt-2">
              Local delivery:{" "}
              <a href={store.doordashUrl} className="inline-flex min-h-11 items-center">
                order on DoorDash
              </a>
            </p>
          )}
        </section>

        <nav aria-labelledby="footer-policies">
          <h2 id="footer-policies" className={heading}>
            Policies
          </h2>
          <ul className="flex flex-col">
            {POLICY_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={footerLink}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* The shop name as a full-width wordmark, cropped a little by the bottom edge. Sized from
          the name's length so a longer name still fits the width. Decorative: the name is in the
          address above. */}
      <p
        aria-hidden="true"
        data-footer-wordmark
        className="-mb-[0.07em] text-center font-display leading-[0.8] tracking-[-0.03em] whitespace-nowrap text-cocoa select-none"
        style={{ fontSize: `min(22vw, ${(215 / Math.max(name.length, 1)).toFixed(2)}vw)` }}
      >
        {name}
      </p>
    </footer>
  );
}
