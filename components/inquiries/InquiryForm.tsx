"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { field, label, primaryButton } from "@/components/checkout/styles";
import { MAX_GUESTS, MIN_GUESTS, type FountainTerms } from "@/src/lib/inquiries/estimate";
import { HONEYPOT_FIELD, MAX_LOCATION_LENGTH, MAX_MESSAGE_LENGTH, type InquiryFormState } from "@/src/lib/inquiries/shared";

import { EstimateSummary } from "./EstimateSummary";

type Action = (prev: InquiryFormState, form: FormData) => Promise<InquiryFormState>;

type Props =
  | {
      kind: "contact";
      action: Action;
      topics: { value: string; label: string }[];
      defaultTopic: string;
      /** The product being asked about, found on the server. Only its slug is sent back; the server looks it up again. */
      item: { slug: string; title: string } | null;
    }
  | {
      kind: "fountain";
      action: Action;
      terms: FountainTerms;
      /** Today's date in the shop's time zone (YYYY-MM-DD), worked out on the server. */
      minDate: string;
    };

const INITIAL: InquiryFormState = { error: null };

/**
 * The /contact and /events forms. On success the form is replaced by a confirmation that says
 * plainly nothing was booked or charged and that the shop will reply by email or phone. After
 * an error the visitor's entries stay in the form (React would otherwise reset it).
 */
export function InquiryForm(props: Props) {
  const [state, run, pending] = useActionState<InquiryFormState, FormData>(props.action, INITIAL);
  const v = state.values ?? {};
  const prefix = props.kind;
  const [guests, setGuests] = useState(v.guests ?? "");
  const sentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.sent) sentRef.current?.focus();
  }, [state.sent]);

  if (state.sent) {
    return (
      <div ref={sentRef} tabIndex={-1} role="status" className="border border-gold bg-paper p-6 outline-offset-4">
        <h2 className="mb-3 text-2xl">Thank you, we&rsquo;ve got your {props.kind === "fountain" ? "request" : "message"}</h2>
        {state.number && (
          <p className="mb-3 text-lg">
            Your reference is <strong>{state.number}</strong>.
          </p>
        )}
        <p className="mb-3">
          {props.kind === "fountain"
            ? "Nothing is booked or charged yet. We'll check availability and confirm the final price with you before anything is booked."
            : "Nothing has been ordered or charged."}{" "}
          The shop will reply by email or phone.
        </p>
      </div>
    );
  }

  const contactDetails = (
    <fieldset className="mb-6">
      <legend className="mb-3 font-display text-xl text-gold-text">Your details</legend>
      <div className="mb-3">
        <label htmlFor={`${prefix}-name`} className={label}>
          Name
        </label>
        <input id={`${prefix}-name`} name="name" autoComplete="name" required maxLength={100} defaultValue={v.name} className={field} />
      </div>
      <div className="mb-3">
        <label htmlFor={`${prefix}-email`} className={label}>
          Email
        </label>
        <input id={`${prefix}-email`} name="email" type="email" autoComplete="email" required maxLength={200} defaultValue={v.email} className={field} />
      </div>
      <div>
        <label htmlFor={`${prefix}-phone`} className={label}>
          Phone
        </label>
        <input id={`${prefix}-phone`} name="phone" type="tel" autoComplete="tel" required maxLength={30} defaultValue={v.phone} className={field} />
      </div>
    </fieldset>
  );

  return (
    <form action={run}>
      {props.kind === "contact" ? (
        <>
          <div className="mb-4">
            <label htmlFor="contact-topic" className={label}>
              What is this about?
            </label>
            <select id="contact-topic" name="topic" required defaultValue={v.topic ?? props.defaultTopic} className={field}>
              {props.topics.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          {props.item && (
            <>
              <input type="hidden" name="item" value={props.item.slug} />
              <p className="mb-4" data-asking-about>
                Asking about: <strong>{props.item.title}</strong>
              </p>
            </>
          )}
          <div className="mb-6">
            <label htmlFor="contact-message" className={label}>
              Your message
            </label>
            <textarea id="contact-message" name="message" required rows={6} maxLength={MAX_MESSAGE_LENGTH} defaultValue={v.message} className={`${field} block`} />
          </div>
        </>
      ) : (
        <>
          <fieldset className="mb-6">
            <legend className="mb-3 font-display text-xl text-gold-text">Your event</legend>
            <div className="mb-3 grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="fountain-date" className={label}>
                  Event date
                </label>
                <input id="fountain-date" name="eventDate" type="date" required min={props.minDate} defaultValue={v.eventDate} className={field} />
              </div>
              <div>
                <label htmlFor="fountain-setup" className={label}>
                  Preferred setup time
                </label>
                <input id="fountain-setup" name="setupTime" type="time" required defaultValue={v.setupTime} className={field} />
              </div>
            </div>
            <div className="mb-3">
              <label htmlFor="fountain-location" className={label}>
                Event location
              </label>
              <input id="fountain-location" name="location" required maxLength={MAX_LOCATION_LENGTH} autoComplete="off" defaultValue={v.location} className={field} />
            </div>
            <div className="mb-4">
              <label htmlFor="fountain-guests" className={label}>
                Number of guests
              </label>
              <input
                id="fountain-guests"
                name="guests"
                type="number"
                inputMode="numeric"
                required
                min={MIN_GUESTS}
                max={MAX_GUESTS}
                step={1}
                value={guests}
                onChange={(e) => setGuests(e.target.value)}
                aria-describedby="fountain-guests-hint"
                className={field}
              />
              <p id="fountain-guests-hint" className="mt-1 text-sm text-ink-soft">
                A whole number from {MIN_GUESTS} to {MAX_GUESTS}.
              </p>
            </div>
            <EstimateSummary terms={props.terms} guests={guests} />
          </fieldset>
          <div className="mb-6">
            <label htmlFor="fountain-message" className={label}>
              Anything else we should know? (optional)
            </label>
            <textarea id="fountain-message" name="message" rows={4} maxLength={MAX_MESSAGE_LENGTH} defaultValue={v.message} className={`${field} block`} />
          </div>
        </>
      )}

      {contactDetails}

      {/* Honeypot: invisible and unreachable for people, tempting for bots. A filled value is dropped silently. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Leave this field empty
          <input name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      {state.error && (
        <p role="alert" className="mb-4 border border-error p-3 text-error">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${primaryButton} w-full`}>
        {pending ? "Sending…" : props.kind === "fountain" ? "Send my request" : "Send message"}
      </button>
      <p className="mt-3 text-sm text-ink-soft">
        {props.kind === "fountain"
          ? "Sending this does not book or charge anything. We'll reply by email or phone to confirm."
          : "We'll reply by email or phone. Please don't send card numbers or other payment details."}
      </p>
    </form>
  );
}
