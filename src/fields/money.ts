import type { Field } from "payload";

/**
 * Admin display for integer-cent fields: dollars in list columns, and the amount in dollars at the
 * start of the field's description while staff type. Storage stays integer cents.
 */
export const centsComponents = {
  Cell: "@/components/admin/CentsCell#CentsCell",
  Description: "@/components/admin/CentsDescription#CentsDescription",
};

/** Adds the cents display to a number field built by a local helper. */
export const withCents = (field: Field): Field => ({ ...field, admin: { ...field.admin, components: centsComponents } }) as Field;
