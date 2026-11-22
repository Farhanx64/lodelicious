"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

import { amountFor, applePayAvailable, mountApplePay, type ApplePayAmount, type CloverApplePay, type CloverElements } from "@/src/lib/payments/apple-pay";

import { useWalletSubmit } from "./ActionForm";

const MOUNT_ID = "apple-pay-button";
const noSubscribe = () => () => {};

/** Nothing is charged while the total is still being worked out; the sheet closes as failed. */
function paymentWhilePaused(wallet: { showError(message: string): void } | null, name: string) {
  const message = `Please wait for the shipping price, then pay with ${name} again. Nothing was charged.`;
  wallet?.showError(message);
  return { kind: "error" as const, message };
}

/** The current value of a radio group (inside the form or joined to it with `form="…"`). */
function chosen(field: string): string | null {
  return document.querySelector<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(field)}"]:checked`)?.value ?? null;
}

/**
 * Clover's Apple Pay button (D59), above the card fields. Renders nothing at all unless this device
 * has Apple Pay (Safari with Apple Pay, over HTTPS); the server already left it out unless Apple Pay
 * is switched on for the store. Paying submits the same form, with Apple Pay's token in place of the
 * card's, so the server charges it the same way.
 */
export function ApplePayButton({
  clover,
  elements,
  sessionIdentifier,
  amount,
  paused = false,
}: {
  clover: CloverApplePay;
  elements: CloverElements;
  sessionIdentifier: string;
  amount: ApplePayAmount;
  /** The total is being worked out (shipping not priced yet): the button stays mounted but can't be used. */
  paused?: boolean;
}) {
  const available = useSyncExternalStore(
    noSubscribe,
    () => applePayAvailable(window),
    () => false,
  );
  const wallet = useWalletSubmit();
  const walletRef = useRef(wallet);
  const amountRef = useRef(amount);
  const pausedRef = useRef(paused);
  const control = useRef<ReturnType<typeof mountApplePay> | null>(null);
  useEffect(() => {
    walletRef.current = wallet;
    amountRef.current = amount;
    pausedRef.current = paused;
  });

  useEffect(() => {
    if (!available || !walletRef.current) return;
    const current = () => amountFor(amountRef.current, amountRef.current.byChoice ? chosen(amountRef.current.byChoice.field) : null);
    let mounted: ReturnType<typeof mountApplePay>;
    try {
      mounted = mountApplePay({
        win: window,
        clover,
        elements,
        mountSelector: `#${MOUNT_ID}`,
        sessionIdentifier,
        amountCents: current(),
        submit: (payment) =>
          pausedRef.current
            ? Promise.resolve(paymentWhilePaused(walletRef.current, "Apple Pay"))
            : walletRef.current!.submit({ ...payment, wallet: "apple_pay" }),
        showError: (message) => walletRef.current?.showError(message),
      });
    } catch {
      return; // Clover's SDK without Apple Pay: the card form is still there.
    }
    control.current = mounted;
    // The reward or deposit choice changes the amount without a new page.
    const onChange = (event: Event) => {
      const field = amountRef.current.byChoice?.field;
      if (field && event.target instanceof HTMLInputElement && event.target.name === field) mounted.setAmount(current());
    };
    document.addEventListener("change", onChange);
    return () => {
      document.removeEventListener("change", onChange);
      mounted.destroy();
      control.current = null;
    };
  }, [available, clover, elements, sessionIdentifier]);

  // A new total from the server (Pickup / Ship, a bag line changed).
  useEffect(() => {
    control.current?.setAmount(amountFor(amount, amount.byChoice ? chosen(amount.byChoice.field) : null));
  }, [amount]);

  if (!available || !wallet) return null;
  return (
    <div className="mb-5">
      <div id={MOUNT_ID} className={`h-12 w-full overflow-hidden rounded-lg${paused ? " pointer-events-none opacity-40" : ""}`} aria-disabled={paused || undefined} />
      {paused && <p className="mt-2 text-sm text-ink-soft">Apple Pay is ready once shipping is priced.</p>}
      <p className="mt-4 flex items-center gap-3 text-sm text-ink-soft" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        or pay by card
        <span className="h-px flex-1 bg-line" />
      </p>
    </div>
  );
}
