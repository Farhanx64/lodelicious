"use client";

import { useFormValues } from "./ActionForm";
import { label, roundField } from "./styles";

/** Email, name and phone. Inside an ActionForm they keep what the customer typed after an error. */
export function ContactFields({ prefix, defaults }: { prefix: string; defaults?: { name?: string; email?: string; phone?: string } }) {
  // A signed-in rewards member's details fill the form first (D47); what the customer typed wins after an error.
  const values = { ...defaults, ...useFormValues() };
  return (
    <fieldset className="mb-6">
      <legend className="mb-3 text-base font-semibold text-ink">Contact</legend>
      <div className="mb-3">
        <label htmlFor={`${prefix}-email`} className={label}>
          Email address
        </label>
        <input id={`${prefix}-email`} name="email" type="email" autoComplete="email" required maxLength={200} defaultValue={values.email} className={roundField} />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-3 sm:grid-cols-2">
        <div className="mb-3">
          <label htmlFor={`${prefix}-name`} className={label}>
            Name
          </label>
          <input id={`${prefix}-name`} name="name" autoComplete="name" required maxLength={100} defaultValue={values.name} className={roundField} />
        </div>
        <div className="mb-3">
          <label htmlFor={`${prefix}-phone`} className={label}>
            Phone
          </label>
          <input id={`${prefix}-phone`} name="phone" type="tel" autoComplete="tel" required maxLength={30} defaultValue={values.phone} className={roundField} />
        </div>
      </div>
    </fieldset>
  );
}
