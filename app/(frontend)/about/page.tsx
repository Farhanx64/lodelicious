import type { Metadata } from "next";

import { Bow } from "@/components/brand/Bow";
import { telHref } from "@/src/lib/phone";
import { getStoreSettings } from "@/src/lib/store";

export const metadata: Metadata = { title: "About" };

export default async function AboutPage() {
  const store = await getStoreSettings();
  const story = store.story?.trim();
  return (
    <div className="mx-auto w-[min(100%-2rem,44rem)]">
      <Bow className="mx-auto mb-4 w-14 text-gold" />
      <h1 className="mb-8 text-center text-[clamp(2rem,5vw,3rem)]">{store.storyHeading || "Our story"}</h1>
      {story ? (
        // Lody's own words from Store settings; a blank line starts a new paragraph.
        story.split(/\n\s*\n/).map((paragraph, i) => (
          <p key={i} className="mb-4 text-lg whitespace-pre-line">
            {paragraph}
          </p>
        ))
      ) : (
        <p data-story-pending className="mb-4 text-center text-lg">
          Our story is coming soon.
        </p>
      )}
      <section aria-labelledby="visit" className="mt-10 border border-gold bg-paper p-6 text-center">
        <h2 id="visit" className="mb-3 text-xl">
          Visit us
        </h2>
        <p>
          {store.street}, {store.locality}
          <br />
          <a href={telHref(store.phone)}>{store.phone}</a>
        </p>
      </section>
    </div>
  );
}
