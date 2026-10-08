import { formatBasisPoints } from "@/src/lib/inquiries/estimate";
import type { EventOffer } from "@/src/lib/inquiries/offer";
import { formatCents } from "@/src/lib/money";

/**
 * The fountain offer, straight from the event-settings global. Terms that are still undecided
 * (cancellation, service area, minimum guests, extensions) appear only once someone has filled
 * them in; nothing is invented here.
 */
export function FountainOffer({ offer }: { offer: EventOffer }) {
  const { terms, open } = offer;
  const hours = `${terms.includedHours} hour${terms.includedHours === 1 ? "" : "s"}`;
  const breakdown =
    terms.chocolatePerGuestCents !== null && terms.fruitPerGuestCents !== null
      ? ` (${formatCents(terms.chocolatePerGuestCents)} chocolate + ${formatCents(terms.fruitPerGuestCents)} fruit)`
      : "";
  const extras: { label: string; text: string }[] = [
    open.minimumGuests !== null ? { label: "Minimum guests", text: String(open.minimumGuests) } : null,
    open.serviceArea ? { label: "Where we travel", text: open.serviceArea } : null,
    open.cancellation ? { label: "Cancellation", text: open.cancellation } : null,
    open.extensions ? { label: "Extra time", text: open.extensions } : null,
  ].filter((x): x is { label: string; text: string } => x !== null);

  return (
    <section aria-labelledby="fountain-offer" className="border border-gold bg-paper p-6">
      <h2 id="fountain-offer" className="mb-3 text-2xl">
        The offer
      </h2>
      <ul className="mb-4 list-disc pl-6">
        <li>
          <strong>{formatCents(terms.baseCents)}</strong> for {hours}, including setup and service.
        </li>
        <li>
          Plus <strong>{formatCents(terms.perGuestCents)}</strong> per person{breakdown}.
        </li>
        <li>
          A {formatBasisPoints(terms.depositPercentBasisPoints)}% deposit is requested once we&rsquo;ve confirmed your booking, not when you send the request.
        </li>
      </ul>
      <p className="mb-2">
        Sending a request books nothing and charges nothing. We confirm availability, the final price, any sales tax and other approved charges, and the details of your event with you before anything is booked.
      </p>
      {extras.length > 0 && (
        <dl className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-x-4 gap-y-1 sm:grid-cols-[auto_minmax(0,1fr)]" data-fountain-terms>
          {extras.map((e) => (
            <div key={e.label} className="contents">
              <dt className="font-semibold">{e.label}</dt>
              <dd className="whitespace-pre-line">{e.text}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
