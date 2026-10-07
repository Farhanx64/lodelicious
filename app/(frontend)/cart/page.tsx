import type { Metadata } from "next";
import Link from "next/link";

import { secondaryButton, primaryButton } from "@/components/checkout/styles";
import { Summary } from "@/components/checkout/Summary";
import { PRICE_TO_BE_CONFIRMED } from "@/src/lib/catalog/product";
import { priceBag } from "@/src/lib/checkout/service";
import { bagToken, checkoutPayload } from "@/src/lib/checkout/session";
import { formatCents } from "@/src/lib/money";

import { updateBagLine } from "./actions";

export const metadata: Metadata = { title: "Shopping bag", robots: { index: false } };

export default async function CartPage() {
  const { payload, ctx } = await checkoutPayload();
  const bag = await priceBag(payload, await bagToken(), ctx);

  if (bag.lines.length === 0) {
    return (
      <div className="mx-auto w-[min(100%-2rem,44rem)] py-6 text-center">
        <h1 className="mb-4 text-[clamp(1.75rem,5vw,2.5rem)]">Shopping bag</h1>
        <p className="mb-6 text-lg">Your bag is empty.</p>
        <p className="flex flex-wrap justify-center gap-3">
          <Link href="/shop" className={primaryButton}>
            Shop sweets
          </Link>
          <Link href="/build-a-basket" className={secondaryButton}>
            Reserve a custom basket
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-[min(100%-2rem,60rem)]">
      <h1 className="mb-6 text-[clamp(1.75rem,5vw,2.5rem)]">Shopping bag</h1>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <ul className="divide-y divide-line border-y border-line">
          {bag.lines.map((line) => (
            <li key={line.unitId} className="py-4">
              <div className="mb-2 flex flex-wrap justify-between gap-2">
                <Link href={`/shop/${line.slug}`} className="font-display text-xl text-gold-text">
                  {line.title}
                  {line.optionLabel ? ` — ${line.optionLabel}` : ""}
                </Link>
                <span>{line.priceApproved ? formatCents(line.lineTotalCents) : PRICE_TO_BE_CONFIRMED}</span>
              </div>
              {line.priceApproved && <p className="mb-2 text-sm text-ink-soft">{formatCents(line.unitPriceCents)} each</p>}
              {line.problem && (
                <p role="alert" className={`mb-2 text-sm ${line.problem.blocking ? "text-error" : "text-ink"}`}>
                  {line.problem.message}
                </p>
              )}
              <form action={updateBagLine} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="unitId" value={line.unitId} />
                <label className="text-sm">
                  <span className="mb-1 block font-semibold">Quantity</span>
                  <input name="quantity" type="number" min={1} max={20} defaultValue={line.quantity} className="min-h-11 w-20 border border-ink-soft bg-paper px-2" />
                </label>
                <button type="submit" className={secondaryButton}>
                  Update
                </button>
                <button type="submit" name="remove" value="1" className="min-h-11 px-3 text-sm underline">
                  Remove<span className="sr-only"> {line.title}</span>
                </button>
              </form>
            </li>
          ))}
        </ul>
        <div>
          <Summary
            lines={bag.payable.map((l) => ({ key: l.unitId, title: l.title, detail: l.optionLabel, quantity: l.quantity, totalCents: l.lineTotalCents }))}
            subtotalCents={bag.subtotalCents}
            taxCents={bag.taxCents}
            totalCents={bag.totalCents}
            taxApproved={bag.taxApproved}
          />
          <p className="mt-4 text-sm text-ink-soft">Pickup in our Plymouth shop. Custom baskets are reserved separately from Build a Basket.</p>
          {bag.blocking ? (
            <p className="mt-4 text-error">Remove the unavailable items to continue.</p>
          ) : (
            <Link href="/checkout" className={`${primaryButton} mt-4 w-full`}>
              Checkout
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
