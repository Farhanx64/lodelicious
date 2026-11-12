"use client";

import { useFormValues } from "./ActionForm";
import { label, roundField } from "./styles";

/** The optional "Notes for the shop" box on checkout. Keeps its text after an error. */
export function NotesField({ id }: { id: string }) {
  const values = useFormValues();
  return (
    <>
      <label htmlFor={id} className={label}>
        Notes for the shop (optional)
      </label>
      <textarea id={id} name="notes" maxLength={500} rows={3} defaultValue={values.notes} className={roundField} />
    </>
  );
}

/**
 * The deposit / pay-in-full choice on the reservation form. The amounts are formatted by the
 * server page; this only remembers which option was picked across an error.
 */
export function PaymentChoice({
  depositLabel,
  chargeNowText,
  balanceDueText,
  fullText,
}: {
  depositLabel: string;
  chargeNowText: string;
  balanceDueText: string;
  /** Present only when paying in full is allowed. */
  fullText?: string;
}) {
  const values = useFormValues();
  const full = values.payment === "full" && fullText !== undefined;
  return (
    <fieldset className="mb-4">
      <legend className="mb-3 text-base font-semibold text-ink">How much to pay now</legend>
      <label className="mb-2 flex min-h-11 gap-3 rounded-lg border border-ink-soft p-3 has-checked:border-coastal-deep has-checked:bg-coastal-pale">
        <input type="radio" name="payment" value="deposit" defaultChecked={!full} className="mt-1 size-5 accent-coastal-deep" />
        <span>
          Pay the {depositLabel.toLowerCase()} now: <strong>{chargeNowText}</strong>
          <span className="block text-sm text-ink-soft">{balanceDueText} due at pickup</span>
        </span>
      </label>
      {fullText !== undefined && (
        <label className="flex min-h-11 gap-3 rounded-lg border border-ink-soft p-3 has-checked:border-coastal-deep has-checked:bg-coastal-pale">
          <input type="radio" name="payment" value="full" defaultChecked={full} className="mt-1 size-5 accent-coastal-deep" />
          <span>
            Pay in full now: <strong>{fullText}</strong>
          </span>
        </label>
      )}
    </fieldset>
  );
}
