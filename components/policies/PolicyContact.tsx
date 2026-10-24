import { telHref } from "@/src/lib/phone";
import type { ContactFacts } from "@/src/lib/policies";

/** The shop's contact details, from Store settings, under every policy. */
export function PolicyContact({ contact, id = "policy-contact" }: { contact: ContactFacts; id?: string }) {
  return (
    <section aria-labelledby={id} className="mt-10 border border-gold bg-paper p-6 text-center">
      <h2 id={id} className="mb-3 text-xl">
        Questions? Contact us
      </h2>
      <p>
        {contact.street}, {contact.locality}
        <br />
        <a href={telHref(contact.phone)}>{contact.phone}</a>
        <br />
        <a href={`mailto:${contact.email}`} className="break-words">
          {contact.email}
        </a>
      </p>
      {contact.doordashUrl && (
        <p className="mt-3">
          Local delivery: <a href={contact.doordashUrl}>order on DoorDash</a>
        </p>
      )}
    </section>
  );
}
