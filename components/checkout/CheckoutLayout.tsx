import Link from "next/link";
import { Fragment } from "react";

import { ProductImage } from "@/components/catalog/ProductImage";
import type { Media } from "@/payload-types";
import { formatCents } from "@/src/lib/money";

import { InfoTip, SummaryDisclosure } from "./OrderSummaryParts";

/**
 * The checkout and reserve pages' two-column panel (D56): the order on a soft pink panel on the
 * left, the form on white on the right. One column on a phone, the order folded away at the top.
 */
export const panelGrid =
  "grid grid-cols-[minmax(0,1fr)] overflow-clip border border-line bg-paper md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:rounded-2xl md:shadow-sm";
export const leftColumn = "bg-coastal-pale px-4 py-5 sm:px-6 md:px-10 md:py-8";
export const rightColumn = "px-4 pt-6 pb-4 sm:px-6 md:px-10 md:py-8";
/** A white card on the pink panel. */
export const card = "rounded-xl border border-line bg-paper";
/** The small section headings inside the form. */
export const sectionHeading = "mb-3 font-sans text-base font-semibold normal-case tracking-normal text-ink";

export function LockIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="currentColor" className={className}>
      <path d="M8 1a3.5 3.5 0 0 0-3.5 3.5V6H4a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 4 15h8a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 12 6h-.5V4.5A3.5 3.5 0 0 0 8 1Zm2 5H6V4.5a2 2 0 1 1 4 0V6Z" />
    </svg>
  );
}

/** Close link back to the bag (or basket builder) and the breadcrumb, at the top of the order panel. */
export function CheckoutTopBar({ back, current }: { back: { href: string; label: string }; current: string }) {
  return (
    <div className="mb-6 flex items-center gap-3 md:mb-10">
      <Link
        href={back.href}
        aria-label={`Close checkout, back to ${back.label.toLowerCase()}`}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-line bg-paper text-ink no-underline"
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </Link>
      <nav aria-label="Breadcrumb" className="border-l border-line pl-3 text-sm">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href={back.href} className="text-ink-soft">
              {back.label}
            </Link>
          </li>
          <li aria-hidden="true" className="text-ink-soft">
            /
          </li>
          <li aria-current="page" className="font-semibold text-ink">
            {current}
          </li>
        </ol>
      </nav>
    </div>
  );
}

/**
 * "Order summary" with its item count; on a phone the summary is behind a "Show order summary · $X"
 * button, open from the tablet width up.
 */
export function OrderSummarySection({ heading, count, totalCents, children }: { heading: string; count: number; totalCents: number; children: React.ReactNode }) {
  return (
    <SummaryDisclosure id="order-summary" totalLabel={formatCents(totalCents)}>
      <h2 className="mb-4 flex items-center gap-3 font-sans text-2xl font-semibold normal-case tracking-normal text-ink">
        {heading}
        <span className="rounded-full border border-line bg-paper px-2.5 py-0.5 text-xs font-normal text-ink-soft">
          {count} {count === 1 ? "item" : "items"}
        </span>
      </h2>
      {children}
    </SummaryDisclosure>
  );
}

export type ItemCardProps = {
  title: string;
  /** Category, option or "Gift basket" line under the name. */
  detail?: string | null;
  quantity: number;
  totalCents: number;
  image?: Media | null;
  /** Quantity stepper; without it the quantity is shown as text. */
  stepper?: React.ReactNode;
  /** The remove (X) button. */
  remove?: React.ReactNode;
  note?: React.ReactNode;
};

/** One line of the order: photo, name, detail line, quantity, line price, and on checkout the remove button. */
export function ItemCard({ title, detail, quantity, totalCents, image, stepper, remove, note }: ItemCardProps) {
  return (
    <li className={`${card} relative flex gap-3 p-3 sm:gap-4`}>
      {image !== undefined && <ProductImage media={image} size="thumb" decorative className="size-20 shrink-0 rounded-lg border border-line sm:size-24" />}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className={`font-semibold leading-snug break-words ${remove ? "pr-10" : ""}`}>{title}</p>
        {detail && <p className="text-sm text-ink-soft">{detail}</p>}
        {note}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-1">
          {stepper ?? <p className="text-sm text-ink-soft">Qty {quantity}</p>}
          <p className="font-semibold whitespace-nowrap">{formatCents(totalCents)}</p>
        </div>
      </div>
      {remove && <div className="absolute top-1 right-1">{remove}</div>}
    </li>
  );
}

export type TotalsProps = {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  taxApproved: boolean;
  /** What the tax info button says, e.g. "Sales tax 6.25% on taxable items. Shipping isn't taxed." */
  taxNote: string;
  shipping: { method: "pickup" | "ship"; cents: number };
  /** Rows after the total (deposit due now, balance at pickup). */
  extra?: React.ReactNode;
};

/** Subtotal, shipping (or free pickup), tax with its rate behind an info button, and the total. */
export function TotalsCard({ subtotalCents, taxCents, totalCents, taxApproved, taxNote, shipping, extra }: TotalsProps) {
  return (
    <div className={`${card} p-4`}>
      <dl className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2">
        <dt className="font-semibold">Subtotal</dt>
        <dd className="text-right font-semibold">{formatCents(subtotalCents)}</dd>
        <dt className="text-ink-soft">{shipping.method === "ship" ? "Shipping" : "Pickup in store"}</dt>
        <dd className="text-right text-ink-soft">{shipping.method === "ship" ? formatCents(shipping.cents) : "Free"}</dd>
        <dt className="flex items-center text-ink-soft">
          {taxApproved ? "Tax" : "Estimated tax (to be confirmed)"}
          <InfoTip label="About tax" text={taxNote} />
        </dt>
        <dd className="text-right text-ink-soft">{formatCents(taxCents)}</dd>
        <dt className="mt-2 border-t border-line pt-3 text-lg font-semibold">Total</dt>
        <dd className="mt-2 border-t border-line pt-3 text-right text-lg font-semibold">{formatCents(totalCents)}</dd>
        {extra}
      </dl>
    </div>
  );
}

/** The short repeat of the totals right above the Pay button. */
export function PayTotals({ subtotalCents, totalCents, rows }: { subtotalCents: number; totalCents: number; rows?: { label: string; value: string }[] }) {
  return (
    <dl className="mt-6 mb-4 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t border-line pt-4">
      <dt className="text-ink-soft">Subtotal</dt>
      <dd className="text-right text-ink-soft">{formatCents(subtotalCents)}</dd>
      <dt className="font-semibold">Total</dt>
      <dd className="text-right font-semibold">{formatCents(totalCents)}</dd>
      {rows?.map((r) => (
        <Fragment key={r.label}>
          <dt className="text-sm text-ink-soft">{r.label}</dt>
          <dd className="text-right text-sm text-ink-soft">{r.value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

/** Pickup & delivery · Cancellations & refunds · Privacy, under the Pay button. */
export function PolicyLine() {
  return (
    <p className="mt-4 flex flex-wrap justify-center gap-x-1 text-sm text-ink-soft">
      <Link href="/policies/pickup-and-delivery" className="inline-flex min-h-11 items-center px-1 text-ink-soft">
        Pickup &amp; delivery
      </Link>
      <span aria-hidden="true" className="inline-flex items-center">
        ·
      </span>
      <Link href="/policies/cancellations-and-refunds" className="inline-flex min-h-11 items-center px-1 text-ink-soft">
        Cancellations &amp; refunds
      </Link>
      <span aria-hidden="true" className="inline-flex items-center">
        ·
      </span>
      <Link href="/policies/privacy" className="inline-flex min-h-11 items-center px-1 text-ink-soft">
        Privacy
      </Link>
    </p>
  );
}
