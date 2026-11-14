"use client";

import { createContext, useContext, useMemo, useState, useSyncExternalStore } from "react";

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
type ShipTaxState = { state: string; variant: string; setState(state: string): void };

const ShipTaxContext = createContext<ShipTaxState | null>(null);

export function ShipTaxProvider({ listed, initialState = "MA", children }: { listed: readonly string[]; initialState?: string; children?: React.ReactNode }) {
  const [state, setState] = useState(initialState);
  const value = useMemo(() => ({ state, variant: listed.includes(state) ? state : "none", setState }), [state, listed]);
  return <ShipTaxContext value={value}>{children}</ShipTaxContext>;
}

/** The chosen ship-to state and which version of the totals applies. */
export function useShipTax(): { state: string | null; variant: string; setState: ((state: string) => void) | null } {
  const ctx = useContext(ShipTaxContext);
  return ctx ? ctx : { state: null, variant: "pickup", setState: null };
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
  const { variant } = useShipTax();
  const spec = amounts[variant];
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
