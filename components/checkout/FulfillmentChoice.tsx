import Link from "next/link";

import { formatCents } from "@/src/lib/money";
import { whyNoShipping, type FulfillmentMethod, type ShippingQuote } from "@/src/lib/shipping/rates";

/**
 * Pickup or shipping (D54), as a two-part switch at the top of the form (D56). The two halves are
 * links, so the order summary is always worked out on the server for the method shown, with or
 * without JavaScript; the current one is marked `aria-current`. Shipping that this order can't have
 * is shown greyed out, with the reason under the switch.
 */
export function FulfillmentChoice({ path, method, shipping }: { path: string; method: FulfillmentMethod; shipping: ShippingQuote }) {
  const option = (value: FulfillmentMethod, title: string, detail: string, enabled: boolean) => {
    const current = method === value;
    const base = "flex min-h-12 flex-1 flex-col items-center justify-center rounded-md px-3 py-1.5 text-center no-underline";
    if (!enabled) {
      return (
        <span className={`${base} text-ink-soft`} aria-disabled="true">
          <span className="line-through decoration-ink-soft/60">{title}</span>
          <span className="text-xs">{detail}</span>
        </span>
      );
    }
    return (
      <Link
        href={value === "ship" ? `${path}?method=ship` : path}
        aria-current={current ? "true" : undefined}
        className={`${base} ${current ? "bg-paper font-semibold text-ink shadow-sm ring-1 ring-coastal" : "text-ink-soft hover:text-ink"}`}
        scroll={false}
      >
        <span>{title}</span>
        <span className="text-xs font-normal">{detail}</span>
      </Link>
    );
  };
  return (
    <div className="mb-6">
      <p id="fulfillment-heading" className="sr-only">
        Pickup or shipping
      </p>
      <div role="group" aria-labelledby="fulfillment-heading" className="flex gap-1 rounded-lg bg-coastal-pale p-1">
        {option("pickup", "Pickup", "Free, in our shop", true)}
        {option("ship", "Ship", shipping.available ? formatCents(shipping.cents) : "Not available", shipping.available)}
      </div>
      {!shipping.available && shipping.reason === "not_shippable" && <p className="mt-2 text-sm text-ink-soft">{whyNoShipping(shipping)}</p>}
      <input type="hidden" name="method" value={method} />
    </div>
  );
}
