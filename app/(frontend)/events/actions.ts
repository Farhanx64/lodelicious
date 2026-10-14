"use server";

import config from "@payload-config";
import { getPayload } from "payload";

import { inquiryFormState } from "@/src/lib/inquiries/service";
import { echoValues, type InquiryFormState } from "@/src/lib/inquiries/shared";
import { TOO_MANY_ATTEMPTS } from "@/src/lib/rate-limit";
import { isRateLimited } from "@/src/lib/rate-limit-server";

/**
 * The chocolate-fountain inquiry (D37). Inquiry-only: it books nothing and takes no deposit. The
 * estimate stored with it is recomputed on the server from the event settings; any figure the
 * browser sent along is ignored.
 */
export async function submitFountain(_prev: InquiryFormState, form: FormData): Promise<InquiryFormState> {
  // Rate limited per visitor (A15); the message keeps what they typed.
  if (await isRateLimited("fountain")) return { error: TOO_MANY_ATTEMPTS, values: echoValues(Object.fromEntries(form)) };
  return inquiryFormState(await getPayload({ config }), "fountain", Object.fromEntries(form));
}
