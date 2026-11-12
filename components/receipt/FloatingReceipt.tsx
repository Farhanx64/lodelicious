"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { primaryButton, secondaryButton } from "@/components/checkout/styles";
import { BAG_ADDED_EVENT, itemsLabel, showReceipt, type ReceiptData } from "@/src/lib/checkout/receipt";
import { formatCents } from "@/src/lib/money";

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The floating receipt (D58): a slim bar at the bottom of storefront pages with the item count,
 * subtotal and Checkout, which opens into a receipt of the bag. While open, focus stays inside it;
 * Escape, the chevron or a tap outside closes it. The page gets bottom padding the height of the bar
 * so the footer is never hidden behind it.
 */
export function FloatingReceipt({ data }: { data: ReceiptData }) {
  const pathname = usePathname();
  const visible = showReceipt(pathname, data.itemCount);
  const [expanded, setExpanded] = useState(false);
  const [entering, setEntering] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const ids = useId();
  const sheetId = `${ids}-sheet`;
  const headingId = `${ids}-heading`;
  const rootRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // React to a new count from the server during render (no effect needed): slide in when it grows,
  // and say what changed in the polite live region. The first render says nothing.
  const [seenCount, setSeenCount] = useState(data.itemCount);
  if (seenCount !== data.itemCount) {
    setSeenCount(data.itemCount);
    if (data.itemCount > seenCount) setEntering(true);
    if (visible) setAnnouncement(`Bag updated: ${itemsLabel(data.itemCount)}, subtotal ${formatCents(data.subtotalCents)}.`);
  }
  // A new page, or the bar going away, closes the receipt.
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setExpanded(false);
  }
  if (expanded && !visible) setExpanded(false);

  const collapse = useCallback((returnFocus: boolean) => {
    setExpanded(false);
    if (returnFocus) requestAnimationFrame(() => toggleRef.current?.focus());
  }, []);

  // The add-to-bag forms announce a successful add; replay the slide-in even if the count is unchanged.
  useEffect(() => {
    const onAdded = () => setEntering(true);
    window.addEventListener(BAG_ADDED_EVENT, onAdded);
    return () => window.removeEventListener(BAG_ADDED_EVENT, onAdded);
  }, []);

  // Keep the page's bottom clear of the bar: body padding (and scroll padding, WCAG 2.4.11) the
  // height the bar covers, measured so the safe area and the desktop gap are included.
  useEffect(() => {
    const bar = barRef.current;
    if (!visible || !bar) return;
    const root = document.documentElement;
    const measure = () => root.style.setProperty("--receipt-space", `${Math.ceil(window.innerHeight - bar.getBoundingClientRect().top)}px`);
    measure();
    document.body.classList.add("has-receipt");
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      document.body.classList.remove("has-receipt");
      root.style.removeProperty("--receipt-space");
    };
  }, [visible]);

  // While open: focus moves into the receipt, Tab cycles inside it, Escape closes it.
  useEffect(() => {
    if (!expanded) return;
    headingRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        collapse(true);
        return;
      }
      if (event.key !== "Tab" || !rootRef.current) return;
      const items = [...rootRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = rootRef.current.contains(active);
      if (event.shiftKey && (!inside || active === first || active === headingRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!inside || active === last)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expanded, collapse]);

  const subtotal = formatCents(data.subtotalCents);
  const checkoutHref = data.blocking ? "/cart" : "/checkout";

  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {visible && (
        <>
          {expanded && <div aria-hidden="true" data-receipt-backdrop onClick={() => collapse(false)} className="fixed inset-0 z-40 bg-ink/30" />}
          <div
            ref={rootRef}
            data-receipt
            data-entering={entering || undefined}
            onAnimationEnd={() => setEntering(false)}
            className="receipt-root fixed inset-x-0 bottom-0 z-50 md:bottom-4 md:px-4"
          >
            <div className="mx-auto w-full max-w-xl">
              {expanded && (
                <section
                  id={sheetId}
                  aria-labelledby={headingId}
                  className="receipt-paper relative mx-2 mb-2 flex max-h-[calc(100dvh-10rem)] flex-col rounded-b-lg px-5 pt-5 pb-4 md:mx-0"
                >
                  <h2 id={headingId} ref={headingRef} tabIndex={-1} className="mb-3 text-center text-lg outline-offset-2">
                    Your order
                  </h2>
                  <ul className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
                    {data.lines.map((line) => (
                      <li key={line.key} className="flex items-center gap-3 border-b border-dashed border-line py-2 first:border-t">
                        {line.image ? (
                          // eslint-disable-next-line @next/next/no-img-element -- Payload's own thumbnail size, as on the bag
                          <img src={line.image.src} alt={line.image.alt} width={40} height={40} loading="lazy" className="size-10 shrink-0 rounded bg-white object-contain" />
                        ) : (
                          <span aria-hidden="true" className="size-10 shrink-0 rounded bg-linen" />
                        )}
                        <span className="min-w-0 flex-1 text-sm leading-snug">
                          <span className="tabular-nums">{line.quantity} ×</span> {line.title}
                          {line.detail && <span className="block text-ink-soft">{line.detail}</span>}
                          {line.note && <span className={`block ${line.unavailable ? "text-error" : "text-ink-soft"}`}>{line.note}</span>}
                        </span>
                        <span className="text-sm whitespace-nowrap tabular-nums">{line.totalCents === null ? "—" : formatCents(line.totalCents)}</span>
                      </li>
                    ))}
                  </ul>
                  <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-b border-dashed border-line pb-3 text-sm tabular-nums">
                    <dt className="font-semibold">Subtotal</dt>
                    <dd className="text-right font-semibold">{subtotal}</dd>
                    <dt>{data.taxLabel}</dt>
                    <dd className="text-right">{formatCents(data.taxCents)}</dd>
                  </dl>
                  <p className="mt-2 text-center text-sm text-ink-soft">Shipping or pickup chosen at checkout.</p>
                  {data.blocking && <p className="mt-2 text-center text-sm text-error">Remove the unavailable items in your bag to check out.</p>}
                  <p className="mt-3 grid grid-cols-2 gap-2">
                    <Link href="/cart" className={`${secondaryButton} px-3`}>
                      View bag
                    </Link>
                    {data.blocking ? (
                      <span aria-disabled="true" className={`${primaryButton} px-3`}>
                        Checkout
                      </span>
                    ) : (
                      <Link href="/checkout" className={`${primaryButton} px-3`}>
                        Checkout
                      </Link>
                    )}
                  </p>
                </section>
              )}
              <div
                ref={barRef}
                className="flex items-center gap-2 border-t border-line bg-paper px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgb(59_47_37/0.12)] md:rounded-2xl md:border md:pb-2"
              >
                <button
                  ref={toggleRef}
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={expanded ? sheetId : undefined}
                  onClick={() => (expanded ? collapse(false) : setExpanded(true))}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg px-1 text-left"
                >
                  <span aria-hidden="true" className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-coastal-pale font-semibold text-coastal-deep tabular-nums">
                    {data.itemCount}
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="sr-only">Your order: </span>
                    <span className="block text-sm text-ink-soft">{itemsLabel(data.itemCount)}</span>
                    <span className="block font-semibold tabular-nums">
                      {subtotal}
                      <span className="sr-only"> subtotal</span>
                    </span>
                  </span>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    className={`ml-auto size-5 shrink-0 text-ink-soft motion-safe:transition-transform ${expanded ? "" : "rotate-180"}`}
                  >
                    <path d="M4 6l4 4 4-4" />
                  </svg>
                </button>
                <Link href={checkoutHref} className={`${primaryButton} shrink-0 px-5`}>
                  {data.blocking ? "View bag" : "Checkout"}
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
