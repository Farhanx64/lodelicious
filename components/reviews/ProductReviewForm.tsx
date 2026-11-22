"use client";

import { useActionState, useEffect, useRef } from "react";

import { field, label, primaryButton } from "@/components/checkout/styles";
import { HONEYPOT_FIELD } from "@/src/lib/inquiries/shared";
import { REVIEW_LIMITS, type ReviewFormState } from "@/src/lib/reviews/product-reviews";

type Action = (prev: ReviewFormState, form: FormData) => Promise<ReviewFormState>;

const INITIAL: ReviewFormState = { error: null };

/** The review form under a product (D69). Entries stay after an error; focus moves to the thank-you or the error. */
export function ProductReviewForm({ action, productSlug, productTitle }: { action: Action; productSlug: string; productTitle: string }) {
  const [state, run, pending] = useActionState<ReviewFormState, FormData>(action, INITIAL);
  const v = state.values ?? {};
  const sentRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.sent) sentRef.current?.focus();
    else if (state.error) errorRef.current?.focus();
  }, [state]);

  if (state.sent) {
    return (
      <div ref={sentRef} tabIndex={-1} role="status" className="border border-gold bg-paper p-5 outline-offset-4">
        <p className="mb-1 font-semibold">Thank you for your review.</p>
        <p>We read every review before it goes on the website, so it will appear here once we&rsquo;ve approved it.</p>
      </div>
    );
  }

  return (
    <form action={run} className="border border-line bg-paper p-5">
      <h3 className="mb-1 text-xl">Write a review</h3>
      <p className="mb-4 text-sm text-ink-soft">Tried the {productTitle}? Tell other customers what you thought. Reviews appear after we&rsquo;ve read them.</p>
      <input type="hidden" name="product" value={productSlug} />
      <fieldset className="mb-4">
        <legend className={label}>Your rating</legend>
        <div className="flex flex-wrap gap-2">
          {[5, 4, 3, 2, 1].map((n) => (
            <label key={n} className="inline-flex min-h-11 cursor-pointer items-center gap-2 border border-line px-3 has-[:checked]:border-coastal-deep has-[:checked]:bg-coastal-pale">
              <input type="radio" name="rating" value={n} required defaultChecked={v.rating === String(n)} />
              <span aria-hidden="true">{"★".repeat(n)}</span>
              <span className="sr-only">
                {n} star{n === 1 ? "" : "s"}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mb-4">
        <label htmlFor="review-text" className={label}>
          Your review
        </label>
        <textarea id="review-text" name="text" required rows={4} minLength={REVIEW_LIMITS.minText} maxLength={REVIEW_LIMITS.text} defaultValue={v.text} className={`${field} block`} />
      </div>
      <div className="mb-4 grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="review-name" className={label}>
            First name or initials
          </label>
          <input id="review-name" name="name" required maxLength={REVIEW_LIMITS.name} autoComplete="given-name" defaultValue={v.name} aria-describedby="review-name-hint" className={field} />
          <p id="review-name-hint" className="mt-1 text-sm text-ink-soft">
            Shown with your review.
          </p>
        </div>
        <div>
          <label htmlFor="review-email" className={label}>
            Email (optional)
          </label>
          <input id="review-email" name="email" type="email" maxLength={REVIEW_LIMITS.email} autoComplete="email" defaultValue={v.email} aria-describedby="review-email-hint" className={field} />
          <p id="review-email-hint" className="mt-1 text-sm text-ink-soft">
            Never shown. Only so we can ask you about your review.
          </p>
        </div>
      </div>
      {/* Honeypot: invisible and unreachable for people, tempting for bots. A filled value is dropped silently. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Leave this field empty
          <input name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      {state.error && (
        <p ref={errorRef} tabIndex={-1} role="alert" className="mb-4 border border-error p-3 text-error">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? "Sending…" : "Send my review"}
      </button>
    </form>
  );
}
