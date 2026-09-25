import type { StoreSetting } from "@/payload-types";
import { telHref } from "@/src/lib/phone";

export function SiteFooter({ store }: { store: StoreSetting }) {
  const closed = (store.closedDays ?? []).map((d) => d.label);
  return (
    <footer className="on-ink border-t border-gold bg-ink py-10 text-[0.95rem] text-cream">
      <div className="mx-auto grid w-[min(100%-2rem,72rem)] grid-cols-[repeat(auto-fit,minmax(min(14rem,100%),1fr))] gap-6">
        <section aria-labelledby="footer-visit">
          <h2 id="footer-visit" className="mb-3 text-xl text-gold-light">
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
          <h2 id="footer-hours" className="mb-3 text-xl text-gold-light">
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
          <h2 id="footer-contact" className="mb-3 text-xl text-gold-light">
            Contact
          </h2>
          <p>
            <a href={telHref(store.phone)} className="text-cream">
              {store.phone}
            </a>
            <br />
            <a href={`mailto:${store.email}`} className="break-words text-cream">
              {store.email}
            </a>
          </p>
        </section>
      </div>
    </footer>
  );
}
