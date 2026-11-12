import "server-only";

import type { Media } from "@/payload-types";
import { bagLineLooks } from "@/src/lib/checkout/presentation";
import { EMPTY_RECEIPT, receiptFromBag, type ReceiptData, type ReceiptImage } from "@/src/lib/checkout/receipt";
import { priceBagForCheckout, readCartLines } from "@/src/lib/checkout/service";
import { bagToken, checkoutPayload } from "@/src/lib/checkout/session";

import { FloatingReceipt } from "./FloatingReceipt";

function thumbOf(media: Media | null): ReceiptImage | null {
  const src = media?.sizes?.thumb?.url ?? media?.url;
  return media && src ? { src, alt: "" } : null;
}

/** The bag as the receipt shows it, priced on the server like the bag page. An empty bag costs one read. */
async function loadReceipt(): Promise<ReceiptData> {
  const token = await bagToken();
  if (!token) return EMPTY_RECEIPT;
  const { payload, ctx } = await checkoutPayload();
  if ((await readCartLines(payload, token)).length === 0) return EMPTY_RECEIPT;
  const { bag } = await priceBagForCheckout(payload, token, ctx);
  const looks = await bagLineLooks(
    payload,
    bag.lines.map((l) => l.productId),
  );
  return receiptFromBag(bag, new Map([...looks].map(([id, look]) => [id, thumbOf(look.image)])));
}

/**
 * The floating receipt (D58). Rendered by the storefront layout on every page; the client part
 * hides itself on the bag, checkout and reserve pages and while the bag is empty. Server actions
 * that change the bag revalidate the layout, so these props refresh without a full reload.
 */
export async function ReceiptBar() {
  return <FloatingReceipt data={await loadReceipt()} />;
}
