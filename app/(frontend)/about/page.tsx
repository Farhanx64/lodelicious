import type { Metadata } from "next";

import { telHref } from "@/src/lib/phone";
import { getStoreSettings } from "@/src/lib/store";
import { Accent } from "@/components/ui/Accent";

export const metadata: Metadata = { title: "About" };

export default async function AboutPage() {
  const store = await getStoreSettings();
  const story = store.story?.trim();
  return (
    <div className="shell page max-w-[50rem]">
      <h1 className="mb-10 text-center">
        <Accent text={store.storyHeading || "Our story"} />
      </h1>
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
      <section aria-labelledby="visit" className="mt-10 panel text-center">
        <h2 id="visit" className="mb-3">
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
