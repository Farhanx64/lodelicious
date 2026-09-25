import { telHref } from "@/src/lib/phone";
import { getStoreSettings } from "@/src/lib/store";

export default async function HomePage() {
  const store = await getStoreSettings();

  // Milestone 1 shell. The real home page (curated baskets, personalization, fulfillment
  // summary) arrives with the storefront in milestone 3.
  return (
    <div className="mx-auto w-[min(100%-2rem,72rem)]">
      <h1 className="mb-4 text-[clamp(2.25rem,5vw,3.5rem)]">{store.name}</h1>
      <p className="max-w-[68ch]">
        Gift baskets, chocolates and sweets from our shop at {store.street}, {store.locality}. Our online
        store is being prepared; for orders today, call{" "}
        <a href={telHref(store.phone)}>{store.phone}</a> or visit us in person.
      </p>
    </div>
  );
}
