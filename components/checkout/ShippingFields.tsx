"use client";

import { useEffect, useRef, useState } from "react";

import { formatCents } from "@/src/lib/money";

import { US_STATES } from "@/src/lib/shipping/rates";

import { useFormValues } from "./ActionForm";
import { useShipTax } from "./ShipTax";

// One bordered box, a row per part of the address (D56). Each row keeps its own visible label; the
// focus ring is drawn on the row, around the label and the input together.
const row =
  "relative block bg-paper px-3 pt-1.5 pb-1 focus-within:z-10 focus-within:outline-[3px] focus-within:outline-solid focus-within:outline-focus focus-within:-outline-offset-2";
const rowLabel = "block text-xs font-semibold text-ink-soft";
const rowInput = "block min-h-8 w-full bg-transparent text-base text-ink focus-visible:outline-none";

/** The ship-to address (D54), grouped in one box. US only. Keeps what the customer typed after an error. */
export function ShippingAddressFields({ prefix, liveQuote = false }: { prefix: string; liveQuote?: boolean }) {
  const v = useFormValues();
  // Sales tax follows the state (D65): tell the page's totals which state is chosen, now and after an error refills the form.
  const { setState, state, quote, setQuote } = useShipTax();
  const stateRef = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (stateRef.current) setState?.(stateRef.current.value);
  }, [setState, v.shipState]);
  // Live shipping (D67): once a 5-digit ZIP is typed, ask the server what this bag costs to ship there.
  const [zip, setZip] = useState((v.shipZip ?? "").slice(0, 5));
  useEffect(() => {
    if (!liveQuote || !setQuote) return;
    if (!/^\d{5}$/.test(zip) || !state) {
      setQuote({ status: "idle", cents: null });
      return;
    }
    const abort = new AbortController();
    setQuote({ status: "loading", cents: null });
    const timer = setTimeout(() => {
      fetch("/checkout/ship-quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ zip, state }), signal: abort.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((q: { cents?: number; live?: boolean } | null) => {
          if (abort.signal.aborted) return;
          setQuote(q && Number.isSafeInteger(q.cents) ? { status: q.live ? "live" : "fallback", cents: q.cents as number } : { status: "error", cents: null });
        })
        .catch(() => !abort.signal.aborted && setQuote({ status: "error", cents: null }));
    }, 350);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [liveQuote, setQuote, zip, state]);
  const input = (name: string, text: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className={row}>
      <label htmlFor={`${prefix}-${name}`} className={rowLabel}>
        {text}
      </label>
      <input id={`${prefix}-${name}`} name={name} defaultValue={v[name]} className={rowInput} {...extra} />
    </div>
  );
  return (
    <fieldset className="mb-6">
      <legend className="mb-3 text-base font-semibold text-ink">Shipping address</legend>
      <div className="divide-y divide-ink-soft/40 overflow-clip rounded-lg border border-ink-soft">
        <div className="flex min-h-11 items-center gap-2 bg-paper px-3 py-2">
          <span className="text-xs font-semibold text-ink-soft">Country</span>
          <span>United States</span>
          <span className="ml-auto text-sm text-ink-soft">US addresses only</span>
        </div>
        {input("shipName", "Recipient name (if it isn't you)", { autoComplete: "shipping name", maxLength: 100 })}
        {input("shipLine1", "Street address", { autoComplete: "shipping address-line1", required: true, maxLength: 120 })}
        {input("shipLine2", "Apartment, suite (optional)", { autoComplete: "shipping address-line2", maxLength: 120 })}
        <div className={row}>
          <label htmlFor={`${prefix}-shipState`} className={rowLabel}>
            State
          </label>
          <select
            ref={stateRef}
            id={`${prefix}-shipState`}
            name="shipState"
            required
            defaultValue={v.shipState ?? "MA"}
            autoComplete="shipping address-level1"
            aria-describedby={`${prefix}-shipState-tax`}
            onChange={(event) => setState?.(event.target.value)}
            className={rowInput}
          >
            {US_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <span id={`${prefix}-shipState-tax`} className="sr-only">
            Sales tax depends on the state; the total updates when you change it.
          </span>
        </div>
        <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] divide-x divide-ink-soft/40">
          {input("shipCity", "Town or city", { autoComplete: "shipping address-level2", required: true, maxLength: 60 })}
          {input("shipZip", "ZIP code", {
            autoComplete: "shipping postal-code",
            required: true,
            inputMode: "numeric",
            pattern: "\\d{5}(-\\d{4})?",
            maxLength: 10,
            onInput: (event) => setZip(event.currentTarget.value.trim().slice(0, 5)),
          })}
        </div>
      </div>
      {liveQuote && (
        <p aria-live="polite" className="mt-2 text-sm text-ink-soft">
          {quote.status === "loading"
            ? "Working out shipping for your ZIP code…"
            : quote.status === "live" && quote.cents !== null
              ? `Shipping to ${zip}: ${formatCents(quote.cents)} (ground shipping).`
              : quote.status === "error"
                ? "We couldn't price shipping to that ZIP code. Please check it and try again, or choose pickup."
                : "Enter your ZIP code: shipping is priced from it and the weight of your order."}
        </p>
      )}
    </fieldset>
  );
}
