import config from "@payload-config";
import type { Metadata } from "next";
import Link from "next/link";
import { getPayload } from "payload";

import { FountainOffer } from "@/components/inquiries/FountainOffer";
import { InquiryForm } from "@/components/inquiries/InquiryForm";
import { loadEventOffer } from "@/src/lib/inquiries/service";
import { todayIn } from "@/src/lib/inquiries/parse";
import { telHref } from "@/src/lib/phone";
import { getStoreSettings } from "@/src/lib/store";

import { submitFountain } from "./actions";

export const metadata: Metadata = {
  title: "Chocolate fountain rentals",
  description: "Add a chocolate fountain to your event. See the price, work out an estimate and send us your request.",
};

export default async function EventsPage() {
  const payload = await getPayload({ config });
  const [offer, store] = await Promise.all([loadEventOffer(payload), getStoreSettings()]);

  return (
    <div className="mx-auto w-[min(100%-2rem,60rem)]">
      <h1 className="mb-2 text-[clamp(2.25rem,5vw,3.25rem)]">Chocolate fountain rentals</h1>

      {!offer.enabled ? (
        <p className="mb-6 max-w-[68ch] border-l-4 border-gold bg-paper p-4" data-fountain-closed>
          Chocolate fountain rentals aren&rsquo;t available through our website right now. Please <Link href="/contact">contact us</Link> or call{" "}
          <a href={telHref(store.phone)}>{store.phone}</a>.
        </p>
      ) : (
        <>
          <p className="mb-8 max-w-[68ch] text-ink-soft">
            Add a flowing chocolate fountain to your party or event. Tell us when and where, and how many guests, and we&rsquo;ll get back to you by email or phone to confirm.
          </p>
          <div className="mb-10">
            <FountainOffer offer={offer} />
          </div>
          <section aria-labelledby="request">
            <h2 id="request" className="mb-4 text-2xl">
              Request a chocolate fountain
            </h2>
            <InquiryForm kind="fountain" action={submitFountain} terms={offer.terms} minDate={todayIn(new Date())} />
          </section>
        </>
      )}
    </div>
  );
}
