"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

import { amountFor, applePayAvailable, mountApplePay, type ApplePayAmount, type CloverApplePay } from "@/src/lib/payments/apple-pay";

import { useWalletSubmit } from "./ActionForm";

const MOUNT_ID = "apple-pay-button";
const noSubscribe = () => () => {};

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
export function ApplePayButton({ clover, sessionIdentifier, amount }: { clover: CloverApplePay; sessionIdentifier: string; amount: ApplePayAmount }) {
  const available = useSyncExternalStore(
    noSubscribe,
    () => applePayAvailable(window),
    () => false,
  );
  const wallet = useWalletSubmit();
  const walletRef = useRef(wallet);
  const amountRef = useRef(amount);
  const control = useRef<ReturnType<typeof mountApplePay> | null>(null);
  useEffect(() => {
    walletRef.current = wallet;
    amountRef.current = amount;
  });

  useEffect(() => {
    if (!available || !walletRef.current) return;
    const current = () => amountFor(amountRef.current, amountRef.current.byChoice ? chosen(amountRef.current.byChoice.field) : null);
    let mounted: ReturnType<typeof mountApplePay>;
    try {
      mounted = mountApplePay({
        win: window,
        clover,
        mountSelector: `#${MOUNT_ID}`,
        sessionIdentifier,
        amountCents: current(),
        submit: (payment) => walletRef.current!.submit({ ...payment, wallet: "apple_pay" }),
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
  }, [available, clover, sessionIdentifier]);

  // A new total from the server (Pickup / Ship, a bag line changed).
  useEffect(() => {
    control.current?.setAmount(amountFor(amount, amount.byChoice ? chosen(amount.byChoice.field) : null));
  }, [amount]);

  if (!available || !wallet) return null;
  return (
    <div className="mb-5">
      <div id={MOUNT_ID} className="h-12 w-full overflow-hidden rounded-lg" />
      <p className="mt-4 flex items-center gap-3 text-sm text-ink-soft" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        or pay by card
        <span className="h-px flex-1 bg-line" />
      </p>
    </div>
  );
}
