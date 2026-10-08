/**
 * What a checkout server action hands back to its form (D41, audit A13). React 19 resets a
 * `<form action>` once the action finishes, whatever the result, so after an error the customer's
 * entries would be gone. The action returns them in `values` and the form feeds them back as
 * `defaultValue`. Only the known fields are echoed, as short strings; nothing else is read back.
 */
export type FormState = {
  error: string | null;
  /** The customer's own entries, echoed back after an error so they don't have to type them again. */
  values?: Record<string, string>;
};

/** Fields the checkout, reservation and add-to-bag forms send. */
export const CHECKOUT_FIELDS = ["name", "email", "phone", "pickup", "notes", "payment", "unitId", "quantity"] as const;

const MAX_ECHOED_LENGTH = 600;

export function echoFormValues(form: FormData | Record<string, unknown>, fields: readonly string[] = CHECKOUT_FIELDS): Record<string, string> {
  const read = (name: string): unknown => (form instanceof FormData ? form.get(name) : form[name]);
  const values: Record<string, string> = {};
  for (const name of fields) {
    const value = read(name);
    if (typeof value === "string") values[name] = value.slice(0, MAX_ECHOED_LENGTH);
  }
  return values;
}

/** An error result that keeps the customer's entries. */
export function failedWith(error: string, form: FormData | Record<string, unknown>): FormState {
  return { error, values: echoFormValues(form) };
}
