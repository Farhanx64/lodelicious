"use server";

import config from "@payload-config";
import { getPayload } from "payload";

import { inquiryFormState } from "@/src/lib/inquiries/service";
import { echoValues, type InquiryFormState } from "@/src/lib/inquiries/shared";
import { TOO_MANY_ATTEMPTS } from "@/src/lib/rate-limit";
import { isRateLimited } from "@/src/lib/rate-limit-server";

/**
 * The general inquiry form. Creates a staff-review inquiry; nothing is ordered or charged. Next.js
 * compares the Origin header of every server-action request with the site's host (CSRF), and the
 * service validates and sanitizes every field again: the browser is never trusted.
 */
export async function submitContact(_prev: InquiryFormState, form: FormData): Promise<InquiryFormState> {
  // Rate limited per visitor (A15); the message keeps what they typed.
  if (await isRateLimited("contact")) return { error: TOO_MANY_ATTEMPTS, values: echoValues(Object.fromEntries(form)) };
  return inquiryFormState(await getPayload({ config }), "contact", Object.fromEntries(form));
}
