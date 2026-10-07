"use server";

import config from "@payload-config";
import { getPayload } from "payload";

import { inquiryFormState } from "@/src/lib/inquiries/service";
import type { InquiryFormState } from "@/src/lib/inquiries/shared";

/**
 * The chocolate-fountain inquiry (D37). Inquiry-only: it books nothing and takes no deposit. The
 * estimate stored with it is recomputed on the server from the event settings; any figure the
 * browser sent along is ignored.
 */
export async function submitFountain(_prev: InquiryFormState, form: FormData): Promise<InquiryFormState> {
  return inquiryFormState(await getPayload({ config }), "fountain", Object.fromEntries(form));
}
