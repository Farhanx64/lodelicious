import type { StoreSetting } from "@/payload-types";
import { telHref } from "@/src/lib/phone";

type Store = Pick<StoreSetting, "name" | "street" | "locality" | "phone" | "email" | "hoursLabel" | "hours" | "closedDays" | "doordashUrl">;

/** Address, phone, email, hours and the DoorDash link: all from Store settings, nothing hard-coded. */
export function StoreDetails({ store }: { store: Store }) {
  const closed = (store.closedDays ?? []).map((d) => d.label);
  const hours = store.hours ?? [];
  return (
    <section aria-labelledby="store-details" className="border border-gold bg-paper p-6">
      <h2 id="store-details" className="mb-4 text-2xl">
        Visit or call
      </h2>
      <address className="mb-4 not-italic">
        {store.name}
        <br />
        {store.street}
        <br />
        {store.locality}
      </address>
      <p className="mb-4">
        <a href={telHref(store.phone)}>{store.phone}</a>
        <br />
        <a href={`mailto:${store.email}`}>{store.email}</a>
      </p>
      {hours.length > 0 && (
        <>
          <h3 className="mb-2 text-lg">{store.hoursLabel}</h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4">
            {hours.map((row) => (
              <div key={row.id ?? row.days} className="contents">
                <dt className="font-semibold">{row.days}</dt>
                <dd>{row.time}</dd>
              </div>
            ))}
          </dl>
          {closed.length > 0 && <p className="mt-2">Closed {closed.join(", ")}.</p>}
        </>
      )}
      {store.doordashUrl && (
        <p className="mt-4">
          Local delivery: <a href={store.doordashUrl}>order on DoorDash</a>
        </p>
      )}
    </section>
  );
}
