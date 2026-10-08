"use client";

import { FieldDescription, useField } from "@payloadcms/ui";
import type { NumberFieldDescriptionClientComponent } from "payload";

import { formatCents } from "@/src/lib/money";

/**
 * The description under a cents field, led by the amount in dollars (2575 → "$25.75 · …"). It
 * follows the value as staff type, so a missing or extra zero shows before the form is saved.
 */
export const CentsDescription: NumberFieldDescriptionClientComponent = ({ field, path }) => {
  const { value } = useField<number | null>({ path });
  const dollars = typeof value === "number" && Number.isSafeInteger(value) ? formatCents(value) : null;
  const description = typeof field.admin?.description === "string" ? field.admin.description : null;
  const text = [dollars, description].filter(Boolean).join(" · ");
  return text ? <FieldDescription description={text} path={path} /> : null;
};
