"use client";

import { US_STATES } from "@/src/lib/shipping/rates";

import { useFormValues } from "./ActionForm";
import { field, label } from "./styles";

/** The ship-to address (D54). US only. Keeps what the customer typed after an error. */
export function ShippingAddressFields({ prefix }: { prefix: string }) {
  const v = useFormValues();
  const input = (name: string, text: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="mb-3">
      <label htmlFor={`${prefix}-${name}`} className={label}>
        {text}
      </label>
      <input id={`${prefix}-${name}`} name={name} defaultValue={v[name]} className={field} {...extra} />
    </div>
  );
  return (
    <div>
      {input("shipName", "Recipient name (if it isn't you)", { autoComplete: "shipping name", maxLength: 100 })}
      {input("shipLine1", "Street address", { autoComplete: "shipping address-line1", required: true, maxLength: 120 })}
      {input("shipLine2", "Apartment, suite (optional)", { autoComplete: "shipping address-line2", maxLength: 120 })}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        {input("shipCity", "Town or city", { autoComplete: "shipping address-level2", required: true, maxLength: 60 })}
        <div className="mb-3">
          <label htmlFor={`${prefix}-shipState`} className={label}>
            State
          </label>
          <select id={`${prefix}-shipState`} name="shipState" required defaultValue={v.shipState ?? "MA"} autoComplete="shipping address-level1" className={field}>
            {US_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        {input("shipZip", "ZIP code", { autoComplete: "shipping postal-code", required: true, inputMode: "numeric", pattern: "\\d{5}(-\\d{4})?", maxLength: 10 })}
      </div>
    </div>
  );
}
