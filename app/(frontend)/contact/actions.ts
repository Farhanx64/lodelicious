"use server";

import config from "@payload-config";
import { getPayload } from "payload";

import { inquiryFormState } from "@/src/lib/inquiries/service";
import type { InquiryFormState } from "@/src/lib/inquiries/shared";

/**
 * The general inquiry form. Creates a staff-review inquiry; nothing is ordered or charged. Next.js
 * checks the Origin header of every server-action request (CSRF), and the service validates and
 * sanitizes every field again: the browser is never trusted.
 */
export async function submitContact(_prev: InquiryFormState, form: FormData): Promise<InquiryFormState> {
  return inquiryFormState(await getPayload({ config }), "contact", Object.fromEntries(form));
}
