import { formatBasisPoints, fountainEstimate, MAX_GUESTS, MIN_GUESTS, type FountainTerms } from "@/src/lib/inquiries/estimate";
import { formatCents } from "@/src/lib/money";

/**
 * The live estimate on /events. Uses the same pure function the server runs, but the server
 * recomputes its own figure from the stored settings, so this is a convenience, not a quote.
 * Tax and other approved charges are deliberately not computed: staff confirm them.
 */
export function EstimateSummary({ terms, guests }: { terms: FountainTerms; guests: string }) {
  const estimate = fountainEstimate(guests, terms);
  const hours = `${terms.includedHours} hour${terms.includedHours === 1 ? "" : "s"}`;
  return (
    <div className="border border-gold bg-paper p-4" aria-live="polite" aria-atomic="true" data-estimate>
      <h3 className="mb-2 text-xl">Your estimate</h3>
      {estimate ? (
        <dl className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1">
          <dt>Chocolate fountain, {hours}, setup and service included</dt>
          <dd className="text-right">{formatCents(estimate.baseCents)}</dd>
          <dt>
            {estimate.guests} guest{estimate.guests === 1 ? "" : "s"} × {formatCents(estimate.perGuestCents)}
          </dt>
          <dd className="text-right">{formatCents(estimate.guestsCents)}</dd>
          <dt className="border-t border-line pt-1 font-semibold">Estimated total, before tax</dt>
          <dd className="border-t border-line pt-1 text-right font-semibold" data-estimate-total>
            {formatCents(estimate.totalCents)}
          </dd>
        </dl>
      ) : (
        <p className="mb-3">
          Enter the number of guests ({MIN_GUESTS}–{MAX_GUESTS}) to see an estimate. The base price is {formatCents(terms.baseCents)} for {hours} plus {formatCents(terms.perGuestCents)} per person.
        </p>
      )}
      <p className="text-sm text-ink-soft">
        This is an estimate only, not a booking or a quote. Our staff confirm availability and the final price with you. Sales tax and any other approved charges are
        separate and are confirmed by staff. A {formatBasisPoints(terms.depositPercentBasisPoints)}% deposit is requested only after we confirm your booking, and nothing is charged on this website.
      </p>
    </div>
  );
}
