"use client";

import { US_STATES } from "@/src/lib/shipping/rates";

import { useFormValues } from "./ActionForm";

// One bordered box, a row per part of the address (D56). Each row keeps its own visible label; the
// focus ring is drawn on the row, around the label and the input together.
const row =
  "relative block bg-paper px-3 pt-1.5 pb-1 focus-within:z-10 focus-within:outline-[3px] focus-within:outline-solid focus-within:outline-focus focus-within:-outline-offset-2";
const rowLabel = "block text-xs font-semibold text-ink-soft";
const rowInput = "block min-h-8 w-full bg-transparent text-base text-ink focus-visible:outline-none";

/** The ship-to address (D54), grouped in one box. US only. Keeps what the customer typed after an error. */
export function ShippingAddressFields({ prefix }: { prefix: string }) {
  const v = useFormValues();
  const input = (name: string, text: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className={row}>
      <label htmlFor={`${prefix}-${name}`} className={rowLabel}>
        {text}
      </label>
      <input id={`${prefix}-${name}`} name={name} defaultValue={v[name]} className={rowInput} {...extra} />
    </div>
  );
  return (
    <fieldset className="mb-6">
      <legend className="mb-3 text-base font-semibold text-ink">Shipping address</legend>
      <div className="divide-y divide-ink-soft/40 overflow-clip rounded-lg border border-ink-soft">
        <div className="flex min-h-11 items-center gap-2 bg-paper px-3 py-2">
          <span className="text-xs font-semibold text-ink-soft">Country</span>
          <span>United States</span>
          <span className="ml-auto text-sm text-ink-soft">US addresses only</span>
        </div>
        {input("shipName", "Recipient name (if it isn't you)", { autoComplete: "shipping name", maxLength: 100 })}
        {input("shipLine1", "Street address", { autoComplete: "shipping address-line1", required: true, maxLength: 120 })}
        {input("shipLine2", "Apartment, suite (optional)", { autoComplete: "shipping address-line2", maxLength: 120 })}
        <div className={row}>
          <label htmlFor={`${prefix}-shipState`} className={rowLabel}>
            State
          </label>
          <select id={`${prefix}-shipState`} name="shipState" required defaultValue={v.shipState ?? "MA"} autoComplete="shipping address-level1" className={rowInput}>
            {US_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] divide-x divide-ink-soft/40">
          {input("shipCity", "Town or city", { autoComplete: "shipping address-level2", required: true, maxLength: 60 })}
          {input("shipZip", "ZIP code", { autoComplete: "shipping postal-code", required: true, inputMode: "numeric", pattern: "\\d{5}(-\\d{4})?", maxLength: 10 })}
        </div>
      </div>
    </fieldset>
  );
}
