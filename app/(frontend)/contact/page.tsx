import config from "@payload-config";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPayload } from "payload";

import { InquiryForm } from "@/components/inquiries/InquiryForm";
import { StoreDetails } from "@/components/inquiries/StoreDetails";
import { findPublishedItem } from "@/src/lib/inquiries/service";
import { CONTACT_TOPICS, TOPIC_LABELS, isContactTopic, topicForProduct } from "@/src/lib/inquiries/shared";
import { getStoreSettings } from "@/src/lib/store";

import { submitContact } from "./actions";

export const metadata: Metadata = {
  title: "Contact",
  description: "Ask us about a product, a gift or a special order. Find our address, phone, email and hours.",
};

type Params = { topic?: string | string[]; item?: string | string[] };
type Props = { searchParams: Promise<Params> };

const first = (value: string | string[] | undefined): string => (Array.isArray(value) ? (value[0] ?? "") : (value ?? ""));

export default async function ContactPage({ searchParams }: Props) {
  const params = await searchParams;
  const topic = first(params.topic);
  // The fountain has its own form, with the estimate.
  if (topic === "fountain") redirect("/events");

  const payload = await getPayload({ config });
  // ?item= is looked up against published products only; an unknown slug is simply ignored.
  const [store, found] = await Promise.all([getStoreSettings(), findPublishedItem(payload, first(params.item))]);
  const defaultTopic = isContactTopic(topic) ? topic : found ? topicForProduct(found.categorySlug) : "general";

  return (
    <div className="mx-auto w-[min(100%-2rem,60rem)]">
      <h1 className="mb-2 text-[clamp(2.25rem,5vw,3.25rem)]">Contact</h1>
      <p className="mb-8 max-w-[68ch] text-ink-soft">
        Ask us about a product, a gift or a special order, such as the Baby White or Cowboy basket, a filled ceramic or a seasonal gift box. We&rsquo;ll reply by email or phone.
      </p>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="contact-form">
          <h2 id="contact-form" className="mb-4 text-2xl">
            Send us a message
          </h2>
          <InquiryForm
            kind="contact"
            action={submitContact}
            topics={CONTACT_TOPICS.map((value) => ({ value, label: TOPIC_LABELS[value] }))}
            defaultTopic={defaultTopic}
            item={found ? { slug: found.slug, title: found.title } : null}
          />
          <p className="mt-6">
            Planning an event? See our <Link href="/events">chocolate fountain rentals</Link>.
          </p>
        </section>
        <StoreDetails store={store} />
      </div>
    </div>
  );
}
