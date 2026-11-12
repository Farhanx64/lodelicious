import Link from "next/link";

import { formatCents } from "@/src/lib/money";
import { whyNoShipping, type FulfillmentMethod, type ShippingQuote } from "@/src/lib/shipping/rates";

/**
 * Pickup or shipping (D54), as two links so the order summary beside the form is always worked out
 * on the server for the method shown, with or without JavaScript.
 */
export function FulfillmentChoice({ path, method, shipping }: { path: string; method: FulfillmentMethod; shipping: ShippingQuote }) {
  const option = (value: FulfillmentMethod, title: string, detail: string, enabled: boolean) => {
    const current = method === value;
    const base = "flex min-h-11 flex-1 flex-col justify-center border px-4 py-2 no-underline";
    const look = current ? "border-gold-text bg-blush font-semibold text-ink" : "border-ink-soft bg-paper text-ink";
    if (!enabled) {
      return (
        <span className={`${base} border-line text-ink-soft`} aria-disabled="true">
          <span>{title}</span>
          <span className="text-sm">{detail}</span>
        </span>
      );
    }
    return (
      <Link href={value === "ship" ? `${path}?method=ship` : path} aria-current={current ? "true" : undefined} className={`${base} ${look}`} scroll={false}>
        <span>{title}</span>
        <span className="text-sm">{detail}</span>
      </Link>
    );
  };
  return (
    <div className="mb-4">
      <p className="mb-2 font-display text-xl text-gold-text" id="fulfillment-heading">
        Pickup or shipping
      </p>
      <div role="group" aria-labelledby="fulfillment-heading" className="flex flex-wrap gap-2">
        {option("pickup", "Pick up in our shop", "Free", true)}
        {option("ship", "Ship it to me", shipping.available ? formatCents(shipping.cents) : "Not available for this order", shipping.available)}
      </div>
      {!shipping.available && shipping.reason === "not_shippable" && <p className="mt-2 text-sm text-ink-soft">{whyNoShipping(shipping)}</p>}
      <input type="hidden" name="method" value={method} />
    </div>
  );
}
