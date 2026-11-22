/** A visible FAQ: the same questions and answers a page sends as FAQPage structured data. */
export function FaqList({ id = "faq", heading, faqs }: { id?: string; heading: string; faqs: readonly { q: string; a: string }[] }) {
  if (!faqs.length) return null;
  return (
    <section aria-labelledby={id} className="mb-10 max-w-[68ch]">
      <h2 id={id} className="mb-3 text-2xl">
        {heading}
      </h2>
      <dl className="space-y-4">
        {faqs.map((f) => (
          <div key={f.q}>
            <dt className="font-semibold">{f.q}</dt>
            <dd>{f.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
