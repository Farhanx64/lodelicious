"use client";

import { createContext, useContext, useMemo, useState, useSyncExternalStore } from "react";

import { formatCents } from "@/src/lib/money";
import { amountFor, type ApplePayAmount } from "@/src/lib/payments/apple-pay";

/**
 * Sales tax follows the ship-to state (D65). The server works out the order for every state in
 * "Tax by ship-to state" and once more for "no sales tax", and renders each version; this picks
 * the one for the state chosen in the address, without a page load, so nothing typed is lost.
 * The server still recomputes the tax from the submitted address and charges its own figure; the
 * page's figure is sent as `expectedCents` only so a mismatch stops the charge instead of
 * surprising the customer.
 *
 * Outside a provider (pickup) the variant is "pickup".
 */
/**
 * Live shipping (D67): the page is rendered with the usual shipping figure; once a ZIP is typed the
 * address fields fetch the live price and every total on the page moves by the difference.
 */
export type ShipQuote = { status: "idle" | "loading" | "live" | "fallback" | "error"; cents: number | null };
type ShipTaxState = {
  state: string;
  variant: string;
  setState(state: string): void;
  baseShippingCents: number;
  quote: ShipQuote;
  setQuote(quote: ShipQuote): void;
  /** What to add to every server-rendered total: live shipping minus the shipping it was rendered with. */
  deltaCents: number;
  /** True while a shipped order has no live price yet: no shipping figure, no paying (D67). */
  needsQuote: boolean;
};

const ShipTaxContext = createContext<ShipTaxState | null>(null);

export function ShipTaxProvider({
  listed,
  initialState = "MA",
  baseShippingCents = 0,
  requiresQuote = false,
  children,
}: {
  listed: readonly string[];
  initialState?: string;
  baseShippingCents?: number;
  /** Shipping is priced live from the ZIP (D67): the page was rendered without it. */
  requiresQuote?: boolean;
  children?: React.ReactNode;
}) {
  const [state, setState] = useState(initialState);
  const [quote, setQuote] = useState<ShipQuote>({ status: "idle", cents: null });
  const value = useMemo(
    () => ({
      state,
      variant: listed.includes(state) ? state : "none",
      setState,
      baseShippingCents,
      quote,
      setQuote,
      deltaCents: quote.cents === null ? 0 : quote.cents - baseShippingCents,
      needsQuote: requiresQuote && !(quote.status === "live" && quote.cents !== null),
    }),
    [state, listed, baseShippingCents, quote, requiresQuote],
  );
  return <ShipTaxContext value={value}>{children}</ShipTaxContext>;
}

/** The chosen ship-to state and which version of the totals applies. */
export function useShipTax(): {
  state: string | null;
  variant: string;
  setState: ((state: string) => void) | null;
  deltaCents: number;
  quote: ShipQuote;
  setQuote: ((quote: ShipQuote) => void) | null;
  baseShippingCents: number;
  needsQuote: boolean;
} {
  const ctx = useContext(ShipTaxContext);
  return ctx ? ctx : { state: null, variant: "pickup", setState: null, deltaCents: 0, quote: { status: "idle", cents: null }, setQuote: null, baseShippingCents: 0, needsQuote: false };
}

/** The shipping figure, or what the customer must do to get one (D67). */
export function ShipLine({ cents }: { cents: number }) {
  const { needsQuote, quote, deltaCents } = useShipTax();
  if (!needsQuote) return <>{formatCents(cents + deltaCents)}</>;
  return <>{quote.status === "loading" ? "Calculating…" : quote.status === "error" ? "Unavailable" : "Enter ZIP code"}</>;
}

/** A wallet amount moved by the live-shipping difference (every choice pays the same shipping). */
export function shiftAmount(spec: ApplePayAmount | undefined, delta: number): ApplePayAmount | undefined {
  if (!spec || delta === 0) return spec;
  return {
    cents: spec.cents + delta,
    ...(spec.byChoice ? { byChoice: { field: spec.byChoice.field, cents: Object.fromEntries(Object.entries(spec.byChoice.cents).map(([k, v]) => [k, v + delta])) } } : {}),
  };
}

/** A server-rendered amount that includes shipping, moved by the live-shipping difference. Outside checkout it is just the amount. */
export function ShipMoney({ cents }: { cents: number }) {
  return <>{formatCents(cents + useShipTax().deltaCents)}</>;
}

/** The chosen version's total (or any per-version amount that includes shipping). */
export function ShipTaxMoney({ cents }: { cents: Record<string, number> }) {
  const { variant, deltaCents } = useShipTax();
  const base = cents[variant];
  return <>{base === undefined ? "" : formatCents(base + deltaCents)}</>;
}

/** Renders its children only for the chosen version (server-rendered totals for one state, or for no tax). */
export function ForShipTax({ variant, children }: { variant: string; children?: React.ReactNode }) {
  return useShipTax().variant === variant ? <>{children}</> : null;
}

/** The chosen state's code, for "No sales tax (ships to NY)". */
export function ShipToState() {
  return <>{useShipTax().state ?? ""}</>;
}

/** The current value of a radio group (inside the form or joined to it with `form="…"`). */
function chosen(field: string): string | null {
  return document.querySelector<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(field)}"]:checked`)?.value ?? null;
}

const subscribeToChanges = (onChange: () => void) => {
  document.addEventListener("change", onChange);
  return () => document.removeEventListener("change", onChange);
};
const noSubscribe = () => () => {};

/** Follows a radio group (the reward or deposit choice) so the expected charge matches what the page shows. */
function useChoice(field: string | undefined): string | null {
  return useSyncExternalStore(
    subscribeToChanges,
    () => (field ? chosen(field) : null),
    () => null,
  );
}

/**
 * The amount the page is showing next to the Pay button, sent with the form as `expectedCents`.
 * Rendered only once the page is interactive, so a page without JavaScript (which can't follow a
 * state change) never sends a figure it didn't update; the server then simply charges its own.
 */
export function ExpectedCharge({ amounts }: { amounts: Record<string, ApplePayAmount> }) {
  const { variant, deltaCents, needsQuote } = useShipTax();
  const spec = needsQuote ? undefined : shiftAmount(amounts[variant], deltaCents);
  const choice = useChoice(spec?.byChoice?.field);
  // False on the server and before hydration, true once the page is interactive.
  const ready = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  if (!ready || !spec) return null;
  return <input type="hidden" name="expectedCents" value={amountFor(spec, choice)} />;
}

/** One label per version (the Pay button, the summary toggle's total). */
export function ShipTaxText({ texts }: { texts: Record<string, string> }) {
  const { variant } = useShipTax();
  return <>{texts[variant] ?? ""}</>;
}
